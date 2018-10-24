#!/usr/bin/env bash
# shellcheck disable=SC1090
# shellcheck disable=SC2162
set -e

red=$(tput setaf 1)
green=$(tput setaf 2)
yellow=$(tput setaf 3)
blue=$(tput setaf 4)
reset=$(tput sgr0)

print_yellow() {
	echo "${yellow}$1${reset}"
}

print_blue(){
	echo "${blue}$1${reset}"
}

print_green(){
	echo "${green}$1${reset}"
}

check_if_cf_cli_exists() {
	if ! command -v cf; then
		fail "cf cli executable not found- follow the instructions at https://docs.cloudfoundry.org/cf-cli/install-go-cli.html for installation"
	fi
}

check_if_curl_exists() {
	if ! command -v curl; then
		fail "curl not found- follow the instructions at https://linoxide.com/linux-how-to/install-curl-php-linux/ for installation on Linux and https://curl.haxx.se/download.html for downloads on Windows"
	fi
}

check_if_jq_exists() {
	if ! command -v jq; then
		fail "jq executable not found- please install the jq cli to proceed- follow instructions at https://stedolan.github.io/jq/download/ for installation"
	fi
}

check_match() {
	if [ "y" == "$1" ]; then
		echo "Proceeding..."
	elif [ "n" == "$1" ]; then
		echo "Exiting..."
		exit 0
	else
		fail "Invalid value (only 'y' or 'n' accepted)"
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
		echo "${red}$2${reset}"
		echo "FAILED (exit code $1)"
		exit 1
	fi
}

# exits with error code 1 and message $1
fail() {
	fail_on_error 1 "$1"
}

