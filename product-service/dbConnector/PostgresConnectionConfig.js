'use strict';

/**
 * This defines the Postgres Connection Configuration for the a PostgreSQL instance
 */

const _ = require('lodash');
const Bluebird = require('bluebird');
const logger = require('../logger');

function getPoolConfig() {
    let pgPoolConfig = process.env.PGPOOL_CONFIG;
    let defaultPoolConfig = {
        max: 10, // set pool max size to 20
        min: 4, // set min pool size to 4
        idleTimeoutMillis: 60 * 1000, // close idle clients after 60 seconds
        connectionTimeoutMillis: 5 * 1000, // return an error after 5 seconds if connection could not be established
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
    constructor(credentials) {
        this.credentials = credentials;
        this.poolConfig = getPoolConfig();
    }

    get database() {
        return this.credentials.dbname;
    }

    get host() {
        return this.credentials.hostname;
    }

    get port() {
        return this.credentials.port;
    }

    get user() {
        return this.credentials.username;
    }

    get password() {
        return this.credentials.password;
    }

    get config() {
        logger.info(`credentials: ${JSON.stringify(this.credentials)}`);
        let dbConfig = {
            database: this.database,
            user: this.user,
            password: this.password,
            port: this.port,
            host: this.host
        };
        logger.info('credentials for master postgresql db config', JSON.stringify(dbConfig));
        let poolConfig = this.poolConfig;
        return _.defaults(dbConfig, poolConfig);
    }
}

module.exports = PostgresConnectionConfig;