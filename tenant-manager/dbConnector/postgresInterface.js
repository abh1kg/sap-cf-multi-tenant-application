'use strict';

const logger = require('../logger');
const pool = require('./pgConnectionPool');
const _ = require('lodash');

class QueryBuilder {
    constructor() {}

    parseInsert(table, opts = {}) {
        let columns = [],
            placeholders = [],
            values = [];
        let index = 1;
        _.forEach(opts, (value, key) => {
            columns.push(key);
            values.push(value);
            placeholders.push(`$${index}`);
            index++;
        });
        let queryColumns = `${columns.join(',')}`;
        let queryPlaceholders = `${placeholders.join(',')}`;

        const query = this.getInsertQueryTemplate(table, queryColumns, queryPlaceholders);
        logger.info('query:', query);
        return {
            query,
            values
        };
    }

    parseUpdate(table, opts = {}) {
        const setkeys = [],
            wherekeys = [],
            values = [];
        const qsets = opts.q_sets || {};
        const qwheres = opts.q_wheres || {};

        _.forEach(qsets, (value, key) => {
            values.push(value);
            setkeys.push(key);
        });
        const setClauses = _.map(setkeys, (k, i) => `${k}=$${i+1}`);
        const setString = setClauses.join(', ');

        _.forEach(qwheres, (value, key) => {
            values.push(value);
            wherekeys.push(key);
        });
        const whereClauses = _.map(wherekeys, (k, i) => `${k}=$${setClauses.length + i+1}`).join(' and ');
        const query = this.getUpdateQueryTemplate(table, setString, whereClauses);
        logger.info('query:', query);
        return {
            query,
            values
        };
    }

    getInsertQueryTemplate(tableName, columns = '', placeholders = '') {
        let queryPieces = [`insert into ${tableName}`];
        if (!_.isEmpty(columns.trim())) {
            queryPieces.push(`(${columns})`);
        }
        queryPieces.push('values')
        if (!_.isEmpty(placeholders)) {
            queryPieces.push(`(${placeholders})`);
        }
        return _.join(queryPieces, ' ');
    }

    getUpdateQueryTemplate(tableName, setClause = '', whereClause = '') {
        let queryPieces = [`update ${tableName}`]
        if (!_.isEmpty(setClause.trim())) {
            queryPieces.push(`set ${setClause}`);
        }
        if (!_.isEmpty(whereClause.trim())) {
            queryPieces.push(`where ${whereClause}`);
        }
        return _.join(queryPieces, ' ');
    }
}

class PostgresqlInterface {
    constructor() {
        this.queryBuilder = new QueryBuilder();
    }

    fetchTenantMetadata(subaccountId) {
        let pgClient;
        return pool.connect()
            .tap(client => pgClient = client)
            .then(client => client.query('select * from subscriptions where consumer_subaccount_id=$1', [subaccountId]))
            .then(res => res.rows)
            .catch(e => {
                logger.error('select from subscriptions master table failed', e);
                throw e;
            })
            .finally(() => pgClient.release());
    }

    deleteTenantMetadata(subaccountId) {
        let pgClient;
        return pool.connect()
            .tap(client => pgClient = client)
            .then(client => client.query(`delete from subscriptions where consumer_subaccount_id=$1`, [subaccountId]))
            .catch(e => {
                logger.error(`deleting entry from subscriptions master table failed for subaccount ${subaccountId}`, e);
                throw e;
            })
            .finally(() => pgClient.release());
    }

    updateTenantMetadata(subaccountId, opts = {}) {
        if (_.isNil(opts.q_sets) && _.isNil(opts.q_wheres)) {
            throw new Error('updateTenantMetadata:: invalid arguments');
        }

        let pgClient;
        const command = this.queryBuilder.parseUpdate('subscriptions', opts);

        return pool.connect()
            .tap(client => pgClient = client)
            .then(client => client.query(command.query, command.values))
            .catch(e => {
                logger.error(`updating subscriptions master table failed for subaccount ${subaccountId}`, e);
                throw e;
            })
            .finally(() => pgClient.release());
    }

    addTenantMetadata(opts = {}) {
        if (_.isEmpty(opts)) {
            throw new Error('addTenantMetadata:: invalid arguments');
        }
        const command = this.queryBuilder.parseInsert('subscriptions', opts);
        let pgClient;
        return pool.connect()
            .tap(client => pgClient = client)
            .then(client => client.query(command.query, command.values))
            .catch(e => {
                logger.error('insert into subscriptions master table failed', e);
                throw e;
            })
            .finally(() => pgClient.release());
    }

}

module.exports = new PostgresqlInterface();