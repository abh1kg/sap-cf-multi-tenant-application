'use strict';

const xsenv = require('@sap/xsenv');
const URI = require('urijs');
const _ = require('lodash');
const Redis = require('ioredis');
const Bluebird = require('bluebird');
const logger = require('../logger');

Redis.Promise = Bluebird;
const redisInstance = process.env.REDIS_INSTANCE || 'redis_instance';
const services = xsenv.readCFServices();
const credentials = services[redisInstance].credentials;

function getRedisConnectionConfig() {
    logger.info('Reading redis connection configurations');
    let config;
    const ianaUrl = credentials.uri;
    const uriObj = new URI(ianaUrl);
    const protocol = uriObj.protocol();
    const password = uriObj.password();
    if (protocol === 'redis-sentinel') {
        //we are using a high-availability cluster plan of redis
        let hosts = _.split(uriObj.hostname(), ',');
        let sentinels = _.map(hosts, (h) => {
            let hostFragments = _.split(h, ':');
            return {
                'host': hostFragments[0],
                'port': hostFragments[1]
            };
        });
        let masterName = uriObj.fragment();
        config = {
            'sentinels': sentinels,
            'name': masterName,
            'password': password,
            'showFriendlyErrorStack': true,
            'enableOfflineQueue': true //enable offline queueing to redis if the server is unavailable
        };
    } else {
        //single node plan
        config = ianaUrl;
    }
    logger.info('Returning redis connection configurations', config);
    return config;
}

class RedisConfigServer {
    constructor() {
        this.connectionConfig = getRedisConnectionConfig();
        this.redis = new Redis(this.connectionConfig);
    }

    getConfiguration(tenantId) {
        return this.redis.get(tenantId)
            .catch(err => {
                logger.error('error getting current configuration for tenant', tenantId);
                throw err;
            });
    }

    addTenantExtensionConfig() {
        //TODO: Put in code for extension config??
    }
}

module.exports = new RedisConfigServer();