'use strict';

const accessors = require('../accessors');
const configServer = accessors.configServer;
const tenantDbPools = accessors.tenantConnectionPoolSystem;

const logger = require('../logger');

class TenantContext {
    constructor() {}

    static injectConnectionPool() {
        return function (req, res, next) {
            const securityContext = req.authInfo;
            const tenantId = securityContext.getSubaccountId();
            logger.info('fetching postgres pool connection for ', tenantId);
            if (tenantId) {
                try {
                    if (tenantDbPools.containsSubaccount(tenantId)) {
                        req.db = tenantDbPools.getConnectionPool(tenantId);
                        return next();
                    } else {
                        //lazy initialization of connection pool
                        //this can also be achieved by using a publish-subscribe messaging topic like RabbitMQ
                        //all app instances can listen to the topic with reliable delivery and perform the same action
                        configServer.getConfiguration(tenantId)
                            .then(tenantDbCredentials => tenantDbPools.initializeTenantPool(tenantId, tenantDbCredentials))
                            .then(() => {
                                req.db = tenantDbPools.getConnectionPool(tenantId);
                                return next();
                            });
                    }
                } catch (err) {
                    return next(err);
                }
            }
        };
    }
}

module.exports = TenantContext;