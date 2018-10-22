"use strict";

const express = require('express');
const router = express.Router();
const postgres = require('../dbConnector').postgres;
const logger = require('../logger');

const passport = require('passport');
const Strategy = require('passport-http').BasicStrategy;

// Protect the backend using xsuaa authorizations
const basicAuthAdminUser = process.env.BASIC_AUTH_ADMIN_USER || 'admin';
const basicAuthAdminPassword = process.env.BASIC_AUTH_ADMIN_PASSWORD || 'admin';

passport.use(new Strategy(
    function (username, password, cb) {
        if (basicAuthAdminUser === username && basicAuthAdminPassword === password) {
            return cb(null, {});
        }
        return cb(new Error('Forbidden access: Credentials rejected'));
    }));

router.use(passport.authenticate('basic', {
    session: false
}));

router.get('/:subaccountId', function (req, res) {
    const subaccountId = req.params.subaccountId;
    logger.info('Request received for fetching tenant subaccount details', subaccountId);

    return postgres.fetchTenantMetadata(subaccountId)
        .then(result => {
            res.status(200).json(result);
        });
});

router.put('/:subaccountId', function (req, res) {
    const opts = {
        consumer_subaccount_id: req.params.subaccountId,
        consumer_subdomain: req.body.subaccountDomain,
        consumer_subaccount_name: req.body.subaccountName,
        credentials: req.body.credentials
    };
    logger.info('Request received for administering tenant subaccount', opts);

    // call postgres to insert the metadata here
    return postgres.addOrUpdateTenantMetadata(opts)
        .then(() => {
            // we are REST-compliant here
            res.status(201).header('Location', `/admin/subscribers/${req.params.subaccountId}`)
                .json({
                    'status': 'CREATED'
                });
        });
});

module.exports = router;