const provider = require('./provider');
const oauth2 = require('simple-oauth2').create(provider.credentials);

// Initializes the OAuth2 flow - successful authorization results in redirect to callback export
const oauth2InitHandler = (req, res, ctx) => {
  var urlObj = provider.authorizeUrl;
  urlObj.redirect_uri += '?jwt_token=' + ctx.originalToken;
  const authorizationUri = oauth2.authorizationCode.authorizeURL(urlObj);
  res.send(authorizationUri);
};

// Callback handler to take the auth code from first OAuth2 step and get the tokens
const oauth2CallbackHandler = (req, res, ctx) => {
  const tokenConfig = {
    code: req.query.code,
    redirect_uri: provider.callbackUrl + '?jwt_token=' + ctx.originalToken
  };

  // Save the access token
  oauth2.authorizationCode.getToken(tokenConfig)
  .then((result) => {
    // Result will contain: user, access token and refresh token
    // This create call handles keeping tokens for us in this accessToken object,
    // but in reality, we would want to save in datastore
    const accessToken = oauth2.accessToken.create(result);
    // For now just send raw result back to client
    res.status(200).send(result);
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
