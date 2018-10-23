'use strict';

const DbMigrate = require('db-migrate');
const path = require('path');
const logger = require('../logger');

class TenantObjectDeployer {
    constructor(subaccountId, credentials) {
        this.subaccountId = subaccountId;
        this.credentials = credentials;
        this.dbUrl = credentials.uri;
        this.pgConfig = {
            dev: credentials.uri
        };
    }

    deploy() {
        const postgresMigrator = DbMigrate.getInstance(true, {
            'throwUncatched': true,
            'cwd': path.join(__dirname, '..'),
            'sql-file': true,
            'config': this.pgConfig
        }, (migrator) => {
            logger.info('closing PostgreSQL connection for deploying content...');
            migrator.driver.close(function (err) {
                if (err){
                    logger.error('error in driver close', err);
                }
                logger.info('Done with object migrations onto PostgreSQL');
            });
        });
        return postgresMigrator.up()
            .then(() => logger.info('deployment of all database objects completed successfully'))
            .catch(err => {
                logger.error('error deploying objects into PostgreSQL database', JSON.stringify(err));
                throw err;
            })
            .finally(() => logger.info('PostgreSQL migration process completed'))
    }
}

module.exports = TenantObjectDeployer;