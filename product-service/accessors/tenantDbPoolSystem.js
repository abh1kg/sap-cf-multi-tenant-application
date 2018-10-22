'use strict';

const _ = require('lodash');
const PgPool = require('pg-pool');
const dbConnector = require('../dbConnector');
const logger = require('../logger');
const PgConnectionConfig = dbConnector.PostgresConnectionConfig;

class ConnectionPoolWrapper {
    constructor(credentials, pool) {
        this.credentials = credentials;
        this.pool = pool;
    }
}

class TenantDatabasePoolSystem {
    constructor() {
        this.poolCache = {};
    }

    containsSubaccount(tenantId) {
        return this.poolCache.hasOwnProperty(tenantId);
    }

    getConnectionPool(tenantId) {
        return this.poolCache[tenantId].pool;
    }

    cachePooledConnection(tenantId, credentials, connPool) {
        this.poolCache[tenantId] = new ConnectionPoolWrapper(credentials, connPool);
    }

    createPool(tenantId, credentials) {
        logger.info('creating connection pool for tenant:', tenantId);
        const pgConnector = new PgConnectionConfig(credentials);
        const connPool = new PgPool(pgConnector.config);
        this.cachePooledConnection(tenantId, credentials, connPool);
    }

    initializeTenantPools(consumerDatabaseMappings = []) {
        logger.info('initializing all connection pools for onboarded subaccounts');
        _.forEach(consumerDatabaseMappings, (mapping) => this.createPool(mapping.consumer_subaccount_id, mapping.credentials));
    }

    initializeTenantPool(tenantId, credentials) {
        logger.info('initializing connection pool for onboarded subaccount::', tenantId);
        this.createPool(tenantId, credentials);
    }
}

module.exports = new TenantDatabasePoolSystem();