## Product Backend Microservice

This directory represents a sample backend service on the Cloud Foundry platform. Incidentally, the service here implements a product catalog 
and exposes OAuth-protected REST APIs that allow authorized users to add and view products for their individual consumer accounts. The service 
is inherently multi-tenant aware.

### Technologies & Libraries used

- The backend service is implemented using NodeJS and uses the node.js buildpack to run on Cloud Foundry
- The backend service application uses the popular NodeJS web application framework [ExpressJS](https://expressjs.com/en/4x/api.html)
- The backend service uses a service instance of XS UAA on Cloud Foundry for setting up the OAuth authorizations and role checks at runtime.
It uses a utility [SAP-provided NPM library](https://help.sap.com/viewer/4505d0bdaf4948449b7f7379d24d0f0d/2.0.03/en-US/54513272339246049bf438a03a8095e4.html) 
called [node-xssec](https://help.sap.com/viewer/4505d0bdaf4948449b7f7379d24d0f0d/2.0.03/en-US/54513272339246049bf438a03a8095e4.html#loio54513272339246049bf438a03a8095e4__section_atx_2vt_vt)
for JWT token validations, OAuth scope and privilege checks and setting the security context per authorized HTTP request
- The service maintains a [database connection pool](https://en.wikipedia.org/wiki/Connection_pool) per consumer subaccount (i.e. consumer's associated PostgreSQL instance). The
connection pools are initialized on startup of the application runtime or lazily loaded on the first HTTP request.
  - It is recommended to use an asynchronous messaging system like [RabbitMQ](https://cloudplatform.sap.com/capabilities/product-info.RabbitMQ-on-SAP-Cloud-Platform.b011738d-fa31-4dc4-98b5-cb9acd9aea97.html) 
  to publish an event that represents a new subscription which can be subscribed to by all application instances that need to be aware of new connections
  - _Note_ that each PostgreSQL instance has a limit on the maximum number of active connections- the connection pool size for each database service instance per application 
  instance must be cautiously and intelligently handled so that there is no chance of overcommitting on resources. Overcommitting on connection resources in the pool 
  can lead to blocked TCP connections at runtime if not handled properly in code
