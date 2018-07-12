const stringFormat = require('string-format');
var convict = require('convict');
 
// Define a schema
var config = convict({
  callbackUrl: {
    doc: "Callback url to be used during the OAuth flow",
    format: String,
    default: undefined
  },
  credentials: {
    client: {
      id: {
        doc: "Client ID value obtained from auth provider for use with APIs",
        format: String,
        sensitive: true,
        default: undefined // We can pull from ENV variables if possible
      },
      secret: {
        doc: "Client Secret value obtained from auth provider for use with APIs",
        format: String,
        sensitive: true,
        default: undefined // We can pull from ENV variables if possible
      }
    },
    auth: {
      authorizeHost: {
        doc: "Base host url for OAuth2 authorization",
        format: String,
        default: undefined
      },
      authorizePath: {
        doc: "Path on base authorizeHost domain for authorization",
        format: String,
        default: undefined
      },
      tokenHost: {
        doc: "Base host url for getting OAuth2 access tokens",
        format: String,
        default: undefined
      },
      tokenPath: {
        doc: "Path on base tokenHost domain for retrieving access tokens",
        format: String,
        default: undefined
      }
    },
  },
  authorizeUrl: {
    redirect_uri: {
      doc: "Fully qualified url for redirect following successful OAuth authorization",
      format: String,
      default: undefined
    },
    scope: {
      doc: "Authorization scope being requested from the OAuth provider",
      format: String,
      default: undefined
    },
    state: {
      doc: "State parameter for oauth 2.0 specification - for DD-based functions, must be stringified JSON because it passes DD JWT data inside",
      format: String,
      default: undefined
    }
  }
});

config.loadFile('./provider-oauth-config.json');
// This formats the callback url dynamically based on the deployed function
// name. For example the function name of fn-123456789 would be inserted into
// the templated spot in the callback url https://dronedeployfunctions.com/{}/route
config.set('callbackUrl', stringFormat(config.get('callbackUrl'), process.env.FUNCTION_NAME));
config.set('authorizeUrl.redirect_uri', config.get('callbackUrl'));

module.exports = config;