"use strict";

const express = require('express');
const router = express.Router();
const accessors = require('../accessors');
const logger = require('../logger');
const tenantLifecycleManager = accessors.tenantLifecycleManager;

const UI_APP_ROUTE = process.env.UI_APP_ROUTE || 'industrymanagementui.cfapps.eu10.hana.ondemand.com';

router.get('/healthcheck', function (req, res) {
	res.status(200).json({
		'healthy': true
	});
});

//Multi Tenant Configuration
//API callback which is invoked by the SaaS provisioning service when a new tenant subscribes to the provider service
router.put('/v1.0/tenants/:tenantId', function (req, res) {
	logger.info(`Request for subscribing received: Tenant ${req.params.tenantId}, Tenant Information: ${JSON.stringify(req.body)}`);
	const consumerSubdomain = req.body.subscribedSubdomain;
	const consumerTenantId = req.params.tenantId;

	//Asynchronous provisioning of consumer tenant happens here
	tenantLifecycleManager.onboardTenant(consumerTenantId, consumerSubdomain);
	const tenantUrl = `https://${consumerSubdomain}-${UI_APP_ROUTE}`;
	res.status(200).send(tenantUrl);
});

router.delete('/v1.0/tenants/:tenantId', function (req, res) {
	logger.info(`Request for unsubscribing received: Tenant ${req.params.tenantId}, Tenant Information: ${JSON.stringify(req.body)}`);
	const consumerTenantId = req.params.tenantId;
	const consumerSubdomain = req.body.subscribedSubdomain;
	//Asynchronous deprovisioning of consumer tenant
	tenantLifecycleManager.offboardTenant(consumerTenantId, consumerSubdomain);
	res.status(200).send({});
});

module.exports = router;