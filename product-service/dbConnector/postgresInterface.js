'use strict';

const logger = require('../logger');
const queryBuilder = require('./queryBuilder');

class PostgresInterface {
    constructor(req) {
        this.db = req.db; // contains the connection pool
        this.tenantId = req.authInfo.getSubaccountId();
    }

    selectProductsForTenant() {
        const pool = this.db;
        let pgClient;
        return pool.connect()
            .tap(client => pgClient = client)
            .then(client => client.query('select * from products'))
            .then(res => res.rows)
            .catch(err => {
                logger.error(`selecting all products for subaccount ${this.tenantId} failed`, err);
                throw err;
            })
            .finally(() => pgClient.release());
    }

    insertProductForTenant(opts) {
        logger.info(`Inserting product with coordinates: ${JSON.stringify(opts)}`);
        const pool = this.db;
        let pgClient;
        const command = queryBuilder.parseInsert('products', opts);

        return pool.connect()
            .tap(client => pgClient = client)
            .then(client => client(command.query, command.values))
            .then(res => res.rows)
            .catch(err => {
                logger.error('inserting product for subaccount failed', err);
                throw err;
            })
            .finally(() => pgClient.release());
    }
}

module.exports = PostgresInterface;