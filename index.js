'use strict';

const provider = require('./provider');
const oauth2 = require('simple-oauth2').create(provider.credentials);

// Initializes the OAuth2 flow - successful authorization results in redirect to callback export
const oauth2InitHandler = (req, res, next) => {
  const authorizationUri = oauth2.authorizationCode.authorizeURL(provider.authorizeUrl);
  // We return the authorization Uri to the client for loading in a new window
  res.send(authorizationUri);
};

// Callback handler to take the auth code from first OAuth2 step and get the tokens
const oauth2CallbackHandler = (req, res) => {
  const tokenConfig = {
    code: req.query.code,
    redirect_uri: provider.callbackUrl
  };

  // Save the access token
  oauth2.authorizationCode.getToken(tokenConfig)
  .then((result) => {
    // Result for Climate will contain: user, access token and refresh token
    // This create call handles keeping tokens for us in this accessToken object,
    // but in reality, we would want to save in datastore
    const accessToken = oauth2.accessToken.create(result);
    res.status(200).send(result);
  })
  .catch((error) => {
    console.log('Access Token Error', error.message);
    res.status(500).send(error.message);
  });
};

const handleCORS = (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.set('Access-Control-Allow-Credential', true);
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  console.log('method: ' + req.method);
  if (req.method == 'OPTIONS') {
      console.log('OPTIONS');
      res.status(200).send('ok');
  }
}

exports[provider.functionName] = function (req, res) {
  handleCORS(req, res);

  const path = req.path;
  switch(path) {
    case '/auth':
      oauth2InitHandler(req, res);
      break;
    case '/auth/callback':
      oauth2CallbackHandler(req, res);
      break;
    default: 
      res.status(404).send('Not Found');
  }
};
