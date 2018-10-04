'use strict';

const logger = require('../logger');

class HdbInterface {
    constructor(req) {
        this.db = req.db;
        this.tenantId = req.authInfo.getSubaccountId();
    }

    selectProductsForTenant(callback) {
        const client = this.db;
        client.exec("select SESSION_CONTEXT('COUNTRY') from DUMMY", (err, val) => {
            if (err) {
                logger.error('Error getting session context', err);
                return callback(err);
            }
            logger.info(`session variable for COUNTRY = ${JSON.stringify(val)}`);
            client.exec('select product_id as "product_id", product_name as "product_name", product_description as "product_description", supplier_name as "supplier_name", price as "price", available as "available", quantity as "quantity", country as "country", created_by as "created_by" from "business::PRODUCTS_COUNTRY_VIEW"', (err, res) => {
                if (err) {
                    logger.error(`Error selecting products for tenant ${this.tenantId}`, err);
                    return callback(err);
                }
                logger.info(`Received product list for tenant ${this.tenantId}. Number of products found:`, res.length);
                return callback(null, res);
            });
        });
    }

    insertProductForTenant(name, description, supplier, price, availability, quantity, country, callback) {
        logger.info(`Inserting product with coordinates: ${name}, ${description}, ${supplier}, ${price}, ${availability}, ${quantity}, ${country}`);
        const client = this.db;
        client.prepare("insert into \"business::PRODUCTS\" (product_name, product_description, supplier_name, price, available, quantity, country, created_by) values(?,?,?,?,?,?,?, SESSION_CONTEXT('XS_APPLICATIONUSER'))", (err, stmt) => {
            if (err) {
                logger.error('error constructing prepared statement', err);
                return callback(err);
            }
            stmt.exec([name, description, supplier, price, availability, quantity, country], (err, result) => {
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