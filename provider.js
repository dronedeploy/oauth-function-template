'use strict';

let conf = require('./oauth-config');

const FUNCTION_ROOT = conf.get('authProvider');

exports.functionName = FUNCTION_ROOT;
exports.callbackUrl = conf.get('callbackUrl');

exports.credentials = conf.get('credentials');
exports.authorizeUrl = conf.get('authorizeUrl');

// These could be function-based urls or DD app-base urls or really any url
exports.successUrl = `http://localhost:8010/clay-test/us-central1/${FUNCTION_ROOT}/home`;
