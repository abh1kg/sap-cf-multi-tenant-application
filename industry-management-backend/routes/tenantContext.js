'use strict';

const hdbext = require('@sap/hdbext');
const tenantManager = require('../accessors').tenantLifecycleManager;
const logger = require('../logger');
const attributes = ['Country'];

function parseAttribute(attrValue) {
    if (attrValue == null) {
        return null;
    }
    if (Array.isArray(attrValue)) {
        //make the values unique (required if several role collection mappings exist)
        attrValue = attrValue.filter(function (value, index, self) {
            return self.indexOf(value) === index;
        });
        return attrValue.join(',');
    } else {
        return attrValue.toString();
    }
}

class TenantContext {
    constructor() {

    }

    static injectHdbTenant() {
        return function (req, res, next) {
            const hdbOpts = req.tenantDbOptions;
            logger.info('hdi options for tenant ', hdbOpts);
            if (hdbOpts) {
                return hdbext.middleware(hdbOpts)(req, res, next);
            }
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
                    credentials.session = {};
                    //set session variables here using sessionVariable:KEY = value
                    for (const attr of attributes) {
                        credentials.session[`${attr.toUpperCase()}`] = parseAttribute(securityContext.getAttribute(attr));
                    }
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