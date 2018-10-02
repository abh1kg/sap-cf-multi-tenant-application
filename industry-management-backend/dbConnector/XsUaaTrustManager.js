'use strict';

const Promise = require('bluebird');
const request = require('request');
const createHttpError = require('http-errors');
const logger = require('../logger');
const xsenv = require('@sap/xsenv');
const hanaClient = Promise.promisifyAll(require('@sap/hdbext'));

const services = xsenv.readCFServices();
const hanaConfig = services[process.env.TENANT_TRUST_SETUP_INSTANCE].credentials;
const xsuaaCredentials = services[process.env.XSUAA_INSTANCE].credentials;


class XsUaaTrustSetup {
    constructor(subaccountDomain, subaccountId) {
        this.identityZone = subaccountId;
        this.subaccountId = subaccountId.toUpperCase().replace(/-/g, '_');
        this.subaccountDomain = subaccountDomain;
        this.defaultRequest = Promise.promisify(request.defaults({
            json: true,
            followRedirect: false,
            rejectUnauthorized: false,
            method: 'GET',
            baseUrl: `https://${subaccountDomain}.${xsuaaCredentials.uaadomain}`,
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
        let trustMetadata, hanaConnection;
        this._downloadTrustJson()
            .tap(trustJson => trustMetadata = trustJson)
            .then(() => hanaClient.createConnectionAsync(hanaConfig))
            .tap(conn => hanaConnection = conn)
            .then(conn => this._dropOldTrust(conn, trustMetadata))
            .then(() => this._createCertificate(hanaConnection, trustMetadata))
            .then(() => this._createNewTrust(hanaConnection, trustMetadata))
            .then(() => this._createNewJwtProvider(hanaConnection))
            .then(() => this._alterNewJwtProvider(hanaConnection))
            .catch(err => {
                logger.error('error in connecting for establishing trust', err);
                logger.error(`NOTE::: trust for tenant ${this.identityZone} must be set up manually`);
            })
            .finally(() => {
                logger.info('closing hana connection');
                hanaConnection.close();
            })
    }

    destroyTenantTrust() {
        let hanaConnection;
        return hanaClient.createConnectionAsync(hanaConfig)
            .tap(conn => hanaConnection = conn)
            .then(() => this._dropJwtProvider(hanaConnection))
            .catch(err => {
                logger.error('error in destroying tenant trust', err);
                logger.error('NOTE:: The trust configuration for the tenant must be removed offline');
            })
            .finally(() => {
                logger.info('closing hana connection');
                hanaConnection.close();
            })
    }

    _dropJwtProvider(conn) {
        logger.info('dropping jwt provider');
        return conn.prepareAsync('call XSAPPUSER_DROP_PROVIDER(?)')
            .then(stmt => {
                return new Promise((resolve, reject) => {
                    stmt.exec([this.subaccountId], (err, res) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            });
    }

    _alterNewJwtProvider(conn) {
        logger.info('altering jwt provider');
        return conn.prepareAsync('call XSAPPUSER_ALTER_PROVIDER (?,?)')
            .then(stmt => {
                return new Promise((resolve, reject) => {
                    stmt.exec([this.subaccountId, this.subaccountDomain], (err, res) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            });
    }

    _createNewJwtProvider(conn) {
        logger.info('creating jwt provider');
        return conn.prepareAsync('call XSAPPUSER_CREATE_PROVIDER (?,?)')
            .then(stmt => {
                return new Promise((resolve, reject) => {
                    stmt.exec([this.subaccountId, this.subaccountDomain], (err, res) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            });
    }

    _createNewTrust(conn, trustMetadata) {
        logger.info('creating trust metadata with purpose and subject_dn');
        return conn.prepareAsync('call XSAPPUSER_CREATE (?,?)')
            .then(stmt => {
                return new Promise((resolve, reject) => {
                    stmt.exec([trustMetadata.purpose, trustMetadata.subject_dn], (err, res) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            });
    }

    _createCertificate(conn, trustMetadata) {
        logger.info('creating certificate');
        return conn.prepareAsync('call XSAPPUSER_CREATE_CERTIFICATE (?)')
            .then(stmt => {
                return new Promise((resolve, reject) => {
                    stmt.exec([trustMetadata.certificate], (err, res) => {
                        if (err) {
                            if (err.code === 5635) {
                                logger.error('Certificate with hash already exists', err);
                                return resolve();
                            }
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            });
    }

    _dropOldTrust(conn, trustMetadata) {
        logger.info('dropping old trust certificate if found');
        return conn.prepareAsync('call XSAPPUSER_DROP (?,?)')
            .then(stmt => {
                return new Promise((resolve, reject) => {
                    stmt.exec([trustMetadata.purpose, trustMetadata.subject_dn], (err, res) => {
                        if (err) {
                            return reject(err);
                        }
                        return resolve(res);
                    });
                });
            });
    }

    _downloadTrustJson() {
        return this.defaultRequest({}).spread((res, body) => {
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