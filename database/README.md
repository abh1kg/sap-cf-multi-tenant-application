## Database Change Management for Tracking PostgreSQL instance
This directory contains Java code which runs database migration and source versioning for the tracking PostgreSQL service instance. The repository uses the lightweight Java library [flywaydb](https://flywaydb.org/) to trigger the database changes.

### Build Process

Prerequisites:
- Java 8 or above
  - Note: Java 7 is not supported
- Maven (with access to central Maven repository from local workstation)
- Knowledge of [Spring Boot](https://spring.io/projects/spring-boot), FlywayDB and [Spring Boot Actuator](https://www.baeldung.com/spring-boot-actuators)

`mvn clean install`
