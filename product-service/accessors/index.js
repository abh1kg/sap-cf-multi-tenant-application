'use strict';

const tenantDbConnectionPools = require('./tenantDbPoolSystem');
const redisConfigServer = require('./configServer');

exports.configServer = redisConfigServer;
exports.tenantConnectionPoolSystem = tenantDbConnectionPools;