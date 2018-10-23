'use strict';

const _ = require('lodash');
const logger = require('../logger');
const configServer = require('../configServer');
const postgres = require('../dbConnector').postgres;
const TenantDbDeployer = require('./TenantDbDeployer');

const ONBOARDED = 'ONBOARDED';

class TenantLifecycleManager {
    constructor(cloudController) {
        this.cloudController = cloudController;
        this.tenants = {};
        this.cacheLoaded = false;
    }

    addTenantConfigInCache(tenantId, credentials) {
        return configServer.addTenantConfig(tenantId, credentials);
    }

    getCredentialsForTenant(tenantId) {
        return configServer.getCurrentConfiguration(tenantId);
    }

    deleteTenantConfigFromCache(tenantId) {
        return configServer.deleteTenantConfig(tenantId);
    }

    deleteTenantMasterEntry(tenantId) {
        logger.info(`deleting tenant master config for ${tenantId}`);
        return postgres.deleteTenantMetadata(tenantId);
    }

    deployTenantContent(tenantId, credentials) {
        logger.info(`deploying content into postgresql database for ${tenantId}`);
        logger.info(`credentials used: ${credentials.uri}`);

        const dbDeployer = new TenantDbDeployer(tenantId, credentials);
        return dbDeployer.deploy();
    }

    onboardTenant(tenantId, appHostname, cfDomain) {
        logger.info(`onboarding for tenant ${tenantId} started`);
        let tenantCredentials;
        return postgres.fetchTenantMetadata(tenantId)
            .tap(result => {
                tenantCredentials = result[0].credentials;
                logger.info('credentials for tenant database', tenantCredentials);
            })
            .then(() => this.deployTenantContent(tenantId, tenantCredentials))
            .then(() => this.addTenantConfigInCache(tenantId, tenantCredentials))
            .then(() => this.cloudController.mapRoute(appHostname, cfDomain))
            .then(() => postgres.updateTenantMetadata(tenantId, {
                q_sets: {
                    'state': ONBOARDED
                },
                q_wheres: {
                    'consumer_subaccount_id': tenantId
                }
            }))
            .then(() => {
                logger.info(`Onboarding completed for tenant ${tenantId}`);
            });
    }

    offboardTenant(tenantId, appHostname, cfDomain) {
        logger.info(`offboarding tenant ${tenantId}`);
        let instanceId;
        this.cloudController.purgeRoute(appHostname, cfDomain)
            .then(() => this.deleteTenantConfigFromCache(tenantId))
            .then(() => this.cloudController.deleteServiceInstance(instanceId))
            .then(() => this.deleteTenantMasterEntry(tenantId))
            .then(() => logger.info(`Offboarding completed for tenant ${tenantId}`));
    }
}

module.exports = TenantLifecycleManager;