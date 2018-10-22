package com.sap.cf.database.subscription;

import javax.sql.DataSource;
import org.junit.Test;
import org.junit.runner.RunWith;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.junit4.SpringRunner;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import static org.junit.Assert.assertEquals;

import static org.assertj.core.api.Assertions.assertThat;

import javax.sql.DataSource;

public class ApplicationTests {

	@Autowired
	private JdbcTemplate template;

	@Autowired
	private DataSource dataSource;

	public void testDefaultSettings() throws Exception {
		assertEquals(new Integer(5), this.template.queryForObject("SELECT COUNT(*) from PERSON", Integer.class));
		assertThat(this.template.queryForObject("SELECT COUNT(*) from schema_version", Integer.class)).isGreaterThan(0);
		assertEquals(new String("first"),
				this.template.queryForObject("SELECT first_name from PERSON limit 1", String.class));
		assertEquals(new String("roger"),
				this.template.queryForObject("SELECT first_name from PERSON limit 1 offset 1", String.class));
		assertEquals(new String("Second"),
				this.template.queryForObject("SELECT last_name from PERSON limit 1", String.class));
		assertEquals(new String("federer"),
				this.template.queryForObject("SELECT last_name from PERSON limit 1 offset 1", String.class));

		assertThat(this.template.queryForObject("SELECT COUNT(*) from subscriptions", Integer.class))
				.isGreaterThan(-1);
	}
}