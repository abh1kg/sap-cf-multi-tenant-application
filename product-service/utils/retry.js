'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const Continue = require('../models/errors/ContinueWithNext');

class RetryOperation {
    constructor(options) {
        _.assign(this, {
            maxAttempts: 10,
            timeout: Infinity,
            factor: 2,
            minDelay: 1174,
            maxDelay: Infinity,
            fixedDelay: false,
            delay: 30000
        }, options);
    }

    predicate(err) {
        /* jshint unused:false */
        return true;
    }

    backoff(tries) {
        if (tries > 0) {
            return Math.min(this.minDelay * Math.pow(this.factor, tries - 1), this.maxDelay);
        }
        return 0;
    }

    retry(fn) {
        const self = this;
        let tries = 0;

        function attempt() {
            const attemptStart = Date.now();
            return Promise
                .try(() => {
                    return fn(tries);
                })
                .catch(Continue, err => {
                    const now = Date.now();
                    let delay;
                    if (self.fixedDelay) {
                        delay = self.delay;
                    } else {
                        delay = Math.max(self.backoff(++tries) - (now - attemptStart), 0);
                    }
                    if (tries >= self.maxAttempts) {
                        return Promise.reject(new Error('Timeout- number of attempts exceeded'));
                    }
                    if (delay > 0) {
                        return Promise.delay(delay).then(attempt);
                    }
                    return attempt();
                });
        }
        return attempt();
    }

    static create(options) {
        return new RetryOperation(options);
    }

    static retry(fn, options) {
        return RetryOperation.create(options).retry(fn);
    }
}

module.exports = RetryOperation;