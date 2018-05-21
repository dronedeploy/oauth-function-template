const tableUtils = require('./datastore/table');
const provider = require('./provider');
const oauth2 = require('simple-oauth2').create(provider.credentials);

// Initializes the OAuth2 flow - successful authorization results in redirect to callback export
const oauth2InitHandler = (req, res, ctx) => {
  var urlObj = provider.authorizeUrl;
  urlObj.redirect_uri += '?jwt_token=' + ctx.originalToken;
  const authorizationUri = oauth2.authorizationCode.authorizeURL(urlObj);
  res.send(authorizationUri);
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
  ''+
  '</body>'+
  '</html>';
};

// Callback handler to take the auth code from first OAuth2 step and get the tokens
const oauth2CallbackHandler = (req, res, ctx) => {
  const tokenConfig = {
    code: req.query.code,
    redirect_uri: provider.callbackUrl + '?jwt_token=' + ctx.originalToken
  };

  // Save the access token
  return oauth2.authorizationCode.getToken(tokenConfig)
    .then((result) => {
      // Result will contain: user, access token and refresh token
      // This create call handles keeping tokens for us in this accessToken object,
      // but in reality, we want to save in datastore

      // Get our oauth table and store the token data
      return tableUtils.setupOAuthTable(ctx)
        .then((tableId) => {
          // Put the token data (access_token, expires_at,
          // refresh_token) in the datastore
          var accessTokensTable = ctx.datastore.table(tableId);

          // we store the access token data by associating
          // it with the user on the function jwt auth token
          return accessTokensTable.upsertRow(ctx.token.username, {
            accessToken: result.access_token,
            access_expires_at: result.expires_at,
            refreshToken: result.refresh_token}
          ).then((rowData) => {
            if (!rowData.ok) {
              console.log(JSON.stringify(rowData));
              // Problem storing the access token which will
              // impact potential future api calls - send error
              throw new Error(rowData.errors[0]);
            }
            return res.status(200).send(generateCallbackHtml(result));
          });
        });
    })
    .catch((error) => {
      console.log('Access Token Error', error.message);
      res.status(500).send(error.message);
    });
};

exports.routeHandler = function (req, res, ctx) {

  const path = req.path;
  switch(path) {
    case '/refresh':
      // client should call this route first
      // will check if existing token for user
      // and attempt refresh if expired
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
    default: 
      res.status(404).send('Not Found');
  }
};
