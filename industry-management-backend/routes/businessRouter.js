"use strict";

const express = require('express');
const router = express.Router();
const logger = require('../logger');
const HdbInterface = require('../dbConnector/hanaInterface');

router.get('/healthcheck', function (req, res) {
    res.status(200).json({
        'healthy': true
    });
});

//Database
//------------------------------------------------------------------------------------------------------------
//Database task routes

/* DB Task 1: Select all products for the current tenant
 */
router.get('/selectMyProducts', function (req, res) {
    logger.info(req.authInfo);
    logger.info('scope contained:', req.authInfo.checkScope('$XSAPPNAME.Viewer'));
    if (!req.authInfo.checkScope('$XSAPPNAME.Viewer')){
        return res.status(401).json({"error": 'Unauthorized access'});
    }
    logger.info('Received request for selecting products for tenant');
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
router.put('/insertValues', function (req, res) {
    logger.info(req.authInfo);
    logger.info('scope contained:', req.authInfo.checkScope('$XSAPPNAME.Viewer'));
    if (!req.authInfo.checkScope('$XSAPPNAME.Modify')){
        return res.status(401).json({"error": 'Unauthorized access'});
    }
    logger.info('Received request for inserting product for tenant');
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