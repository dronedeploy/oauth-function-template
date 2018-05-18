'use strict';
require('dotenv').config()
const bootstrap = require('dronedeploy-functions-api');
const provider = require('./provider');
const handler = require('./handler');

global.APP_SLUG = '<replace with your app slug>';

let config = require('./config.json');

exports[provider.functionName] = function (req, res) {
  bootstrap(config, req, res, (err, ctx) => {
    if (err) {
      console.error(err, err.stack);
      console.warn('An error occurred during the bootstrapping process. A default response has been sent and code paths have been stopped.');
      return;
    }
    handler.routeHandler(req, res, ctx);

  });
}
