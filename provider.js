'use strict';

const base64Url = require('base64url');
const crypto = require('crypto');
const fs = require('fs');

let conf = require('./oauth-config');

const FUNCTION_ROOT = 'ddauth';
const CALLBACK_URL = `http://localhost:8010/clay-test/us-central1/${FUNCTION_ROOT}/auth/callback`
const PROVIDERS_DIRECTORY = './providers';

const md5Hash = (original) => { return crypto.createHash('md5').update(original).digest('hex'); };

// This function should be changed later to read from a Google Cloud
// Storage bucket instead. Doing so would allow us to not have to
// redeploy this function any time a new auth provider is needed
const getProviders = () => {
  var providers = [];

  fs.readdirSync(PROVIDERS_DIRECTORY).forEach((entry) => {
    // Incase we nest directories in the future
    if (!fs.statSync(`${PROVIDERS_DIRECTORY}/${entry}`).isDirectory()) {
      // Strip the file extension
      providers.push(entry.replace(/\.[^/.]+$/, ""));
    }
  });

  return providers;
}

const PROVIDERS = getProviders();

exports.loadConfig = (provider) => {
  conf.loadFile(`${PROVIDERS_DIRECTORY}/${provider}.json`);
  conf.set('authorizeUrl.redirect_uri', CALLBACK_URL);
}

exports.isValidProvider = (provider) => {
  return provider && PROVIDERS.includes(provider);
};

exports.createStateParam = (provider) => {
  return base64Url(md5Hash(provider));
}

exports.getProviderFromState = (state) => {
  const decoded = base64Url.decode(state);

  // This is slightly faulty in that we're only verifying
  // that the decoded hash matches ONE of our auth providers.
  // However, if this state were to be MitM altered AND was
  // changed to a different valid provider, the code for getting
  // the access token would fail validation anyway, so I think
  // we're good.
  for (var i = 0; i < PROVIDERS.length; i++) {
    var provider = PROVIDERS[i];
    var hashed = md5Hash(provider);
    if (hashed === decoded) {
      return provider;
    }
  }
  return undefined;
}

exports.functionName = FUNCTION_ROOT;
exports.callbackUrl = CALLBACK_URL;

exports.credentials = () => {return conf.get('credentials');};
exports.authorizeUrl = () => {return conf.get('authorizeUrl');};

// These could be function-based urls or DD app-base urls or really any url
exports.successUrl = `http://localhost:8010/clay-test/us-central1/${FUNCTION_ROOT}/home`;
