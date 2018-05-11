'use strict';

const provider = require('./provider');

// Initializes the OAuth2 flow - successful authorization results in redirect to callback export
const oauth2InitHandler = (req, res, authProvider) => {
  if (!provider.isValidProvider(req.query.provider)) {
    return res.status(400).send('Invalid Auth Provider');
  }

  var authProvider = req.query.provider;
  provider.loadConfig(authProvider);

  var oauth2 = require('simple-oauth2').create(provider.credentials());

  // We set state on the authorize url because state will be returned to the callback
  // unmodified, so we can use this to validate and load proper config on callback
  let authUrl = provider.authorizeUrl();
  authUrl.state = provider.createStateParam(authProvider);
  
  const authorizationUri = oauth2.authorizationCode.authorizeURL(authUrl);
  res.redirect(authorizationUri);
};

// Callback handler to take the auth code from first OAuth2 step and get the tokens
const oauth2CallbackHandler = (req, res) => {

  var authProvider = provider.getProviderFromState(req.query.state);

  if (!authProvider) {
    return res.status(400).send('Invalid Auth Provider');
  }

  provider.loadConfig(authProvider);

  var oauth2 = require('simple-oauth2').create(provider.credentials());

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
      // res.redirect(provider.successUrl);
    })
    .catch((error) => {
      console.log('Access Token Error', error.message);
      res.status(500).send(error.message);
    });
};

exports[provider.functionName] = function (req, res) {
  const path = req.path;
  switch(path) {
    case '/auth':
      oauth2InitHandler(req, res);
      break;
    case '/auth/callback':
      oauth2CallbackHandler(req, res);
      break;
    case '/home':
      res.send('<h1>SUCCESS</h1>')
      break;
    default: 
      res.status(404).send('Not Found');
  }
};
