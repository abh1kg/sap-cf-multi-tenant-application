'use strict';

const _ = require('lodash');
const winston = require('winston');

const transports = [
    new winston.transports.Console({
        level: process.env.LOG_LEVEL || 'debug',
        silent: _.includes(['production', 'test'], process.env.NODE_ENV),
        prettyPrint: true,
        colorize: true,
        timestamp: true
    })
];

class Stream {
    constructor(logger) {
        this.logger = logger;
    }
    write(message, encoding) {
        /* jshint unused:false */
        this.logger.info(message);
    }
}

const logger = new winston.Logger({
    transports: transports,
    exitOnError: true
});
logger.stream = new Stream(logger);

module.exports = logger;