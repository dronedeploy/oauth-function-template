'use strict';

const { config } = require('./oauth-config');

exports.callbackUrl = config.get('callbackUrl');
exports.credentials = config.get('credentials');
exports.authorizeUrl = config.get('authorizeUrl');
