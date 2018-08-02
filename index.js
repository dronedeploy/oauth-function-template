'use strict';

global.APP_SLUG = process.env.APP_SLUG || undefined;

const bootstrap = require('dronedeploy-functions-api');
const config = require('./config.json');
const handler = require('./handler');
const { setConfig } = require('./oauth-config');

const oauth = function (req, res) {
  if (!global.APP_SLUG) {
    const msg = 'App slug not available, did you deploy using DroneDeploy-Cli?';
    console.error(msg);
    res.status(500).send(msg)
  }
  bootstrap(config, req, res, (err, ctx) => {
    if (err) {
      console.error(err, err.stack);
      console.warn('An error occurred during the bootstrapping process. A default response has been sent and code paths have been stopped.');
      return;
    }
    handler.routeHandler(req, res, ctx);
  });
};

exports.createOAuth = function (configuration) {
  addClientSecretsToConfiguration(configuration);
  setConfig(configuration);
  return oauth;
};

const addClientSecretsToConfiguration = (configuration) => {
  const client = {
    id: process.env.CLIENT_ID,
    secret: process.env.CLIENT_SECRET
  };
  configuration.credentials.client = client;
};