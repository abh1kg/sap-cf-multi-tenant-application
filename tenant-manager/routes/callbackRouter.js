"use strict";

const express = require('express');
const router = express.Router();
const accessors = require('../accessors');
const logger = require('../logger');
const tenantLifecycleManager = accessors.tenantLifecycleManager;

const passport = require('passport');
const xsenv = require('@sap/xsenv');
const JWTStrategy = require('@sap/xssec').JWTStrategy;

const UAA_INSTANCE_NAME = process.env.XSUAA_INSTANCE;
const UI_APP_ROUTE = process.env.UI_APP_ROUTE || 'industrymanagementui.cfapps.eu10.hana.ondemand.com';
const cfDomain = UI_APP_ROUTE.substring(UI_APP_ROUTE.indexOf('.') + 1);
const appPrefix = UI_APP_ROUTE.substring(0, UI_APP_ROUTE.indexOf('.'));

// Protect the backend using xsuaa authorizations
const services = xsenv.getServices({
	uaa: UAA_INSTANCE_NAME
});
passport.use(new JWTStrategy(services.uaa));
router.use(passport.initialize());
router.use(passport.authenticate('JWT', {
	session: false
}));

xsenv.loadEnv();

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
	const tenantId = req.params.tenantId;

	tenantLifecycleManager.onboardTenant(tenantId, `${consumerSubdomain}-${appPrefix}`, cfDomain)
		.then(() => {
			const tenantUrl = `https://${consumerSubdomain}-${UI_APP_ROUTE}`;
			res.status(200).send(tenantUrl);
		})
		.finally(() => logger.info(`subscription processed successfully for ${tenantId}`));
});

router.delete('/v1.0/tenants/:tenantId', function (req, res) {
	logger.info(`Request for unsubscribing received: Tenant ${req.params.tenantId}, Tenant Information: ${JSON.stringify(req.body)}`);
	const consumerTenantId = req.params.tenantId;
	const consumerSubdomain = req.body.subscribedSubdomain;
	//trigger asynchronous deprovisioning of consumer tenant: deprovisioning should continue in the background as deleting Postgres instance 
	//happens asynchronously and can be time consuming
	tenantLifecycleManager.offboardTenant(consumerTenantId, `${consumerSubdomain}-${appPrefix}`, cfDomain);
	res.status(200).send({});
});

module.exports = router;