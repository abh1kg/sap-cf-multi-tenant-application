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

#### Setting up a HANA Restricted User (one-time) for Automatic Trust Setup [Persona: Database Administrator]

- Log on to the HANA cockpit for your HANA Database Instance using your email address and password
- Log on using the `SYSTEM` user when prompted for the database logon
- Open the file `trust_setup.sql` inside the directory `industry-management-core-db/trust`
- Replace the placeholders `<restricted_user_name>` and `<password_for_restricted_user>` with a suitably generated user and password combination respectively. 
- Copy the content of the modified SQL file into SQL Console in HANA Cockpit and run the commands
- As a result of the execution of the SQL statements, you should now have:
  - A Restricted User on the HANA Database with access to a schema called `TENANT_TRUST_CONFIG`
  - A bunch of stored procedures would have been deployed into the schema

#### Deploying the application onto SAP Cloud Platform Cloud Foundry

- Login and target the Cloud Foundry API endpoint and the correct organization and space. Note that the user must have Space Developer privileges in the targeted Cloud Foundry space. For example:

```
cf api https://api.cf.eu10.hana.ondemand.com
cf login -u <email_address> -p <password> 
cf target -o <org_name> -s <space_name>
```

- Create a user-provided service instance with parameters pointing to the schema, restricted user and password created in the steps above. We will use this user-provided instance to connect to the HANA database for onboarding and offboarding JWT provider per XSUAA tenant subscription request
  - As a prerequisite, this assumes that a HANA database is already provisioned in the space.
  - You need to replace the following placeholders with appropriate values in the file `trust-setup-parameters.json` in the root of this repository:
    - `<host_for_hana_dbaas_instance>`: this should be replaced with the fully qualified host name of the HANA database. This can be retrieved easily by creating a service key of the HANA instance and inspecting the `host` field
    - `<port_for_hana_dbaas_instance>`: this should be replaced with the database listener port of the HANA instance. This can be retrieved easily by inspecting the `port` field of a service key created for the HANA instance
    - `<password_for_restricted_user>`: this should be replaced with the password for the restricted user chosen above
    - `<certificate_for_hana_database_for_secure_logon>`: this should be replaced with the raw certificate string used for secure database logon for the instance. This can be retrieved easily by inspecting the `certificate` field of a service key created for the HANA instance.
    - `<restricted_user_name>`: this should be replaced with the username chosen for the restricted HANA user above.
  - Run the command below with a suitable name for the user-provided service instance:

  ```
  cf create-user-provided-service <user_provided_service_instance_for_granting_service> -p trust-setup-parameters.json
  ```

- Create an instance of HDI (`hdi-shared` service plan) for hosting master information for the consumer tenants. Note this is an asynchronous operation. 
  - As a prerequisite, this assumes that a HANA Database is already provisioned in the space. You need to replace the service instance ID of the HANA database instance (fetch the ID via `cf service <hana_instance_name> --guid`) in the file `database-parameters.json` in the root of this repository. Run the command below with a suitable name for the HDI service instance:
  
  ```
  cf create-service hana hdi-shared <hdi_service_instance_name_for_tenant_master> -c database-parameters.json
  ```

- Deploy the HDI Deployer application in order to deploy the "tenant master" database table. This table is going to be used for hosting all master tenant information. 

  - Open the `manifest.yml` deployment descriptor in the directory `industry-management-core-db`
  - Replace the placeholder `<hdi_service_instance_name_for_tenant_master>` with the value chosen in the step above and save the manifest.
  - Run the commands below to deploy the hdi deployer application:

  ```
  cd industry-management-core-db
  cf push
  cd ..
  ```

- We will use `xsuaa` as the business user authentication and authorization service for the multi-tenant application. Create the service instance of `xsuaa` (`application` plan) with the security profile defined in the JSON descriptor. The JSON descriptor is present in the root of this repository in a file called `xs-security.json`. Take care in replacing the placeholder with an appropriate value:

```
cf create-service xsuaa application <xsuaa_service_instance_name> -c xs-security.json
```

