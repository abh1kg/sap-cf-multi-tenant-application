'use strict';

const _ = require('lodash');
const logger = require('../logger');

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

module.exports = new QueryBuilder();