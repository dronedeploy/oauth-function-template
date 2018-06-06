'use strict';

let conf = require('./oauth-config');

exports.callbackUrl = conf.get('callbackUrl');

exports.credentials = conf.get('credentials');
exports.authorizeUrl = conf.get('authorizeUrl');
