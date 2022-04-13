let oauth2 = require('simple-oauth2');
const tableUtils = require('../datastore/table');
let fetch = require('node-fetch');
const _ = require('lodash');

const provider = {};
const SERVICE_ACCOUNT_EXTERNAL_KEY = 'serviceAccount';

const ERROR_CODES = {
    INNER_AUTHORIZATION_FAILED: { code: 0, message: 'Inner Authorization Failed' },
};

exports.initHandler = function(config) {
  provider.callbackUrl = config.get('callbackUrl');
  provider.credentials = config.get('credentials');
  provider.authorizeUrl = config.get('authorizeUrl');
  provider.innerAuthorization = config.get('innerAuthorization');
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
            if (couldNotFindRowData(result)) {
              console.log('User is not signed in - queried OAuth table row does not exist');
              return res.status(401).send(packageError(result));
            }
            console.error(`An error occurred during oauth table row retrieval: ${JSON.stringify(result.errors)}`);
            return res.status(500).send(packageError(result));
          }
          const url = _.get(provider, 'innerAuthorization.url') || _.get(provider, 'innerAuthorizationUrl');
          if (url && !!result.data.accessToken) {
            const headers = _.get(provider, 'innerAuthorization.headers');
            const method = _.get(provider, 'innerAuthorization.method');
            return getInnerAuthorizationResponse(url, result.data.accessToken, headers, method)
              .then((isOkStatus) => {
                if (!isOkStatus) {
                  console.warn('The access token is invalid');
                  const removeCredentials = _.get(provider, 'innerAuthorization.removeCredentials', true);
                  if (removeCredentials) {
                    const replaceableToken = emptyTokenWithErrorCode(ERROR_CODES.INNER_AUTHORIZATION_FAILED.code);
                    accessTokensTable.editRow(storageTokenInfo.externalId, replaceableToken);
                    console.log('Invalid token removed and returning empty token.');
                    return res.status(204).send(ERROR_CODES.INNER_AUTHORIZATION_FAILED);
                  }
                  const replaceableToken = oldTokenWithErrorCode(result.data, ERROR_CODES.INNER_AUTHORIZATION_FAILED.code);
                  accessTokensTable.editRow(storageTokenInfo.externalId, replaceableToken);
                  console.log('Returning the invalid token.');
                  return getStandardAuthorizationResponse(res, result, accessTokensTable, storageTokenInfo);
                } else {
                  console.log('Access token is valid - proceeding.');
                  return getStandardAuthorizationResponse(res, result, accessTokensTable, storageTokenInfo);
                }
              });
          }
          return getStandardAuthorizationResponse(res, result, accessTokensTable, storageTokenInfo);
        })
    })
};

const getInnerAuthorizationResponse = (url, accessToken, headers = {}, method = 'GET') => {
    let options = {
        method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...headers,
        }
    };
    console.info(`Making a check if the access token is still valid by doing a request: ${method} ${url}`);
    return fetch(url, options)
        .then((res) => {
            return res.ok;
        })
        .catch((error) => {
                console.error('An error during checking if access token is still valid occured.', error);
                return false;
        });
};

const getStandardAuthorizationResponse = (res, result, accessTokensTable, storageTokenInfo) => {
    if (isAccessTokenValidForever(result.data)) {
        console.log('Related access token is valid forever - no refresh required.');
        return res.status(200).send();
    }
    console.log(`Related access token expires at: ${result.data.access_expires_at}`);

    if (isEmptyToken(result.data)) {
        console.log('User needs to sign in - access token is empty in a related datastore row');
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
        console.log("Refreshing token as it is expired or will be expired soon.");
        return accessTokenObj.refresh()
            .then((refreshResult) => {
                console.log("Refresh success");
                return storeTokenData(accessTokensTable, storageTokenInfo, refreshResult.token, res);
            })
            .catch((err) => {
                console.error('Access token refresh failed', err);
                return res.status(401).send(packageError('The authorization code/refresh token is expired or invalid/redirect_uri must have the same value as in the authorization request.'));
            });
    }

    console.log(`No refresh required as the access token is not going to expire soon.`);
    console.log(`${storageTokenInfo.returnTokenBack ? '' : 'Not'} returning access token in the response`);
    return res.status(200).send(storageTokenInfo.returnTokenBack ? tokenData.access_token : '');
};

const getStorageTokenInfo = (req, ctx) => {
  const isServiceAccount = req.query.service_account === 'true';
  console.log(
    isServiceAccount ? 'Received request is for Service account' : 'Received request is for non-service account'
  );
  return {
    externalId: isServiceAccount ? SERVICE_ACCOUNT_EXTERNAL_KEY : ctx.token.username,
    returnTokenBack: !isServiceAccount,
  };
};

const couldNotFindRowData = (result) => {
  return !result.errors || result.errors[0].message.includes('Could not find data');
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
    errorCode: null,
    refreshToken: accessTokenObj.token.refresh_token}
  ).then((rowData) => {
    if (!rowData.ok) {
      // Problem storing the access token which will
      // impact potential future api calls - send error
      throw new Error(JSON.stringify(rowData.errors[0]));
    }

    console.log(storageTokenInfo.returnTokenBack ? 'Returning new token' : 'Not returning new token')
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

  return oauth2.authorizationCode.getToken(tokenConfig)
    .then((result) => {
      console.log('Successfuly produced oauth token from authorization code - returning callback html');
      return res.status(200).send(generateCallbackHtml(oauth2.accessToken.create(result).token));
    })
    .catch((error) => {
      console.log('Failure on producing oauth token from authorization code - returning error html ', error.message);
      return res.status(500).send(createErrorHtml(error.message));
    });
};

const storeTokenHandler = (req, res, ctx) => {
  // Make sure this is called with the proper method
  if (req.method !== 'POST' && req.method !== 'PUT') {
    console.warn(`Invalid http method: ${req.method} - returning 400`);
    return res.status(400).send(packageError('Invalid request method - please use POST or PUT'));
  }

  if (!req.body) {
    const message = 'Missing request body';
    console.warn(message);
    return res.status(400).send(packageError(message));
  }

  const parsed = JSON.parse(req.body);

  // Make sure user has passed correct data parameter
  if (!parsed.token) {
    const message = 'Missing token body in request';
    console.warn(message);
    return res.status(400).send(packageError(message));
  }

  const storageTokenInfo = getStorageTokenInfo(req, ctx);

  // Get our oauth table and store the token data
  return tableUtils.setupOAuthTable(ctx)
    .then((tableId) => {
      const accessTokensTable = ctx.datastore.table(tableId);

      // we store the access token data by associating
      // it with the user on the function jwt auth token
      console.log('Saving token in datastore');
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

      console.log('Signing out user - setting related OAuth table row to an empty token');
      return accessTokensTable.editRow(storageTokenInfo.externalId, emptyTokenWithErrorCode())
        .then((result) => {
          if (!result.ok) {
            console.error(`Error on setting empty token: ${JSON.stringify(result.errors)} - returning error html`);
            return res.status(500).send(createErrorHtml(result.errors[0]));
          }
          console.log('Sign out successful');
          return res.status(200).send(generateCallbackHtml({}));
        });
    });
};

// Blank tokens and current date (needed for date column validation)
// for use with logout
const emptyTokenWithErrorCode = (errorCode = null) => ({
    accessToken: "",
    access_expires_at: new Date().toISOString(),
    errorCode,
    refreshToken: "",
});

const oldTokenWithErrorCode = (oldValue, errorCode = null) => ({
    ...oldValue,
    errorCode,
});
