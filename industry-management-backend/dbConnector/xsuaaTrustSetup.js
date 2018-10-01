'use strict';

const Promise = require('bluebird');
const request = require('request');
const createHttpError = require('http-errors');
const logger = require('../logger');
const xsenv = require('@sap/xsenv');

const services = xsenv.readCFServices();
const xsuaaCredentials = services[process.env.XSUAA_INSTANCE].credentials;


class XsUaaTrustSetup {
    constructor(subaccountName, subaccountId) {
        this.subaccountId = subaccountId;
        this.subaccountName = subaccountName;
        this.defaultRequest = Promise.promisify(request.defaults({
            json: true,
            followRedirect: false,
            rejectUnauthorized: false,
            method: 'GET',
            baseUrl: `https://${subaccountName}.${xsuaaCredentials.uaaDomain}`,
            url: '/sap/trust/jwt',
            headers: {
                'content-type': 'application/json; charset=utf-8',
                'accept': 'application/json'
            }
        }), {
            multiArgs: true
        });
    }

    establishTenantTrust() {
        this._downloadTrustJson()
            .then(trustJson => {

            });
    }

    _downloadTrustJson() {
        this.defaultRequest({}).spread((res, body) => {
            logger.debug('received response', body);
            if (res.statusCode !== 200) {
                let message = `Got HTTP Status Code ${res.statusCode} expected 200`;
                logger.error(message, {
                    response: body
                });
                throw createHttpError(res.statusCode, message, {
                    expose: true
                });
            }
            return body;
        });
    }
}

module.exports = XsUaaTrustSetup;