- The application service uses a backend application protected by OAuth authorizations and additional role checks. Follow the steps below to deploy the backend application:
  - Go into the directory `industry-management-backend` which contains the source code for the backend application
  - Open the `manifest.yml` deployment descriptor
  - Replace the following placeholders with appropriate values as described below:
    - `<user_provided_service_instance_for_granting_service>`: this should be replaced with the value for the user provided service instance created above
    - `<name_for_ui_approuter_application>`: this should be replaced with the name of the Cloud Foundry approuter application which serves the UI resources and responds to tenant-specific route requests. In this example, the name is provided as `industrymanagementui` in the `manifest.yml` deployment descriptor within the application directory `industry-management-ui`
    - `<hdi_service_instance_name_for_tenant_master>`: this should be replaced with the value for the HDI service instance used above
    - `<service_instance_id_for_hana_dbaas>`: this should be replaced with the instance ID of the HANA DBaaS instance (also used above in the `database-parameters.json` file)
    - `<password_for_space_developer_user>`: this should be replaced with the password of a user in the space with Space Developer permissions
    - `<email_for_space_developer_user>`: this should be replaced with the email address of the user in the space with Space Developer permissions
    - `<xsuaa_service_instance_name>`: this should be replaced with the name of the XSUAA instance created above
    - `<route_for_ui_application_without_protocol>`: this should be replaced with the route of the UI application (without the HTTPs protocol in the prefix). The format should be `<app_name>.<domain>` e.g. `mybeautifului.cfapps.eu10.hana.ondemand.com`
    - `<route_for_backend_application_without_protocol>`: this should be replaced with the route of the backend application that you want to use (without the HTTPs protocol in the prefix) e.g. e.g. `mybeautifulbackend.cfapps.eu10.hana.ondemand.com`
   - Save the manifest file
   - Run the deployment using:
   ```
   cf push
   ```
- The application service provides a user interface, protected by the same business user authorizations and backend by the `approuter` for serving static resources and responsible for proxying HTTP requests securely to the backend. Follow the steps below to deploy the backend application:
  - Go into the directory `industry-management-ui` which contains the source code for the backend application
  - Open the `manifest.yml` deployment descriptor
  - Replace the following placeholders with appropriate values as described below:
    - `<xsuaa_service_instance_name>`: this should be replaced with the name of the XSUAA instance created above
    - `<route_for_ui_application_without_protocol>`: this should be replaced with the route of the UI application (without the HTTPs protocol in the prefix). The format should be `<app_name>.<domain>` e.g. `mybeautifului.cfapps.eu10.hana.ondemand.com`
    - `<route_for_backend_application_without_protocol>`: this should be replaced with the route of the backend application that you want to use (without the HTTPs protocol in the prefix) e.g. e.g. `mybeautifulbackend.cfapps.eu10.hana.ondemand.com`
   - Run the deployment using:
   ```
   cf push
   ```
   
 - The SAP cloud platform provides a service in the marketplace called `saas-registry` and service plan `application`. This service is responsible for providing the application service to other subaccounts in the list of subscriptions. You need to create an instance of `saas-registry` with plan `application` passing along parameters for the multi-tenant app configurations. Follow the steps below for this:
    - Open the file `config.json` in the directory `multi-tenant-config`. Replace the placeholders in the file with values below:
      - `<generated_xsappname_for_xsuaa_environment>`: Inspect the `xsuaa` service binding for the backend application using `cf env industrymanagementbackend` and copy over the generated value for the field `xsappname`
      - `<route_for_backend_application_without_protocol>`: Replace with the route of the backend application as mentioned above
    - Save the file
    - Create an instance of `saas-registry` (`application` plan) using the config file mentioned above:
    ```
    cf create-service saas-registry application saas-provisioning-service -c multi-tenant-config/config.json
    ```
    - Bind the instance to the backend application:
    ```
    cf bind-service industrymanagementbackend saas-provisioning-service
    ```
    - Restage the backend application
    ```
    cf restage industrymanagementbackend
    ```

#### Subscription Process

When the provider application receives a subscription request, the provider performs the following steps:

- Provisions an HDI container connected to the DBaaS instance corresponding to the consumer subaccount
- Creates a Cloud Foundry Service Key for the HDI container
- Deploys the database artifacts into the corresponding HDI container for the tenant using the credentials of the service key
- Creates a mapping in the DBaaS instance which links the consumer subaccount, the HDI container service instance ID and the generated service key ID
- Establishes trust between the consumer subaccount's identity realm and the HANA database

