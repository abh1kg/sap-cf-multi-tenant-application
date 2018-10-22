'use strict';

const logger = require('../logger');
const pool = require('./pgConnectionPool');
const _ = require('lodash');

class MasterPostgresInterface {
    constructor() {}

    fetchAllTenants() {
        let pgClient;
        return pool.connect()
            .tap(client => pgClient = client)
            .then(client => client.query('select consumer_subaccount_id, credentials from subscriptions where state=$1', ['ONBOARDED']))
            .then(res => res.rows || [])
            .catch(err => {
                logger.error('selecting all onboarded subscriptions failed', err);
                throw err;
            })
            .finally(() => pgClient.release());
    }

    fetchTenantMetadata(subaccountId) {
        let pgClient;
        return pool.connect()
            .tap(client => pgClient = client)
            .then(client => client.query('select * from subscriptions where consumer_subaccount_id=$1', [subaccountId]))
            .then(res => res.rows || [])
            .catch(e => {
                logger.error('select from subscriptions master table failed', e);
                throw e;
            })
            .finally(() => pgClient.release());
    }
}

module.exports = new MasterPostgresInterface();