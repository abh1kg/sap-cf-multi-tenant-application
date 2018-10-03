'use strict';

const HttpClient = require('./HttpClient');
const _ = require('lodash');
const Promise = require('bluebird');
const logger = require('../logger');
const RetryOperation = require('../utils/retry');
const Continue = require('../models/errors/ContinueWithNext');

const appName = process.env.UI_APP_NAME || 'industrymanagementui';
const spaceId = JSON.parse(process.env.VCAP_APPLICATION).space_id;

class CloudControllerClient extends HttpClient {
    constructor(uaa) {
        super({
            headers: {
                Accept: 'application/json'
            },
            followRedirect: false,
            baseUrl: process.env.CF_API || "https://api.cf.eu10.hana.ondemand.com",
            rejectUnauthorized: false
        }, 'cloud_controller');
        this.cfUaa = uaa;
    }

    purgeRoute(hostname, domain) {
        logger.info(`Purging route with host ${hostname}, domain ${domain}`);
        return this.getDomain(domain)
            .then(domainId => this.getRoute(domainId, hostname))
            .tap(routeId => logger.info(`received route id ${routeId}`))
            .then(routeId => this.deleteRoute(routeId));
    }

    deleteRoute(routeId) {
        logger.info(`Deleting route with routeId ${routeId}`);
        return this.cfUaa.getAccessToken()
            .then(token => this.request({
                method: 'DELETE',
                url: `/v2/routes/${routeId}`,
                auth: {
                    bearer: token
                },
                qs: {
                    recursive: true,
                    async: false
                }
            }, 204));
    }

    getRoute(domainId, hostname) {
        logger.info(`fetching route information for domain ${domainId} and host ${hostname}`)
        return this.cfUaa.getAccessToken()
            .then(token => this.request({
                method: 'GET',
                url: '/v2/routes',
                auth: {
                    bearer: token
                },
                qs: {
                    q: [`domain_guid:${domainId}`, `host:${hostname}`]
                },
                useQuerystring: true
            }, 200))
            .then(res => {
                let matchedRoutes = JSON.parse(res.body);
                if (matchedRoutes.total_results !== 1) {
                    throw new Error(`Route URL with domain id ${domainId} and ${hostname} not found`);
                }
                let resRoute = matchedRoutes.resources[0];
                return resRoute.metadata.guid;
            });
    }

    getDomain(domain) {
        logger.info(`fetching domain information for domain ${domain}`)
        return this.cfUaa.getAccessToken()
            .then(token => this.request({
                method: 'GET',
                url: '/v2/domains',
                auth: {
                    bearer: token
                },
                qs: {
                    q: `name:${domain}`
                }
            }, 200))
            .then(res => {
                let matchedDomains = JSON.parse(res.body);
                if (matchedDomains.total_results !== 1) {
                    throw new Error(`Domain URL ${domain} not found`);
                }
                let resDomain = matchedDomains.resources[0];
                return resDomain.metadata.guid;
            });
    }

    getApp(appName) {
        logger.info(`fetching app information for ${appName}`);
        return this.cfUaa.getAccessToken()
            .then(token => this.request({
                method: 'GET',
                url: '/v2/apps',
                auth: {
                    bearer: token
                },
                qs: {
                    q: [`name:${appName}`, `space_guid:${spaceId}`]
                },
                useQuerystring: true,
                json: true
            }, 200))
            .then(res => {
                let matched = res.body;
                if (matched.total_results !== 1) {
                    throw new Error(`App ${appName} not found`);
                }
                let app = matched.resources[0];
                return app.metadata.guid;
            })
    }

    mapRoute(hostname, domain) {
        logger.info(`mapping app to route with hostname ${hostname} and domain ${domain}`);
        let routeId;
        return this.getDomain(domain)
            .then(domainId => this.createRoute(domainId, spaceId, hostname))
            .tap(rid => routeId = rid)
            .then(() => this.getApp(appName))
            .then(appId => this.associateRouteToApp(routeId, appId));
    }

    associateRouteToApp(routeId, applicationId) {
        logger.info(`associating route ${routeId} to app ${applicationId}`)
        return this.cfUaa.getAccessToken()
            .then(token => this.request({
                method: 'PUT',
                url: `/v2/routes/${routeId}/apps/${applicationId}`,
                auth: {
                    bearer: token
                },
                json: true
            }, 201));
    }

    createRoute(domainId, spaceId, host) {
        logger.info(`creating route with coordinates ${domainId}, ${spaceId}, ${host}`);
        return this.cfUaa.getAccessToken()
            .then(token => this.request({
                method: 'POST',
                url: '/v2/routes',
                auth: {
                    bearer: token
                },
                body: {
                    domain_guid: domainId,
                    space_guid: spaceId,
                    host: host
                },
                json: true
            }, 201))
            .then(routeResponse => routeResponse.body.metadata.guid);
    }

    getServiceId(serviceName) {
        return this.cfUaa.getAccessToken()
            .then(token => this.request({
                method: 'GET',
                url: '/v2/services',
                auth: {
                    bearer: token
                },
                qs: {
                    q: `label:${serviceName}`
                }
            }, 200))
            .then(res => {
                let matchedServices = JSON.parse(res.body);
                if (matchedServices.total_results !== 1) {
                    throw new Error(`Service ${serviceName} not found`);
                }
                let service = matchedServices.resources[0];
                return service.metadata.guid;
            });
    }

