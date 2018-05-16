'use strict';

let conf = require('./oauth-config');

const FUNCTION_ROOT = conf.get('authProvider');

exports.functionName = FUNCTION_ROOT;
exports.callbackUrl = conf.get('callbackUrl');

exports.credentials = conf.get('credentials');
exports.authorizeUrl = conf.get('authorizeUrl');