print_delimiter() {
	echo '--------------------------------------------------------------'
	echo ''
	if [ "null" == "$1" ] || [ -z "$1" ]; then
		echo ''
	else
		print_yellow "$1"
	fi
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

#Waits for postgres service instance to be created or updated, taking a retry count of 50
#Takes service instance name and sleep interval (in seconds) as arguments
wait_for_postgres_created_or_updated() {
	if [ "null" == "$1" ] || [ -z "$1" ]; then
		fail "DEPLOYMENT FAILED (PostgreSQL service instance name not passed as an argument)"
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
		jsonResponse=$(cf curl "v2/service_instances/$serviceInstanceId")
		operation_type=$(jq -r ".entity.last_operation.type" <<<"$jsonResponse")
		operation_state=$(jq -r ".entity.last_operation.state" <<<"$jsonResponse")

		if [[ $operation_type == 'delete' ]]; then
			fail "Consumer service instance $serviceInstanceName is currently being deleted. Please run the script after a while..."
		fi

		if [[ $operation_state == 'failed' ]]; then
			failed=1
			break
		fi
		if [[ $operation_state == 'in progress' ]]; then
			echo "$(date) :: Waiting for ${serviceInstanceName} to be created..."
			sleep "$sleepInterval"
			retries=$((retries + 1))
		else
			break
		fi
	done

	if [[ $failed == 1 ]] || [[ $retries -ge 50 ]]; then
		fail "Service ${serviceInstanceName} could not be created or retry count has been exceeded, exiting..."
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
		jsonResponse=$(cf curl "v2/service_instances/$serviceInstanceId")
		operation_type=$(jq -r ".entity.last_operation.type" <<<"$jsonResponse")
		operation_state=$(jq -r ".entity.last_operation.state" <<<"$jsonResponse")

		if [[ $operation_type == 'delete' ]]; then
			fail "Consumer service instance $serviceInstanceName is currently being deleted. Please run the script after a while..."
		fi

		if [[ $operation_state == 'in progress' ]]; then
			echo "$(date) :: Waiting for ${serviceInstanceName} to be created"
			sleep "$sleepInterval"
			retries=$((retries + 1))
		else
			break
		fi
	done

	if [[ $retries -ge 10 ]]; then
		fail "Service ${serviceInstanceName} has exceeded the time limit for status change. A manual check is needed."
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
	if ! cf services | grep "$DB_INSTANCE_NAME">/dev/null; then
		echo "Creating PostgreSQL service instance for subaccount: instance name $1, plan $2"
		cf create-service "$CF_DB_SERVICE" "$DB_PLAN" "$DB_INSTANCE_NAME" || exit 1
		wait_for_postgres_created_or_updated "$DB_INSTANCE_NAME"
	else
		echo "Updating postgres service instance if required"
		if ! cf service "$DB_INSTANCE_NAME" | grep "$DB_PLAN">/dev/null; then
			echo "updating postgres service plan"
			wait_for_postgres_service_operation "$DB_INSTANCE_NAME"
			cf update-service "$DB_INSTANCE_NAME" -p "$DB_PLAN"
			wait_for_postgres_created_or_updated "$DB_INSTANCE_NAME"
		else
			echo "${DB_INSTANCE_NAME} already exists with correct plan configuration"
			wait_for_postgres_created_or_updated "$DB_INSTANCE_NAME"
		fi
	fi
}

create_service_key_for_consumer_postgres() {
	DB_INSTANCE_NAME="$1"

	if ! cf services | grep "$DB_INSTANCE_NAME">/dev/null; then
		fail "PostgreSQL service instance $DB_INSTANCE_NAME does not exist"
	fi

	if cf service-key "$DB_INSTANCE_NAME" "tenantKey">/dev/null; then
		echo "Service key tenantKey already exists for Consumer PostgreSQL instance $DB_INSTANCE_NAME"
	else
		# creates a service key for the consumer's postgresql instance with a fixed name
		cf create-service-key "$DB_INSTANCE_NAME" "tenantKey"
	fi
}

get_service_instance_guid(){
	DB_INSTANCE_NAME="$1"
	guid=$(cf service "$DB_INSTANCE_NAME" --guid)
	echo "$guid"
}

get_service_key_guid() {
	DB_INSTANCE_NAME="$1"
	guid=$(cf service-key "$DB_INSTANCE_NAME" "tenantKey" --guid)
	echo "$guid"
}

get_service_key_credentials() {
	SERVICE_KEY_GUID="$1"
	fail_on_noval "$1" "service key id required"
	jsonResponse=$(cf curl "v2/service_keys/$SERVICE_KEY_GUID")
	credentials=$(jq -rc ".entity.credentials" <<<"$jsonResponse")
	echo "$credentials"
}

print_yellow "Enter the fully qualified Cloud Foundry API endpoint URL (e.g. https://api.cf.eu10.hana.ondemand.com): "
read cf_api_endpoint
fail_on_noval "$cf_api_endpoint" "CF API Endpoint not passed as an argument- the value is mandatory"

print_yellow "Enter the Cloud Foundry organization name for the Application Provider: "
read provider_cf_org
fail_on_noval "$provider_cf_org" "CF organization name for provider not passed as an argument- the value is mandatory for creating the PostgreSQL instance"

print_yellow "Enter the Cloud Foundry space name for the Application Provider: "
read provider_cf_space
fail_on_noval "$provider_cf_space" "CF space name for provider not passed as an argument- the value is mandatory for creating the PostgreSQL instance"

print_yellow "Enter the Cloud Foundry username (email address) for the Application Provider (note the user requires Space Developer privileges): "
read cf_user
fail_on_noval "$cf_user" "CF user not passed as an argument- the value is mandatory for creating the PostgreSQL instance"

print_yellow "Enter the Cloud Foundry user's password for the Application Provider: "
read -s cf_password
fail_on_noval "$cf_password" "CF password not passed as an argument- the value is mandatory for creating the PostgreSQL instance"

print_yellow "Enter the Consumer Subaccount ID: "
read consumer_subaccount_id
fail_on_noval "$consumer_subaccount_id" "Consumer subaccount ID not passed as an argument- the value is mandatory for creating the PostgreSQL instance"

print_yellow "Enter the Consumer Subaccount Name: "
read consumer_subaccount_name
fail_on_noval "$consumer_subaccount_name" "Consumer subaccount name not passed as an argument- the value is mandatory for creating the PostgreSQL instance"

print_yellow "Enter the Consumer Subaccount Domain: "
read consumer_subaccount_domain
fail_on_noval "$consumer_subaccount_domain" "Consumer subaccount domain not passed as an argument- the value is mandatory for the pre-onboarding process"

print_yellow "Enter the PostgreSQL service plan for the consumer (e.g. v9.6-large) :"
read consumer_service_plan
fail_on_noval "$consumer_service_plan" "Service plan for consumer not passed as an argument- the value is mandatory for creating the PostgreSQL instance"

print_yellow "Enter the fully qualified URL of the Tenant Administration application without the protocol (e.g. tenant-admin.cfapps.eu10.hana.ondemand.com): "
read tenant_manager_app_url
fail_on_noval "$tenant_manager_app_url" "URL for tenant manager not provided - the value is mandatory for the pre-onboarding process"

print_yellow "Enter the administrator username for the subscription onboarding API (this should be taken from the environment variable for the tenant manager application): "
read tenant_admin_user
fail_on_noval "$tenant_admin_user" "Administration username for subscriber onboarding API not provided - thie value is mandatory for the pre-onboarding process"

print_yellow "Enter the administrator password for the subscription onboarding API (this should be taken from the environment variable for the tenant manager application): "
read -s tenant_admin_password
fail_on_noval "$tenant_admin_password" "Administration password for subscriber onboarding API not provided - thie value is mandatory for the pre-onboarding process"

echo ""
echo "=================== Input Summary ==================="
echo "  Cloud Foundry API Endpoint: $cf_api_endpoint"
echo "  Cloud Foundry Username: $cf_user"
echo "  Cloud Foundry Organization: $provider_cf_org"
echo "  Cloud Foundry Space: $provider_cf_space"
echo "  Consumer Subaccount: $consumer_subaccount_name"
echo "  Consumer Subaccount Domain: $consumer_subaccount_domain"
echo "  Tenant Manager Application URL: https://${tenant_manager_app_url}"
echo "  PostgreSQL Service Plan: $consumer_service_plan"
echo "======================================================"
echo ""
echo ""
echo "Are you sure you want to continue (y/n)?"
read -s continue_or_not
fail_on_noval "$continue_or_not" "You must enter 'y' or 'n' to continue"
check_match "$continue_or_not"

print_delimiter "Logging into Cloud Foundry...."
login_cf "$cf_api_endpoint" "$cf_user" "$cf_password" "$provider_cf_org" "$provider_cf_space"
print_delimiter

print_delimiter "Creating/Updating PostgreSQL service instance...."
create_or_update_postgres_service "$consumer_subaccount_name" "$consumer_service_plan" "postgresql"
service_instance_id=$(get_service_instance_guid "$consumer_subaccount_name")
print_delimiter

print_delimiter "Creating Service Key..."
create_service_key_for_consumer_postgres "$consumer_subaccount_name"
print_delimiter

print_delimiter "Fetching Service Key credentials..."
service_key_id=$(get_service_key_guid "$consumer_subaccount_name")
generated_credentials=$(get_service_key_credentials "$service_key_id")
echo "Consumer PostgreSQL credentials: $generated_credentials"
print_delimiter

print_delimiter "Calling Tenant Administration API..."
curl_data="{\"serviceInstanceId\": \"$service_instance_id\", \"serviceKeyId\": \"$service_key_id\", \"subaccountName\": \"$consumer_subaccount_name\", \"subaccountDomain\": \"$consumer_subaccount_domain\", \"credentials\": $generated_credentials}"
echo "$curl_data" > data.json
curl_url="https://${tenant_manager_app_url}/admin/subaccounts/${consumer_subaccount_id}"
echo "HTTP Request Content Type: application/json, HTTP Method: PUT, URL: $curl_url"
echo "Request Payload: $curl_data"
echo ""
admin_status=$(curl -sk -o /dev/null -w '%{http_code}' -u "$tenant_admin_user:$tenant_admin_password" -X PUT -H "Accept: application/json" -H "Content-type: application/json" -d @data.json "$curl_url")
echo "Tenant Administration API returned HTTP Status Code $admin_status"
rm -rf data.json
print_delimiter

if [ "$admin_status" == "201" ]; then
	echo ""
	echo "=================================================================================="
	echo ""
	echo "Subaccount administration pre-onboarding completed. Details are provided below:"
	echo ""
	echo "  Subaccount Name: $consumer_subaccount_name"
	echo "  Subaccount Domain: $consumer_subaccount_domain"
	echo "  PostgreSQL Service Plan: $consumer_service_plan"
	echo "  PostgreSQL Service Instance: $consumer_subaccount_name"
	echo "  PostgreSQL Service Key: tenantKey"
	echo "  PostgreSQL Credentials: $generated_credentials"
	echo "  State: ONBOARDING_IN_PROGRESS"
	echo ""
	print_green "Pre-onboarding steps successfully completed. Please complete the subscription process for the subaccount by navigating to the Cloud Cockpit"
	echo "=================================================================================="
else
	echo ""
	echo "=================================================================================="
	echo "Subaccount administration pre-onboarding partially completed. Details are provided below:"
	echo ""
	echo "  Subaccount Name: $consumer_subaccount_name"
	echo "  Subaccount Domain: $consumer_subaccount_domain"
	echo "  PostgreSQL Service Plan: $consumer_service_plan"
	echo "  PostgreSQL Service Instance: $consumer_subaccount_name"
	echo "  PostgreSQL Service Key: tenantKey"
	echo "  PostgreSQL Credentials: $generated_credentials"
	echo "  State: ONBOARDING_IN_PROGRESS"
	echo ""
	print_blue "NOTE: We were unable to administer the subaccount via the Administration API. Please check the credentials provided and the application logs for more details. Re-run this script with the correct values to complete pre-onboarding"
	echo "=================================================================================="
fi
