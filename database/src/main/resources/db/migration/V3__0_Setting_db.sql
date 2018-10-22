-- Extension required

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sequences required
CREATE SEQUENCE tenant_seq INCREMENT BY 1 START WITH 1 MINVALUE 1 MAXVALUE 4611686018427387903 NO CYCLE;

-- Types required
CREATE TYPE consumer_state IF NOT EXISTS AS ENUM ('ONBOARDING_IN_PROGRESS', 'ONBOARDED');

-- Tables required
CREATE TABLE subscriptions (
    consumer_subaccount_id TEXT NOT NULL,
    consumer_subdomain TEXT NOT NULL,
    consumer_subaccount_name TEXT NOT NULL,
    credentials JSON NOT NULL,
    state consumer_state NOT NULL DEFAULT 'ONBOARDING_IN_PROGRESS',
    enabled_extensions TEXT ARRAY,
    PRIMARY KEY (consumer_subaccount_id));