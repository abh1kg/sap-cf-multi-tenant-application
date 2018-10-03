'use strict';

const Promise = require('bluebird');
const request = require('request');
const createHttpError = require('http-errors');
const logger = require('../logger');

class HttpClient {
    constructor(options, name) {
        this.destination = name;
        this.defaultRequest = Promise.promisify(request.defaults(options), {
            multiArgs: true
        });
    }

    request(options, expectedStatusCode) {
        return this._request(options, expectedStatusCode);
    }

    _request(options, expectedStatusCode) {
        expectedStatusCode = expectedStatusCode || options.expectedStatusCode;
        logger.debug(`Sending HTTP request to destination ${this.destination}`, `${options.method} ${options.url}`);
        return this.defaultRequest(options).spread((res, body) => {
            const result = {
                statusCode: res.statusCode,
                statusMessage: res.statusMessage,
                headers: res.headers,
                body: body
            };
            //logger.debug('Received HTTP response:', result);
            if (expectedStatusCode && res.statusCode !== expectedStatusCode) {
                let message = `Got HTTP Status Code ${res.statusCode} expected ${expectedStatusCode}`;
                logger.error(message, {
                    response: result.body
                });
                throw createHttpError(res.statusCode, message, {
                    expose: true
                });
            }
            return result;
        });
    }
}

module.exports = HttpClient;