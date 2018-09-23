'use strict';

const CfUaa = require('./uaa');
const CloudController = require('./cloudController');
const TenantLifecycleManager = require('./tenantLifecycleManager');

const uaa = new CfUaa();
const cloudController = new CloudController(uaa);
const tenantLifecycleManager = new TenantLifecycleManager(cloudController);

// cloudController.createServiceInstanceForTenant("test_tenant1")
//     .then(() => {
//         console.log('done');
//     }).catch(err => {
//         console.error(err);
//     });

exports.cfUaa = uaa;
exports.cloudController = cloudController;
exports.tenantLifecycleManager = tenantLifecycleManager;