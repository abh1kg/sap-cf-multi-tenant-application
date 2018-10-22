'use strict';

const xsenv = require('@sap/xsenv');
const _ = require('lodash');
const logger = require('../logger');
const Bluebird = require('bluebird');

const postgresqlInstance = process.env.POSTGRES_INSTANCE || 'pg_tenant_metadata';

const services = xsenv.readCFServices();
const credentials = services[postgresqlInstance].credentials;

function getPoolConfig() {
    let pgPoolConfig = process.env.PGPOOL_CONFIG;
    let defaultPoolConfig = {
        max: 20, // set pool max size to 20
        min: 4, // set min pool size to 4
        idleTimeoutMillis: 60 * 1000, // close idle clients after 60 seconds
        connectionTimeoutMillis: 2 * 1000, // return an error after 2 seconds if connection could not be established
        Promise: Bluebird
    };
    if (_.isNil(pgPoolConfig)) {
        return defaultPoolConfig;
    }
    try {
        let parsedPoolConfig = JSON.parse(pgPoolConfig);
        return _.defaults(parsedPoolConfig, defaultPoolConfig);
    } catch (e) {
        logger.error('Invalid JSON structure for pool configuration');
        return defaultPoolConfig;
    }

}

class PostgresConnectionConfig {
    constructor() {
        this.poolConfig = getPoolConfig();
    }

    get database() {
        return credentials.dbname;
    }

    get host() {
        return credentials.hostname;
    }

    get port() {
        return credentials.port;
    }

    get user() {
        return credentials.username;
    }

    get password() {
        return credentials.password;
    }

    get config() {
        let dbConfig = {
            database: this.database,
            user: this.user,
            password: this.password,
            port: this.port,
            host: this.host
        };
        let poolConfig = this.poolConfig;
        return _.defaults(dbConfig, poolConfig);
    }
}

module.exports = new PostgresConnectionConfig();