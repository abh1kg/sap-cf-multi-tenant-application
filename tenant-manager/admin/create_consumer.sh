#!/usr/bin/env bash
# shellcheck disable=SC1090

set -e

check_if_cf_cli_exists() {
	if ! command -v cf; then
		fail "cf cli executable not found- follow the instructions at https://docs.cloudfoundry.org/cf-cli/install-go-cli.html for installation"
	fi
}

check_if_curl_exists() {
	if ! command -v cf; then
		fail "curl not found- follow the instructions at https://linoxide.com/linux-how-to/install-curl-php-linux/ for installation on Linux and https://curl.haxx.se/download.html for downloads on Windows"
	fi
}

check_if_jq_exists() {
	if ! command -v cf; then
		fail "jq executable not found- please install the jq cli to proceed- follow instructions at https://stedolan.github.io/jq/download/ for installation"
	fi
}

# exits with a fail message $2 and errorcode 1 if $1 is empty or 'null'
fail_on_noval() {
	if [ "null" == "$1" ] || [ -z "$1" ]; then
		fail "$2"
	fi
}

# exits with error code 1 in case $1 is an error (>0) and prints $2
fail_on_error() {
	if [ "$1" -gt 0 ]; then
		echo "$2"
		echo "FAILED (exit code $1)"
		exit 1
	fi
}

# exits with error code 1 and message $1
fail() {
	fail_on_error 1 "$1"
}

login_cf() {
	CF_API="$1"
	USER="$2"
	PASSWORD="$3"
	PROVIDER_ORG="$4"
	PROVIDER_SPACE="$5"
	cf login -a "$CF_API" -u "$USER" -p "$PASSWORD" -o "$PROVIDER_ORG" -s "$PROVIDER_SPACE"
}

# Shared helper methods for interacting with PostgreSQL service instance for consumer account onboarding

#Waits for postgres service instance to be created or updated, taking a retry count of 10
#Takes service instance name and sleep interval (in seconds) as arguments
wait_for_postgres_created_or_updated() {
	if [ "null" == "$1" ] || [ -z "$1" ]; then
		echo "DEPLOYMENT FAILED (PostgreSQL service instance name not passed as an argument)"
		exit 1
	fi
	serviceInstanceName="$1"
	sleepInterval="$2"
	retries=1
	failed=0
	if [ "null" == "$2" ] || [ -z "$2" ]; then
		sleepInterval="120s"
	fi
	serviceInstanceId=$(cf service "$serviceInstanceName" --guid)
	while [[ $retries -lt 50 ]]; do
		jsonResponse=$(cf curl /v2/service_instances/"$serviceInstanceId")
		operation_type=$(jq -r ".entity.last_operation.type" <<<"$jsonResponse")
		operation_state=$(jq -r ".entity.last_operation.state" <<<"$jsonResponse")
		echo "operation_type=$operation_type, operation_state=$operation_state"
		if [[ $operation_state == 'failed' ]]; then
			failed=1
			break
		fi
		if [[ $operation_state == 'in progress' ]]; then
			echo "Waiting for ${serviceInstanceName} to be created"
			sleep "$sleepInterval"
			retries=$((retries + 1))
		else
			break
		fi
	done

	if [[ $failed == 1 ]] || [[ $retries -ge 10 ]]; then
		echo "Service ${serviceInstanceName} could not be created or retry count has been exceeded, exiting..."
		exit 1
	fi
}

#Waits for postgres service instance operation
wait_for_postgres_service_operation() {
	#waits for the postgres to be in state final
	if [ "null" == "$1" ] || [ -z "$1" ]; then
		echo "DEPLOYMENT FAILED (PostgreSQL service instance name not passed as an argument)"
		exit 1
	fi
	serviceInstanceName="$1"
	retries=1
	serviceInstanceId=$(cf service "$serviceInstanceName" --guid)
	sleepInterval="120s"

	#Poll till we get a final state
	while [[ $retries -lt 50 ]]; do
		jsonResponse=$(cf curl /v2/service_instances/"$serviceInstanceId")
		operation_type=$(jq -r ".entity.last_operation.type" <<<"$jsonResponse")
		operation_state=$(jq -r ".entity.last_operation.state" <<<"$jsonResponse")
		echo "operation_type=$operation_type, operation_state=$operation_state"

		if [[ $operation_state == 'in progress' ]]; then
			echo "Waiting for ${serviceInstanceName} to be created"
			sleep "$sleepInterval"
			retries=$((retries + 1))
		else
			break
		fi
	done

	if [[ $retries -ge 10 ]]; then
		echo "Service ${serviceInstanceName} has exceeded the time limit for status change. A manual check is needed."
		exit 1
	fi
	echo "${serviceInstanceName} is in correct state."
}

# Takes service instance name, service plan name and service name as arguments
create_or_update_postgres_service() {
	DB_INSTANCE_NAME="$1"
	DB_PLAN="$2"
	CF_DB_SERVICE="$3"

	#check whether DB service instance exists or not. If not create one.
	if ! cf services | grep "$DB_INSTANCE_NAME"; then
		echo "Creating PostgreSQL service instance for subaccount: instance name $1, plan $2"
		cf create-service "$CF_DB_SERVICE" "$DB_PLAN" "$DB_INSTANCE_NAME" || exit 1
		wait_for_postgres_created_or_updated "$DB_INSTANCE_NAME"
	else
		echo "Updating postgres service instance if required"
		if ! cf service "$DB_INSTANCE_NAME" | grep "$DB_PLAN"; then
			echo "updating postgres service plan"
			wait_for_postgres_service_operation "$DB_INSTANCE_NAME"
			cf update-service "$DB_INSTANCE_NAME" -p "$DB_PLAN"
			wait_for_postgres_created_or_updated "$DB_INSTANCE_NAME" "60s"
		else
			echo "${DB_INSTANCE_NAME} already exists with correct plan configuration"
		fi
	fi
}

