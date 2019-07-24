const convict = require('convict');
const stringFormat = require('string-format');

// Define a schema
const SCHEMA = {
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
    options: {
      useBasicAuthorizationHeader: {
        doc: "Whether or not the Basic Authorization header should be sent at the token request",
        format: "Boolean",
        default: undefined
      }
    }
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
  },
  innerAuthorizationUrl: {
    doc: "Fully qualified url for inner authorization request made during refresh",
    format: String,
    default: undefined
  },
  tokenConfig: {
    scope: {
      doc: "Authorization scope being requested from the OAuth provider",
      format: String,
      default: undefined
    }
  },
};

module.exports.createConfig = (configuration) => {
  const config = convict(SCHEMA);
  config.load(configuration);

  if (!(process.env.CLIENT_ID)) {
    throw new Error('CLIENT_ID environment variable not set');
  }
  if (!(process.env.CLIENT_SECRET)) {
    throw new Error('CLIENT_SECRET environment variable not set');
  }

  config.set('credentials.client.id', process.env.CLIENT_ID);
  config.set('credentials.client.secret', process.env.CLIENT_SECRET);

  if (config.get('callbackUrl')) {
    // This formats the callback url dynamically based on the deployed function
    // name. For example the function name of fn-123456789 would be inserted into
    // the templated spot in the callback url https://dronedeployfunctions.com/{}/route
    config.set('callbackUrl', stringFormat(config.get('callbackUrl'), process.env.FUNCTION_NAME));
    config.set('authorizeUrl.redirect_uri', config.get('callbackUrl'));
  }

  return config;
};

