let oauth2 = require('simple-oauth2');
const tableUtils = require('./datastore/table');
const { config } = require('./oauth-config');

const provider = {};

exports.initHandler = function() {
  provider.callbackUrl = config.get('callbackUrl');
  provider.credentials = config.get('credentials');
  provider.authorizeUrl = config.get('authorizeUrl');
  oauth2 = oauth2.create(provider.credentials);
};

exports.routeHandler = function (req, res, ctx) {

  const path = req.path;
  switch(path) {
    case '/refresh':
      // client should call this route first
      // will check if existing token for user
      // and attempt refresh if expired
      refreshHandler(req, res, ctx);
      break;
    case '/auth':
      // client calls this route to begin auth flow
      oauth2InitHandler(req, res, ctx);
      break;
    case '/auth/callback':
      // callback route following successful auth
      // this handler should store the token data
      // and return a response to the client
      oauth2CallbackHandler(req, res, ctx);
      break;
    case '/token':
      storeTokenHandler(req, res, ctx);
      break;
    case '/logout':
      logoutHandler(req, res, ctx);
      break;
    default:
      res.status(404).send('Not Found');
  }
};

const refreshHandler = (req, res, ctx) => {
  return tableUtils.setupOAuthTable(ctx)
    .then((tableId) => {
      const accessTokensTable = ctx.datastore.table(tableId);

      return accessTokensTable.getRowByExternalId(ctx.token.username)
        .then((result) => {
          console.log(result);
          if (!result.ok) {
            if (couldNotFindData(result)) {
              return res.status(401).send();
            }
            return res.status(500).send(packageError(result));
          }
          if (isEmptyToken(result.data)) {
            return res.status(204).send();
          }

          // This create call handles keeping tokens for us in this accessToken
          // object, but in reality, we would want to save in datastore
          const tokenData = {
            access_token: result.data.accessToken,
            expires_at: result.data.access_expires_at,
            refresh_token: result.data.refreshToken
          };
          console.log(tokenData);
          const accessTokenObj = oauth2.accessToken.create(tokenData);
          console.log(accessTokenObj);
          // We preemptively refresh the token to avoid sending a token back
          // to the client that may expire very soon
          if (doesTokenNeedRefresh(accessTokenObj.token)) {
            console.log("Refreshing token");
            return accessTokenObj.refresh()
              .then((refreshResult) => {
                console.log("Refresh success - returning new token");
                return storeTokenData(accessTokensTable, ctx.token.username, refreshResult.token, res, true);
              })
              .catch((err) => {
                console.log(err);
                return res.status(500).send(packageError(err.message));
              });
          }

          // No refresh needed, return token like normal
          return res.status(200).send(tokenData.access_token);
        })
    })
};

const couldNotFindData = (errResponse) => {
  return errResponse.errors[0].message.indexOf('Could not find data') !== -1;
};

const packageError = (err) => {
  return { error: err };
};

const isEmptyToken = (data) => {
  return data.accessToken === "" || data.refreshToken === "";
};

const doesTokenNeedRefresh = (token) => {
  // Provide a window of time before the actual expiration to
  // refresh the token
  const EXPIRATION_WINDOW_IN_SECONDS = 300;

  const expirationTimeInSeconds = token.expires_at.getTime() / 1000;
  const expirationWindowStart = expirationTimeInSeconds - EXPIRATION_WINDOW_IN_SECONDS;

  // If the start of the window has passed, refresh the token
  const nowInSeconds = (new Date()).getTime() / 1000;
  const shouldRefresh = nowInSeconds >= expirationWindowStart;

  return shouldRefresh;
};

// Stores the token in the datastore and return it to the client if successful
const storeTokenData = (table, username, tokenData, res, isRefresh) => {
  // Some tokens may not have an 'expires_at' property, so we will
  // calculate it anyway based on the 'expires_in' value
  const accessTokenObj = oauth2.accessToken.create(tokenData);
  return table.upsertRow(username, createTokenObject(tokenData))
    .then((rowData) => {
      if (!rowData.ok) {
        // Problem storing the access token which will
        // impact potential future api calls - send error
        throw new Error(JSON.stringify(rowData.errors[0]));
      }

      if (isRefresh) {
        return res.status(200).send(accessTokenObj.token);
      }
      return res.status(200).send(generateCallbackHtml(accessTokenObj.token));
    });
};

