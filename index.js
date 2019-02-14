'use strict';

global.APP_ID = process.env.APP_ID || undefined;

const bootstrap = require('@dronedeploy/function-wrapper');
const config = require('./config.json');
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

  return handler(paths);
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

const handler = function(paths) {
  return (req, res) => {
    if (!global.APP_ID) {
      const msg = 'App ID not available, did you deploy using DroneDeploy-CLI?';
      console.error(msg);
      res.status(500).send(msg);
    }
    bootstrap(config, req, res, (err, ctx) => {
      if (err) {
        console.error(err, err.stack);
        console.warn('An error occurred during the bootstrapping process. A default response has been sent and code paths have been stopped.');
        return;
      }

      const pathHandler = paths[req.path];
      if (pathHandler) {
        pathHandler(req, res, ctx);
      } else {
        res.status(404).send('Not Found');
      }
    });
  }
};
