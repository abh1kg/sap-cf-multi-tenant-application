'use strict';

const http = require('http');
const logger = require('../logger');
const app = require('../app');

const masterPostgres = require('../dbConnector').masterPostgres;
const tenantConnectionPoolManager = require('../accessors').tenantConnectionPoolSystem;

const port = process.env.PORT || 3000;
app.set('port', port);

const server = http.createServer(app);
server.on('error', onError);
server.on('listening', onListening);

masterPostgres.fetchAllTenants()
  .tap(tenantMappings => logger.info('Retrieved consumer database mappings from Master PostgreSQL instance::', JSON.stringify(tenantMappings)))
  .then(consumerDbMappings => tenantConnectionPoolManager.initializeTenantPools(consumerDbMappings))
  .then(() => {
    server.listen(port);
  });

function onError(err) {
  if (err.syscall !== 'listen') {
    throw err;
  }
  switch (err.code) {
    case 'EACCES':
      logger.error(`Port ${port} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`Port ${port} is already in use`);
      process.exit(1);
      break;
    default:
      throw err;
  }
}

function onListening() {
  logger.info(`Provider application successfully started and listening on port ${port}`);
}