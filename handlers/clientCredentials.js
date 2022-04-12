const oauth2 = require('simple-oauth2');
const tableUtils = require('../datastore/table');


exports.initHandler = function(config) {
  const handlerClass = new ClientCredentialsHandler(config);
  return handlerClass.getRoutes();
};


class ClientCredentialsHandler {
  constructor(config) {
    this.datastoreExternalId = 'clientCredentialsToken';
    this.expirationWindowInSeconds = 300;
    this.tokenConfig = config.get('tokenConfig');
    this.oauth2 = oauth2.create(config.get('credentials'));
  }

  getRoutes() {
    return {
      '/refreshClientCredentials': this.refreshClientCredentialsHandler.bind(this),
    }
  }

  refreshClientCredentialsHandler(req, res, ctx) {
    return tableUtils.setupOAuthTable(ctx)
      .then((tableId) => ctx.datastore.table(tableId))
      .then((table) => {
        return table.getRowByExternalId(this.datastoreExternalId)
          .then((row) => {
            const needRefresh = !row.ok || this.doesTokenNeedRefresh(row.data);
            if (needRefresh) {
              console.log('Client credentials token needs to be refreshed - refreshing.');
              return this.refreshClientCredentials(this.tokenConfig)
                .then((tokenObj) => this.storeClientCredentialsToken(table, tokenObj))
                .then((result) => {
                  console.log('Client credentials token refreshed.');
                  return result;
                });
            }
            console.log('Client credentials are fresh - no need to refresh.');
            return Promise.resolve();
          })
          .then(() => res.status(200).send());
      })
      .catch((error) => {
        const msg = 'Refresh client credentials token failed';
        console.error(msg, error);
        return res.status(500).send(msg);
      });
  }

  refreshClientCredentials(tokenConfig) {
    return this.oauth2.clientCredentials.getToken(tokenConfig)
      .then((result) => this.oauth2.accessToken.create(result))
      .then((accessToken) => ({
        accessToken: accessToken.token.access_token,
        access_expires_at: accessToken.token.expires_at,
        errorCode: null,
        refreshToken: ''
      }));
  }

  doesTokenNeedRefresh(token) {
    const isTokenIncomplete = !token.accessToken || !token.access_expires_at;
    const expirationTimeInSeconds = new Date(token.access_expires_at).getTime() / 1000;
    const nowInSeconds = new Date().getTime() / 1000;
    const shouldRefresh = nowInSeconds >= (expirationTimeInSeconds - this.expirationWindowInSeconds);
    return isTokenIncomplete || shouldRefresh;
  }

  storeClientCredentialsToken(table, token) {
    return table.upsertRow(this.datastoreExternalId, token)
      .then((rowData) => {
        if (!rowData.ok) {
          throw new Error(`An error occured while updating token data in Datastore: ${JSON.stringify(rowData.errors)}`);
        }
      });
  }
}
