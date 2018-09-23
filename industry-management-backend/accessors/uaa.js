'use strict';

const HttpClient = require('./HttpClient');
const logger = require('../logger');
const OAuthToken = require('../models/JwtToken');
const Promise = require('bluebird');
const jwtToken = new OAuthToken();

class UaaClient extends HttpClient {
    constructor() {
        super({
            headers: {
                'Accept': 'application/json'
            },
            followRedirect: false,
            baseUrl: process.env.UAA_ENDPOINT || "https://login.cf.eu10.hana.ondemand.com",
            rejectUnauthorized: false
        }, 'cf_uaa');
        this.clientId = 'cf';
        this.secret = '';
        this.username = process.env.SPACE_DEVELOPER_USER;
        this.password = process.env.SPACE_DEVELOPER_PASSWORD;
    }

    getAccessToken() {
        if (!jwtToken.accessTokenExpiresSoon) {
            return Promise.resolve(jwtToken.accessToken);
        }
        return Promise.try(() => {
                return this._retrieveToken();
            })
            .then(tokenResponse => jwtToken.update(tokenResponse).accessToken);
    }

    _retrieveToken() {
        return this.request({
            method: 'POST',
            url: '/oauth/token',
            auth: {
                user: this.clientId,
                pass: this.secret
            },
            json: true,
            form: {
                grant_type: 'password',
                client_id: this.clientId,
                username: this.username,
                password: this.password
            }
        }, 200).then((res) => {
            logger.debug(res.body);
            return res.body;
        });
    }
}

module.exports = UaaClient;