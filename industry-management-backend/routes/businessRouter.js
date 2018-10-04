"use strict";

const express = require('express');
const router = express.Router();
const logger = require('../logger');
const HdbInterface = require('../dbConnector/hanaInterface');

function parseAttribute(attrValue) {
    if (attrValue == null) {
        return null;
    }
    if (Array.isArray(attrValue)) {
        attrValue = attrValue.filter(function (value, index, self) {
            return self.indexOf(value) === index;
        });
        return attrValue.join(',');
    } else {
        return attrValue.toString();
    }
}

router.get('/healthcheck', function (req, res) {
    res.status(200).json({
        'healthy': true
    });
});

router.get('/userInfo', function (req, res) {
    logger.info(req.authInfo);
    logger.info('Received request for user info');
    res.status(200).json({
        user: {
            userId: req.authInfo.getLogonName(),
            userName: `${req.authInfo.getGivenName()} ${req.authInfo.getFamilyName()}`,
            emailAddress: req.authInfo.getEmail(),
            country: req.authInfo.getAttribute('Country'),
            countryStr: parseAttribute(req.authInfo.getAttribute('Country')),
            viewer_role: req.authInfo.checkScope('$XSAPPNAME.Viewer'),
            modify_role: req.authInfo.checkScope('$XSAPPNAME.Modify')
        }
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
    if (!req.authInfo.checkScope('$XSAPPNAME.Viewer')) {
        return res.status(401).json({
            "error": 'Unauthorized access'
        });
    }
    logger.info('Received request for selecting products for tenant');
    const tenantDb = new HdbInterface(req);
    tenantDb.selectProductsForTenant((err, rows) => {
        if (err) {
            return res.status(400).send(err.message);
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
    if (!req.authInfo.checkScope('$XSAPPNAME.Modify')) {
        return res.status(401).json({
            "error": 'Unauthorized access'
        });
    }
    logger.info('Received request for inserting product for tenant');
    let name = req.body.name;
    let description = req.body.description;
    let supplier = req.body.supplier;
    let price = parseFloat(req.body.price);
    let availability = (req.body.available === 'true');
    let quantity = parseInt(req.body.quantity);
    let country = req.body.country;

    if (req.authInfo.getAttribute('Country').indexOf(country) < 0) {
        return res.status(403).json({
            'error': `User ${req.authInfo.getEmail()} can only add products for countries: ${parseAttribute(req.authInfo.getAttribute('Country'))}`
        });
    }

    const tenantDb = new HdbInterface(req);
    tenantDb.insertProductForTenant(name, description, supplier, price, availability, quantity, country, (err) => {
        if (err) {
            return res.status(400).send('Error! Could not insert product values');
        }
        return res.status(200).send('Values inserted');
    });
});

module.exports = router;