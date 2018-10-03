'use strict';

const logger = require('../logger');

class HdbInterface {
    constructor(req) {
        this.db = req.db;
        this.hanaConfig = req.tenantDbOptions;
        this.tenantId = req.authInfo.getSubaccountId();
    }

    selectProductsForTenant(callback) {
        const client = this.db;
        client.exec('select product_id as "product_id", product_name as "product_name", product_description as "product_description", supplier_name as "supplier_name", price as "price", available as "available", quantity as "quantity", country as "country" from "business::PRODUCTS"', (err, res) => {
            if (err) {
                logger.error(`Error selecting products for tenant ${this.tenantId}`);
                return callback(err);
            }
            logger.info(`Received product list for tenant ${this.tenantId}. Number of products found:`, res.length);
            return callback(null, res);
        });

        // hdbext.createConnection(this.hanaConfig, (err, client) => {
        //     if (err) {
        //         logger.error('error getting hana client connection', err);
        //         return callback(err);
        //     }
        //     client.exec('select product_id as "product_id", product_name as "product_name", product_description as "product_description", supplier_name as "supplier_name", price as "price", available as "available", quantity as "quantity", country as "country" from "business::PRODUCTS"', (err, res) => {
        //         if (err) {
        //             logger.error(`Error selecting products for tenant ${this.tenantId}`);
        //             client.close();
        //             return callback(err);
        //         }
        //         logger.info(`Received product list for tenant ${this.tenantId}. Number of products found:`, res.length);
        //         callback(null, res);
        //         client.close();
        //     });
        // });
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
        // hdbext.createConnection(this.hanaConfig, (err, client) => {
        //     if (err) {
        //         logger.error('error getting hana client connection', err);
        //         return callback(err);
        //     }
        //     client.prepare('insert into "business::PRODUCTS" (product_name, product_description, supplier_name, price, available, quantity) values(?,?,?,?,?,?)', (err, stmt) => {
        //         if (err) {
        //             logger.error('error constructing prepared statement', err);
        //             client.close();
        //             return callback(err);
        //         }
        //         stmt.exec([name, description, supplier, price, availability, quantity], (err, result) => {
        //             if (err) {
        //                 logger.error(`error adding product for tenant ${this.tenantId}`, err);
        //                 return callback(err);
        //             }
        //             logger.info(`product successfully added for tenant ${this.tenantId}`, result);
        //             return callback(null);
        //         });
        //     });
        // });
    }
}

module.exports = HdbInterface;