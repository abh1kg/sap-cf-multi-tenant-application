'use strict';

const logger = require('../logger');

class HdbInterface {
    constructor(req) {
        this.db = req.db;
        this.tenantId = req.authInfo.getSubaccountId();
    }

    selectProductsForTenant(callback) {
        const client = this.db;
        client.exec('select * from "business::PRODUCTS"', (err, res) => {
            if (err) {
                logger.error(`Error selecting products for tenant ${this.tenantId}`);
                return callback(err);
            }
            logger.info(`Received product list for tenant ${this.tenantId}. Number of products found:`, res.length);
            callback(null, res);
        });
    }

    insertProductForTenant(name, description, supplier, price, availability, quantity, callback) {
        const client = this.db;
        client.prepare('insert into "business::PRODUCTS" (product_name, product_description, supplier_name, price, available, quantity) values(?,?,?,?,?,?)', (err, stmt) => {
            if (err) {
                logger.error('error constructing prepared statement', err);
                return callback(err);
            }
            stmt.exec([name, description, supplier, price, availability, quantity], (err, result) => {
                if (err) {
                    logger.error(`error adding product for tenant ${this.tenantId}`, err);
                    return callback(err);
                }
                logger.info(`product successfully added for tenant ${this.tenantId}`, result);
                return callback(null);
            });
        });
    }
}

module.exports = HdbInterface;