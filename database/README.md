## Database Change Management for Tracking PostgreSQL instance
This directory contains Java code which runs database migration and source versioning for the tracking PostgreSQL service instance. The repository uses the lightweight Java library [flywaydb](https://flywaydb.org/) to trigger the database changes.

### Prerequisites

- Java 8 or above
  - Note: Java 7 is not supported
- Maven (with access to central Maven repository from local workstation)
- Knowledge of [Spring Boot](https://spring.io/projects/spring-boot), FlywayDB and [Spring Boot Actuator](https://www.baeldung.com/spring-boot-actuators)


### Build Process

- Run the command `mvn clean install` from inside this directory on your local workstation
- The Maven build must generate a `target` directory and an executable JAR within the `target` directory

### Adding Database Changes

In case more database changes are required to be executed such as altering an existing table or creating new constraints, one needs to:

- Add properly versioned and ordered SQL files to the [database SQL resources](src/main/resources/db/migration) directory. A properly versioned SQL file is of the format `V<major_revision>__<minor_revision>_<Purpose.sql`. A proper example for such an SQL file could be `V5__0_Add_columns.sql`

- Adjust the test cases, if required

- Run a clean build using `mvn clean install`