const createTokenObject = (tokenData) => {
  const accessTokenObj = oauth2.accessToken.create(tokenData);
  return {
    accessToken: accessTokenObj.token.access_token,
    access_expires_at: accessTokenObj.token.expires_at,
    refreshToken: accessTokenObj.token.refresh_token,
  };
};

// Initializes the OAuth2 flow - successful authorization results in redirect to callback export
const oauth2InitHandler = (req, res, ctx) => {
  provider.authorizeUrl.redirect_uri = `${provider.callbackUrl}`;
  const authorizationUri = oauth2.authorizationCode.authorizeURL(provider.authorizeUrl);
  res.send(authorizationUri);
};

// Callback handler to take the auth code from first OAuth2 step and get the tokens
const oauth2CallbackHandler = (req, res, ctx) => {
  const tokenConfig = {
    code: req.query.code,
    redirect_uri: provider.callbackUrl
  };

  // Save the access token
  return oauth2.authorizationCode.getToken(tokenConfig)
    .then((result) => {
      return res.status(200).send(generateCallbackHtml(createTokenObject(result)));
    })
    .catch((error) => {
      console.log('OAuth Callback Error', error.message);
      return res.status(500).send(createErrorHtml(error.message));
    });
};

const storeTokenHandler = (req, res, ctx) => {
  // Make sure this is called with the proper method
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(400).send(packageError('Invalid request method - please use POST or PUT'));
  }

  if (!req.body) {
    return res.status(400).send(packageError('Missing request body'));
  }

  const parsed = JSON.parse(req.body);

  // Make sure user has passed correct data parameter
  if (!parsed.token) {
    return res.status(400).send(packageError('Missing token body in request'));
  }

  // Make sure data passed actually converts properly
  try {
    createTokenObject(parsed.token);
  } catch (e) {
    return res.status(500).send(createErrorHtml(e.message));
  }

  // Get our oauth table and store the token data
  return tableUtils.setupOAuthTable(ctx)
    .then((tableId) => {
      var accessTokensTable = ctx.datastore.table(tableId);

      // we store the access token data by associating
      // it with the user on the function jwt auth token
      return storeTokenData(accessTokensTable, ctx.token.username, parsed.token, res);
    })
    .catch((error) => {
      console.log('Error storing Access Token', error.message);
      return res.status(500).send(packageError(error.message));
    });
};

const createErrorHtml = (err) => {
  // Nest in an error field for consistency at the client-level
  // and so if err is a string, we create an object for the callback html
  return generateCallbackHtml(packageError(err));
};

const generateCallbackHtml = (token) => {
  token = JSON.stringify(token);
  return '<!DOCTYPE html>'+
  '<html lang="en">'+
  '<head>'+
  '    <meta charset="UTF-8">'+
  '    <meta name="viewport" content="width=device-width, initial-scale=1.0">'+
  '    <meta http-equiv="X-UA-Compatible" content="ie=edge">'+
  '    <title>Document</title>'+
  '</head>'+
  '<body>'+
  '    <script>'+
  '    window.onload = function() {'+
  `        window.opener.postMessage(\'${token}\', \'*\')`+
  '    }'+
  '    </script>'+
  '</body>'+
  '</html>';
};

const logoutHandler = (req, res, ctx) => {
  return tableUtils.setupOAuthTable(ctx)
    .then((tableId) => {
      const accessTokensTable = ctx.datastore.table(tableId);

      return accessTokensTable.editRow(ctx.token.username, emptyToken)
        .then((result) => {
          if (!result.ok) {
            return res.status(500).send(createErrorHtml(result.errors[0]));
          }
          return res.status(200).send(generateCallbackHtml({}));
        });
    });
};

// Blank tokens and current date (needed for date column validation)
// for use with logout
const emptyToken = {
  accessToken: "",
  access_expires_at: new Date().toISOString(),
  refreshToken: ""
};
