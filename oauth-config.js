var convict = require('convict');
 
// Define a schema
var config = convict({
  authProvider: {
    doc: "Name of the authorization provider - will be used to set function info",
    format: String,
    default: undefined,
  },
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
    }
  }
});

config.loadFile('./config.json');
config.set('authorizeUrl.redirect_uri', config.get('callbackUrl'));

module.exports = config;