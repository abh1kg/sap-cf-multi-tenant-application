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
        });
        return postgresMigrator.up()
            .then(() => logger.info('deployment of all database objects completed successfully'))
            .then(() => {
                if (postgresMigrator.driver) {
                    postgresMigrator.driver.close(err => {
                        if (err) {
                            return logger.error('error in closing postgresql connection', err);
                        }
                    });
                }
            })
            .catch(err => {
                logger.error('error deploying objects into PostgreSQL database', JSON.stringify(err));
                throw err;
            })
            .finally(() => logger.info('PostgreSQL migration process completed'))
    }
}

module.exports = TenantObjectDeployer;