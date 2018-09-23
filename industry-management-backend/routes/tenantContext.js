'use strict';

const hdbext = require('@sap/hdbext');
const tenantManager = require('../accessors').tenantLifecycleManager;

class TenantContext {
    constructor() {

    }

    static injectHdbTenant() {
        return function (req, res, next) {
            const hdbOpts = req.tenantDbOptions;
            if (hdbOpts) {
                return hdbext.middleware(req, res, next);
            }
            return next();
        }
    }

    static getHdbConnectOptions() {
        return function (req, res, next) {
            const securityContext = req.authInfo;
            const tenantId = securityContext.getSubaccountId();
            if (tenantId) {
                const credentials = tenantManager.getCredentialsForTenant(tenantId);
                req.tenantDbOptions = credentials;
            }
            return next();
        }
    }
}

module.exports = TenantContext;