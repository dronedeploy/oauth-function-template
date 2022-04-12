const TABLE_NAME = "OAuth Table";

const CREATE_TABLE_QUERY = `mutation CreateTable($input: CreateTableInput!) {
  createTable(input: $input) {
    table {
      id
      application {
        id
      }
      name
      description
    }
  }
}`;

const CREATE_TABLE_COLUMN_QUERY = `mutation CreateTableColumn($input: CreateTableColumnInput!) {
  createTableColumn(input: $input) {
    tableColumn {
      id
      name
      description
      ... on NumberColumn {
        type
      }
      ... on TextColumn {
        length
      }
    }
  }
}`;

const FIND_TABLE_QUERY = `{
  node(id: "Application:${global.APP_ID}") {
    ... on Application {
      table(name: "${TABLE_NAME}") {
        id
        name
      }
    }
  }
}`;

const FIND_COLUMNS_QUERY = `{
  node(id: "Application:${global.APP_ID}") {
    ... on Application {
      table(name: "${TABLE_NAME}") {
        name
        columns {
          name
        }
      }
    }
  }
}`;

let ACCESS_TOKEN_COLUMN = {
  input: {
    columnType: "TEXT",
    name: "accessToken",
    textLength: 4096,
    textEncrypted: true,
    description: "Holds the current access token"
  }
};

let TOKEN_EXPIRATION_COLUMN = {
  input: {
    columnType: "DATETIME",
    name: "access_expires_at",
    description: "Holds the date and time at which the current access token expires"
  }
};

let REFRESH_TOKEN_COLUMN = {
  input: {
    columnType: "TEXT",
    name: "refreshToken",
    textLength: 4096,
    textEncrypted: true,
    description: "Holds the current refresh token"
  }
};

let ERROR_CODE_COLUMN = {
  input: {
    columnType: "NUMBER",
    name: "errorCode",
    numberType: 'INTEGER',
    description: "Holds the latest error code"
  }
};

let TABLE_COLUMNS = [
  ACCESS_TOKEN_COLUMN,
  TOKEN_EXPIRATION_COLUMN,
  REFRESH_TOKEN_COLUMN,
  ERROR_CODE_COLUMN,
];

module.exports = {
  createTableColumnQuery: CREATE_TABLE_COLUMN_QUERY,
  createTableQuery: CREATE_TABLE_QUERY,
  findColumnsQuery: FIND_COLUMNS_QUERY,
  findTableQuery: FIND_TABLE_QUERY,
  tableColumns: TABLE_COLUMNS,
  tableName: TABLE_NAME
};
