"use strict";

const express = require('express');
const router = express.Router();
const accessors = require('../accessors');
const logger = require('../logger');
const tenantLifecycleManager = accessors.tenantLifecycleManager;

const HdbInterface = require('../dbConnector/hanaInterface');
const UI_APP_ROUTE = process.env.UI_APP_ROUTE || 'industrymanagement.cfapps.eu10.hana.ondemand.com';

router.get('/healthcheck', function (req, res) {
	res.status(200).json({
		'healthy': true
	});
});

//Multi Tenant Configuration
//API callback which is invoked by the SaaS provisioning service when a new tenant subscribes to the provider service
router.put('/callback/v1.0/tenants/:tenantId', function (req, res) {
	logger.info(`Request for subscribing received: Tenant ${tenantId}, Tenant Information: ${JSON.stringify(req.body)}`);
	const consumerSubdomain = req.body.subscribedSubdomain;
	const consumerTenantId = req.params.tenantId;

	//Asynchronous provisioning of consumer tenant happens here
	tenantLifecycleManager.onboardTenant(consumerTenantId);
	const tenantUrl = `https://${consumerSubdomain}-${UI_APP_ROUTE}`;
	res.status(200).send(tenantUrl);
});

router.delete('/callback/v1.0/tenants/:tenantId', function (req, res) {
	logger.info(`Request for unsubscribing received: Tenant ${tenantId}, Tenant Information: ${JSON.stringify(req.body)}`);
	const consumerTenantId = req.params.tenantId;
	//Asynchronous deprovisioning of consumer tenant
	tenantLifecycleManager.offboardTenant(consumerTenantId);
	res.status(200).send({});
});

//Database
//------------------------------------------------------------------------------------------------------------
//Database task routes

/* DB Task 1: Select all products for the current tenant
 */
router.get('/dbtask/selectMyProducts', function (req, res) {
	const tenantDb = new HdbInterface(req);
	tenantDb.selectProductsForTenant((err, rows) => {
		if (err) {
			return res.status(400);
		}
		return res.status(200).send(rows);
	});
});

/* DB Task 2: Insert a product into the table for the current tenant
 *  We pass the parameters in the body of our URL call
 */
router.put('/dbtask/insertValues', function (req, res) {
	var name = req.body.name;
	var description = req.body.description;
	var supplier = req.body.supplier;
	var price = parseFloat(req.body.price);
	var availability = (req.body.available === 'true');
	var quantity = parseInt(req.body.quantity);
	const tenantDb = new HdbInterface(req);
	tenantDb.insertProductForTenant(name, description, supplier, price, availability, quantity, (err) => {
		if (err) {
			return res.status(400).send('Error! Could not insert product values');
		}
		return res.status(200).send('Values inserted');
	});
});

module.exports = router;