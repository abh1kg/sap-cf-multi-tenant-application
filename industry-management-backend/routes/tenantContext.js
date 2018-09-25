'use strict';

const tenantManager = require('../accessors').tenantLifecycleManager;
const logger = require('../logger');

class TenantContext {
    constructor() {

    }

    static injectHdbTenant() {
        return function (req, res, next) {
            const hdbOpts = req.tenantDbOptions;
            logger.info('hdi options for tenant ', hdbOpts);
            // if (hdbOpts) {
            //     return hdbext.middleware(hdbOpts)(req, res, next);
            // }
            return next();
        }
    }

    static getHdbConnectOptions() {
        return function (req, res, next) {
            const securityContext = req.authInfo;
            const tenantId = securityContext.getSubaccountId();
            logger.info('fetching hdi options for ', tenantId);
            if (tenantId) {
                try {
                    const credentials = tenantManager.getCredentialsForTenant(tenantId);
                    req.tenantDbOptions = credentials;
                    logger.info('credentials for hdb connection:', credentials);
                } catch (err) {
                    return next(err);
                }
            }
            return next();
        }
    }
}

module.exports = TenantContext;