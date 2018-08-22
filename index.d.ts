declare module 'oauth-function-template' {
  interface Configuration {
    callbackUrl: string;
    credentials: {
      auth: {
        authorizeHost: string,
        authorizePath: string,
        tokenHost: string,
        tokenPath: string,
      },
    };
    authorizeUrl: {
      scope: string,
    };
  }
  export const createOAuth: (configuration: Configuration) => Function;
}