create_service_key_for_consumer_postgres() {
	DB_INSTANCE_NAME="$1"

	if ! cf services | grep "$DB_INSTANCE_NAME"; then
		fail "PostgreSQL service instance $DB_INSTANCE_NAME does not exist"
	fi

	if cf service-key "$DB_INSTANCE_NAME" "tenantKey"; then
		echo "Service key tenantKey already exists for Consumer PostgreSQL instance $DB_INSTANCE_NAME"
	else
		# creates a service key for the consumer's postgresql instance with a fixed name
		cf create-service-key "$DB_INSTANCE_NAME" "tenantKey"
		guid=$(cf service-key "$DB_INSTANCE_NAME" "tenantKey" --guid)
		echo "$guid"
	fi
}

get_service_key_credentials() {
	SERVICE_KEY_GUID="$1"
	fail_on_noval "$1" "service key id required"
	jsonResponse=$(cf curl "/v2/service_keys/$SERVICE_KEY_GUID")
	credentials=$(jq -r ".entity.credentials" <<<"$jsonResponse")
	echo "$credentials"
}

cf_api_endpoint="$1"
fail_on_noval "$cf_api_endpoint" "CF API Endpoint not passed as an argument- the value is mandatory"

cf_user="$2"
fail_on_noval "$cf_user" "CF user not passed as an argument- the value is mandatory for creating the PostgreSQL instance"

cf_password="$3"
fail_on_noval "$cf_password" "CF password not passed as an argument- the value is mandatory for creating the PostgreSQL instance"

provider_cf_org="$4"
fail_on_noval "$provider_cf_org" "CF organization name for provider organization not passed as an argument- the value is mandatory for creating the PostgreSQL instance"

provider_cf_space="$5"
fail_on_noval "$provider_cf_space" "CF space name for provider space not passed as an argument- the value is mandatory for creating the PostgreSQL instance"

consumer_subaccount_id="$6"
fail_on_noval "$consumer_subaccount_id" "Consumer subaccount ID not passed as an argument- the value is mandatory for creating the PostgreSQL instance"

consumer_subaccount_name="$7"
fail_on_noval "$consumer_subaccount_name" "Consumer subaccount name not passed as an argument- the value is mandatory for creating the PostgreSQL instance"

consumer_subaccount_domain="$8"
fail_on_noval "$consumer_subaccount_domain" "Consumer subaccount domain not passed as an argument- the value is mandatory for the pre-onboarding process"

consumer_service_plan="$9"
fail_on_noval "$consumer_service_plan" "Service plan for consumer not passed as an argument- the value is mandatory for creating the PostgreSQL instance"

tenant_manager_app_url="$10"
fail_on_noval "$tenant_manager_app_url" "URL for tenant manager not provided - the value is mandatory for the pre-onboarding process"

tenant_admin_user="$11"
fail_on_noval "$tenant_admin_user" "Administration username for subscriber onboarding API not provided - thie value is mandatory for the pre-onboarding process"

tenant_admin_password="$12"
fail_on_noval "$tenant_admin_password" "Administration password for subscriber onboarding API not provided - thie value is mandatory for the pre-onboarding process"

login_cf "$cf_api_endpoint" "$cf_user" "$cf_password" "$provider_cf_org" "$provider_cf_space"
create_or_update_postgres_service "$consumer_subaccount_name" "$consumer_service_plan" "postgresql"
service_key_id=$(create_service_key_for_consumer_postgres "$consumer_subaccount_name")
generated_credentials=$(get_service_key_credentials "$service_key_id")

curl_data="{\"subaccountName\": \"$consumer_subaccount_name\", \"subaccountDomain\": \"$consumer_subaccount_domain\", \"credentials\": \"$generated_credentials\"}"
curl_url="https://${tenant_manager_app_url}/admin/subaccounts/${consumer_subaccount_id}"
admin_status=$(curl -sk -o /dev/null -w '%{http_code}' -u "$tenant_admin_user:$tenant_admin_password" -X POST -H "content-type: application/json" -d "$curl_data" "$curl_url")

if $admin_status eq 201; then
	echo "=================================================================================="
	echo "Subaccount administration pre-onboarding completed. Details are provided below:"
	echo "  Subaccount Name: $consumer_subaccount_name"
	echo "  Subaccount Domain: $consumer_subaccount_domain"
	echo "  PostgreSQL Service Plan: $consumer_service_plan"
	echo "  PostgreSQL Service Instance: $consumer_subaccount_name"
	echo "  PostgreSQL Service Key: tenantKey"
	echo "  PostgreSQL Credentials: $generated_credentials"
	echo "  State: ONBOARDING_IN_PROGRESS"
	echo "Please complete the subscription process for the subaccount by navigating to the Cloud Cockpit"
else
	echo "=================================================================================="
	echo "Subaccount administration pre-onboarding partially completed. Details are provided below:"
	echo "  Subaccount Name: $consumer_subaccount_name"
	echo "  Subaccount Domain: $consumer_subaccount_domain"
	echo "  PostgreSQL Service Plan: $consumer_service_plan"
	echo "  PostgreSQL Service Instance: $consumer_subaccount_name"
	echo "  PostgreSQL Service Key: tenantKey"
	echo "  PostgreSQL Credentials: $generated_credentials"
	echo "  State: ONBOARDING_IN_PROGRESS"
	echo "Note: We were unable to administer the subaccount via the Administration API. Please check the credentials provided. Please re-run this script with the proper credentials"
fi
