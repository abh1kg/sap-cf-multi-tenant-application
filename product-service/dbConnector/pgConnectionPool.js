'use strict';

const PgPool = require('pg-pool');
const xsenv = require('@sap/xsenv');
const PgConnectionConfig = require('./PostgresConnectionConfig');

const postgresqlInstance = process.env.POSTGRES_INSTANCE || 'pg_tenant_manager';
const services = xsenv.readCFServices();
const credentials = services[postgresqlInstance].credentials;
const pgConnector = new PgConnectionConfig(credentials);

//this ensures there's ONLY ONE connection pool object in the entire lifetime of the application for the master instance
//this is critical to ensure we don't end up creating multiple connection pools and exhaust the limited connections
module.exports = new PgPool(pgConnector.config);