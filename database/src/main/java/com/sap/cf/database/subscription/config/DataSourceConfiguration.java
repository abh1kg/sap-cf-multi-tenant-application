package com.sap.cf.database.subscription.config;

import javax.sql.DataSource;

import org.codehaus.jettison.json.JSONArray;
import org.codehaus.jettison.json.JSONException;
import org.codehaus.jettison.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cloud.config.java.AbstractCloudConfig;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

@Profile("cloud")
@Configuration
public class DataSourceConfiguration extends AbstractCloudConfig {

	@Autowired
	private Environment environment;

	private final static Logger LOGGER = LoggerFactory.getLogger(DataSourceConfiguration.class);

	@Bean
	public DataSource dataSource() {
        String postgresInstance = environment.getProperty("POSTGRES_INSTANCE");
		if (postgresInstance == null) {
			return connectionFactory().dataSource();
		} else {
			LOGGER.info("Creating data source with service instance ID ", postgresInstance);
			return connectionFactory().dataSource(postgresInstance);
		}
	}
}