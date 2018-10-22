/* Replace with your SQL commands */

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tables required
CREATE TABLE products (
    product_id serial,
    product_name text not null,
	product_description text,
	supplier_name text not null,
	price decimal not null,
	available boolean not null,
	quantity smallint,
	country text,
	created_by text,
    extension jsonb,
    PRIMARY KEY (product_id));