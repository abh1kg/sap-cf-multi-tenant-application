'use strict';

const CfUaa = require('./uaa');
const CloudController = require('./cloudController');
const TenantLifecycleManager = require('./tenantLifecycleManager');

const uaa = new CfUaa();
const cloudController = new CloudController(uaa);
const tenantLifecycleManager = new TenantLifecycleManager(cloudController);

exports.cfUaa = uaa;
exports.cloudController = cloudController;
exports.tenantLifecycleManager = tenantLifecycleManager;
exports.TenantDbDeployer = require('./TenantDbDeployer');