let oauth2 = require('simple-oauth2');
const tableUtils = require('../datastore/table');
let fetch = require('node-fetch');

const provider = {};
const SERVICE_ACCOUNT_EXTERNAL_KEY = 'serviceAccount';

exports.initHandler = function(config) {
  provider.callbackUrl = config.get('callbackUrl');
  provider.credentials = config.get('credentials');
  provider.authorizeUrl = config.get('authorizeUrl');
  provider.innerAuthorizationUrl = config.get('innerAuthorizationUrl');
  oauth2 = oauth2.create(provider.credentials);

  return {
    '/refresh': refreshHandler,
    '/auth': oauth2InitHandler,
    '/auth/callback': oauth2CallbackHandler,
    '/token': storeTokenHandler,
    '/logout': logoutHandler,
  }
};

const refreshHandler = (req, res, ctx) => {
  return tableUtils.setupOAuthTable(ctx)
    .then((tableId) => {
      const accessTokensTable = ctx.datastore.table(tableId);
      const storageTokenInfo = getStorageTokenInfo(req, ctx);

      return accessTokensTable.getRowByExternalId(storageTokenInfo.externalId)
        .then((result) => {
          if (!result.ok) {
            if (couldNotFindData(result)) {
              return res.status(401).send(packageError(result));
            }
            return res.status(500).send(packageError(result));
          }
          const url = provider.innerAuthorizationUrl;
          if (url && !!result.data.accessToken) {
              return getInnerAuthorizationResponse(url, result.data.accessToken)
                  .then((isOkStatus) => {
                      if (!isOkStatus) {
                          accessTokensTable.editRow(storageTokenInfo.externalId, emptyToken);
                          return res.status(204).send();
                      } else {
                        return getStandardAuthorizationResponse(res, result, accessTokensTable, storageTokenInfo);
                      }
                  });
          }
          return getStandardAuthorizationResponse(res, result, accessTokensTable, storageTokenInfo);
        })
    })
};

const getInnerAuthorizationResponse = (url, accessToken) => {
    let options = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        }
    };
    console.info(`Making request: 'GET' ${url}`);
    return fetch(url, options)
        .then((res) => {
            return res.ok;
        })
        .catch((error) => {
                console.info({error});
                return false;
        });
};

const getStandardAuthorizationResponse = (res, result, accessTokensTable, storageTokenInfo) => {
    if (isAccessTokenValidForever(result.data)) {
        return res.status(200).send();
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
    const accessTokenObj = oauth2.accessToken.create(tokenData);

    // We preemptively refresh the token to avoid sending a token back
    // to the client that may expire very soon
    if (doesTokenNeedRefresh(accessTokenObj.token)) {
        console.log("Refreshing token");
        return accessTokenObj.refresh()
            .then((refreshResult) => {
                console.log("Refresh success - returning new token");
                return storeTokenData(accessTokensTable, storageTokenInfo, refreshResult.token, res);
            })
            .catch((err) => {
                console.log({err});
                return res.status(401).send(packageError('The authorization code/refresh token is expired or invalid/redirect_uri must have the same value as in the authorization request.'));
            });
    }

    // No refresh needed, return token like normal
    return res.status(200).send(storageTokenInfo.returnTokenBack ? tokenData.access_token : '');
};

const getStorageTokenInfo = (req, ctx) => {
  const isServiceAccount = req.query.service_account === 'true';
  return {
    externalId: isServiceAccount ? SERVICE_ACCOUNT_EXTERNAL_KEY : ctx.token.username,
    returnTokenBack: !isServiceAccount,
  };
};

const couldNotFindData = (errResponse) => {
  return errResponse.errors[0].message.indexOf('Could not find data') !== -1;
};

const packageError = (err) => {
  return { error: err };
};

const isEmptyToken = (data) => {
  const isUndefined = (!data.accessToken || !data.refreshToken);
  const isEmpty = (data.accessToken === "" || data.refreshToken === "");
  return isUndefined || isEmpty;
};

const isAccessTokenValidForever = ({ refreshToken, accessToken, access_expires_at }) => {
  return !refreshToken && !!accessToken && access_expires_at === '1970-01-01T00:00:00.000Z';
};

const doesTokenNeedRefresh = (token) => {
  // Provide a window of time before the actual expiration to
  // refresh the token
  const EXPIRATION_WINDOW_IN_SECONDS = 300;

  const expirationTimeInSeconds = token.expires_at.getTime() / 1000;
  const expirationWindowStart = expirationTimeInSeconds - EXPIRATION_WINDOW_IN_SECONDS;

  // If the start of the window has passed, refresh the token
  const nowInSeconds = (new Date()).getTime() / 1000;
  return nowInSeconds >= expirationWindowStart;
};

// Stores the token in the datastore and return it to the client if successful
const storeTokenData = (table, storageTokenInfo, tokenData, res) => {
  // Some tokens may not have an 'expires_at' property, so we will
  // calculate it anyway based on the 'expires_in' value
  const accessTokenObj = oauth2.accessToken.create(tokenData);
  return table.upsertRow(storageTokenInfo.externalId, {
    accessToken: accessTokenObj.token.access_token,
    access_expires_at: accessTokenObj.token.expires_at,
    refreshToken: accessTokenObj.token.refresh_token}
  ).then((rowData) => {
    if (!rowData.ok) {
      // Problem storing the access token which will
      // impact potential future api calls - send error
      throw new Error(JSON.stringify(rowData.errors[0]));
    }

    return res.status(200).send(storageTokenInfo.returnTokenBack ? accessTokenObj.token : '');
  });
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
      return res.status(200).send(generateCallbackHtml(oauth2.accessToken.create(result).token));
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

  const storageTokenInfo = getStorageTokenInfo(req, ctx);

  // Get our oauth table and store the token data
  return tableUtils.setupOAuthTable(ctx)
    .then((tableId) => {
      const accessTokensTable = ctx.datastore.table(tableId);

      // we store the access token data by associating
      // it with the user on the function jwt auth token
      return storeTokenData(accessTokensTable, storageTokenInfo, parsed.token, res);
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
      const storageTokenInfo = getStorageTokenInfo(req, ctx);

      return accessTokensTable.editRow(storageTokenInfo.externalId, emptyToken)
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
