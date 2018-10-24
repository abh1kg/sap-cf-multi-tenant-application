package com.sap.cf.database.subscription;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class Application {
	private static final Logger LOGGER = LoggerFactory.getLogger(Application.class);

	public static void main(String args[]) {
		SpringApplication.run(Application.class, args);
	}

	@Bean
	public FlywayMigrationStrategy cleanMigrateStrategy() throws FlywayException {
		FlywayMigrationStrategy strategy = new FlywayMigrationStrategy() {
			@Override
			public void migrate(Flyway flyway) {
				try {
					LOGGER.info("Starting Flyway Migration of subscription master database:");
					flyway.baseline();
					flyway.repair();
					flyway.migrate();
					flyway.info();
				} catch (FlywayException e) {
					LOGGER.error("Flyway migration failed with " + e.getMessage());
				}
			}
		};
		return strategy;
	}
}