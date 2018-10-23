-- alter table to include service instance ID and service key ID
ALTER TABLE subscriptions
 ADD COLUMN service_instance_id text,
 ADD COLUMN service_key_id text;