'use strict';

global.APP_ID = process.env.APP_ID || undefined;

const bootstrap = require('@dronedeploy/function-wrapper');
const { createConfig } = require('./oauth-config');

const authorizationCode = require('./handlers/authorizationCode');
const clientCredentials = require('./handlers/clientCredentials');

exports.createOAuth = function(configuration) {
  const { authorizationCodeSettings, clientCredentialsSettings } = parseConfig(configuration);
  let paths = {};

  if (authorizationCodeSettings) {
    paths = authorizationCode.initHandler(createConfig(authorizationCodeSettings));
  }

  if (clientCredentialsSettings) {
    paths = Object.assign(paths, clientCredentials.initHandler(createConfig(clientCredentialsSettings)));
  }

  return createHandler(paths);
};

const parseConfig = function (configuration) {
  const newConfigFormat = configuration.clientCredentialsSettings || configuration.authorizationCodeSettings;
  if (newConfigFormat) {
    return {
      clientCredentialsSettings: configuration.clientCredentialsSettings,
      authorizationCodeSettings: configuration.authorizationCodeSettings,
    }
  }
  return {
    authorizationCodeSettings: configuration
  };
};

function createHandler(paths) {
  process.env.IGNORE_AUTH_ROUTES = ['/auth/callback'];
  return bootstrap((ctx) =>
    (req, res) => {
      console.log(`Request received to endpoint: ${req.method} ${req.originalUrl}`);
      const pathHandler = paths[req.path];
      if (pathHandler) {
        pathHandler(req, res, ctx);
      } else {
        res.status(404).send('Not Found');
      }
    });
}