    getServicePlan(serviceId, plan) {
        return this.cfUaa.getAccessToken()
            .then(token => this.request({
                method: 'GET',
                url: `/v2/services/${serviceId}/service_plans`,
                auth: {
                    bearer: token
                }
            }, 200))
            .then(res => JSON.parse(res.body))
            .then(res => {
                let resources = res.resources;
                for (let r of resources) {
                    if (r.entity.name === plan) {
                        return r.metadata.guid;
                    }
                }
                throw new Error('Service plan not found');
            });
    }

    getSpaceId() {
        const vcapApp = process.env.VCAP_APPLICATION;
        return JSON.parse(vcapApp).space_id;
    }

    createInstance(instanceName, planId, params) {
        return this.cfUaa.getAccessToken()
            .then(token => this.request({
                method: 'POST',
                url: '/v2/service_instances',
                qs: {
                    accepts_incomplete: true
                },
                auth: {
                    bearer: token
                },
                body: {
                    name: instanceName,
                    service_plan_guid: planId,
                    space_guid: this.getSpaceId(),
                    parameters: params || {}
                },
                json: true
            }, 202));
    }

    getAllServiceKeys(instanceId) {
        return this.cfUaa.getAccessToken()
            .then(token => this.request({
                method: 'GET',
                url: `/v2/service_keys`,
                auth: {
                    bearer: token
                },
                qs: {
                    q: `service_instance_guid:${instanceId}`
                },
                json: true
            }, 200))
            .then(response => response.body.resources)
            .then(resources => {
                const keys = [];
                for (let r of resources) {
                    keys.push(r.metadata.guid);
                }
                return keys;
            });
    }

    deleteAllServiceKeys(instanceId) {
        return this.getAllServiceKeys(instanceId)
            .then(keys => {
                let promises = [];
                for (let keyId of keys) {
                    promises.push(this.deleteServiceKey(keyId));
                }
                return Promise.all(promises);
            });
    }

    createServiceKey(instanceId, key) {
        return this.cfUaa.getAccessToken()
            .then(token => this.request({
                method: 'POST',
                url: '/v2/service_keys',
                body: {
                    service_instance_guid: instanceId,
                    name: key
                },
                auth: {
                    bearer: token
                },
                json: true
            }, 201));
    }

    getServiceInstanceState(instanceId, expectedStatus = 200) {
        return this.cfUaa.getAccessToken()
            .then(token => this.request({
                method: 'GET',
                url: `/v2/service_instances/${instanceId}`,
                auth: {
                    bearer: token
                },
                json: true
            }, expectedStatus))
            .then(res => res.body);
    }

    getTenantCredentials(tenantId, keyId) {
        return this.getServiceKey(keyId)
            .then(res => res.entity.credentials);
    }

    getServiceKey(keyId) {
        return this.cfUaa.getAccessToken()
            .then(token => this.request({
                method: 'GET',
                url: `/v2/service_keys/${keyId}`,
                auth: {
                    bearer: token
                },
                json: true
            }, 200))
            .then(res => res.body);
    }

    isInstanceCreated(instanceId) {
        return this.getServiceInstanceState(instanceId)
            .then(res => {
                const opState = res.entity.last_operation.state;
                const opType = res.entity.last_operation.type;
                if (opType === 'create' && opState === 'in progress') {
                    throw new Continue(`Instance creation in progress for ${instanceId}`);
                }
                if (opType === 'create' && opState === 'failed') {
                    throw new Error(`Instance creation failed for ${instanceId}`);
                }
                return instanceId;
            });
    }

    waitForInstance(instanceId) {
        const retryOp = RetryOperation.create({
            fixedDelay: true
        });
        return retryOp.retry(_.bind(this.isInstanceCreated, this, instanceId));
    }

    createServiceInstanceForTenant(tenantId) {
        const instanceName = `tenant-${tenantId}`;

        return Promise.try(() => {
                return this.getServiceId('hana');
            })
            .then(hdiServiceId => {
                return this.getServicePlan(hdiServiceId, 'hdi-shared');
            })
            .then(planId => {
                return this.createInstance(instanceName, planId, {
                    'database_id': process.env.HANA_DBAAS_INSTANCE_ID //3cd8628e-87c0-4d2f-9472-33ccb1c984f6
                });
            })
            .then(res => res.body)
            .then(res => {
                const generatedInstanceId = res.metadata.guid;
                return this.waitForInstance(generatedInstanceId);
            });
    }

    deleteServiceKey(keyId) {
        return this.cfUaa.getAccessToken()
            .then(token => this.request({
                method: 'DELETE',
                url: `/v2/service_keys/${keyId}`,
                auth: {
                    bearer: token
                },
                json: true
            }, 204));
    }

    deleteServiceInstance(instanceId) {
        return this.cfUaa.getAccessToken()
            .then(token => this.request({
                method: 'DELETE',
                url: `/v2/service_instances/${instanceId}`,
                qs: {
                    accepts_incomplete: true,
                    recursive: true
                },
                auth: {
                    bearer: token
                },
                json: true
            }, 202));
    }
}

module.exports = CloudControllerClient;