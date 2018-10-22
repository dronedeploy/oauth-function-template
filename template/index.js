require('dotenv').config();
const { createOAuth } = require('@dronedeploy/oauth-function-template');

const configuration = {
  callbackUrl: 'https://dronedeployfunctions.com/{}/auth/callback',
  credentials: {
    auth: {
      authorizeHost: 'https://providername.com  //FILL ME',
      authorizePath: '/static/app-login/index.html  //FILL ME',
      tokenHost: 'https://api.providername.com  //FILL ME',
      tokenPath: '/api/oauth/token  //FILL ME'
    }
  },
  authorizeUrl: {
    scope: 'fields:read',
    page: 'oidcauthn'
  }
};

exports.oauth = createOAuth(configuration);
