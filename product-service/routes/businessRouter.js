"use strict";

const express = require('express');
const router = express.Router();
const logger = require('../logger');
const PostgresInterface = require('../dbConnector/postgresInterface');

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

function getProductOptions(req) {
    return {
        product_name: req.body.name,
        product_description: req.body.description,
        supplier_name: req.body.supplier,
        price: parseFloat(req.body.price),
        available: (req.body.available === 'true'),
        quantity: parseInt(req.body.quantity),
        country: req.body.country,
        created_by: req.authInfo.getEmail()
    };
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
            error: 'Unauthorized access'
        });
    }
    logger.info('Received request for selecting products for tenant');
    const tenantDb = new PostgresInterface(req);
    tenantDb.selectProductsForTenant()
        .then(rows => res.status(200).send(rows))
        .catch(err => res.status(500).send(err.message));
});

/* DB Task 2: Insert a product into the table for the current tenant
 *  We pass the parameters in the body of our URL call
 */
router.put('/insertValues', function (req, res) {
    logger.info(req.authInfo);
    logger.info('scope contained:', req.authInfo.checkScope('$XSAPPNAME.Viewer'));
    if (!req.authInfo.checkScope('$XSAPPNAME.Modify')) {
        return res.status(401).json({
            error: 'Unauthorized access'
        });
    }
    logger.info('Received request for inserting product for tenant');
    const product = getProductOptions(req);

    if (req.authInfo.getAttribute('Country').indexOf(req.body.country) < 0) {
        return res.status(403).json({
            'error': `User ${req.authInfo.getEmail()} can only add products for countries: ${parseAttribute(req.authInfo.getAttribute('Country'))}`
        });
    }

    const tenantDb = new PostgresInterface(req);
    tenantDb.insertProductForTenant(product)
        .then(() => res.status(200).send('Values inserted'))
        .catch(() => res.status(500).send('Error! Could not insert product values'));
});

module.exports = router;