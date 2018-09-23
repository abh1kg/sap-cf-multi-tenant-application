'use strict';

const HttpClient = require('./HttpClient');
const _ = require('lodash');
const Promise = require('bluebird');
const RetryOperation = require('../utils/retry');
const Continue = require('../models/errors/ContinueWithNext');

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
            .then(res => res.entity.credentials)
            .then(credentials => {
                return {
                    tenantId: tenantId,
                    credentials: credentials
                };
            });
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
                    accepts_incomplete: true
                },
                auth: {
                    bearer: token
                },
                json: true
            }, 202));
    }
}

module.exports = CloudControllerClient;