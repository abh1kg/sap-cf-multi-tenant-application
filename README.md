### Developing a Multi-tenant Business Application on SAP Cloud Platform in the Cloud Foundry Environment

This repository contains a sample reference application for developing and deploying a SaaS (software-as-a-service) multitenant business application on SAP Cloud Platform Cloud Foundry environment. Follow the instructions below to deploy the application on SAP Cloud Platform in a subaccount that is configured for the Cloud Foundry environment.

#### Introduction to Multi-tenant Business Applications

A multi-tenant business application provides a suite of functional services to a horde of customers. The developer and deployer of the application service (e.g. a company with a Global Account on SAP Cloud Platform) is often referred to as the _provider_ while the customers of the service are referred to as _consumers_.

#### Prerequisites

- You understand the concepts of multitenancy in the Cloud Foundry environment; see this [blog](https://blogs.sap.com/2018/09/17/developing-multitenant-applications-on-sap-cloud-platform-cloud-foundry-environment/).
- You understand the domain model (account structure) of SAP Cloud Platform; see this [blog](https://blogs.sap.com/2018/05/24/a-step-by-step-guide-to-the-unified-sap-cloud-platform-cockpit-experience/).
- You know how to work with the Cloud Foundry Command Line Interface (cf CLI).

#### Notes

We will use the Cloud Foundry CLI for deploying the applications onto the Cloud Foundry landscape. The process can be simplified further into a unified deployment experience using the concept of Multi-Target Archives (MTAs). This is left to the reader as an exercise in order to keep the concerns of deployment isolated.

#### Deploying the application onto SAP Cloud Platform Cloud Foundry

- Login and target the Cloud Foundry API endpoint and the correct organization and space. Note that the user must have Space Developer privileges in the targeted Cloud Foundry space. For example:

```
cf api https://api.cf.eu10.hana.ondemand.com
cf login -u <email_address> -p <password> 
cf target -o <org_name> -s <space_name>
```

- 
