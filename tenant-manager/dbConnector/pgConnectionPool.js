'use strict';

const PgPool = require('pg-pool');
const pgConnectionConfig = require('./pgConnectionConfig');

const connectionPool = new PgPool(pgConnectionConfig.config);

//this ensures there's ONLY ONE connection pool object in the entire lifetime of the application
//this is critical to ensure we don't end up creating multiple connection pools and exhaust the limited connections
module.exports = connectionPool;