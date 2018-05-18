const queries = require('./queries');

// Returns tableId
const _oauthTableSetup = (ctx) => {
  return _createOAuthTableIfNotExists(ctx)
    .catch((err) => {
      throw new Error(err);
    });
};

const _createOAuthTableIfNotExists = (ctx) => {
  return ctx.graphql.query(queries.findTableQuery)
      .then((result) => {        
        if (result.errors && result.data.node.table === null) {
          return _createOAuthTable(ctx)
            .then((tableIdResult) => {
              return createOAuthTableColumns(ctx, tableIdResult);
            });
        }

        return result.data.node.table.id;
      });
};

const _createOAuthTable = (ctx) => {
  const createInput = {
    input: {
      applicationId: `Application:${global.APP_SLUG}`,
      name: queries.tableName,
      description: "Contains token data for OAuth"
    }
  };
  return ctx.graphql.query(queries.createTableQuery, createInput)
    .then((result) => {
      if (result.errors) {
        return Promise.reject(result.errors[0]);
      }

      return result.data.createTable.table.id;
    });
};

const resultContainsError = (result) => {
  return result.errors ? true : false;
}

const createOAuthTableColumns = (ctx, tableId) => {
  var tableColumnQueries = queries.tableColumns.map((columnData) => {
    columnData.input.tableId = tableId;
    return ctx.graphql.query(queries.createTableColumnQuery, columnData);
  });

  return Promise.all(tableColumnQueries)
    .then((results) => {
      if (results.some(resultContainsError)) {
        return Promise.reject('Error creating table columns');
      }
      return tableId;
    });
};

module.exports = {
  setupOAuthTable: _oauthTableSetup
};