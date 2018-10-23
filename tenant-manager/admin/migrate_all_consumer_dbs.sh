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

print_blue() {
	echo "${blue}$1${reset}"
}

print_green() {
	echo "${green}$1${reset}"
}

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
echo "  Tenant Manager Application URL: https://${tenant_manager_app_url}"
echo "======================================================"
echo ""
echo ""
echo "Are you sure you want to continue (y/n)?"
read -s continue_or_not
fail_on_noval "$continue_or_not" "You must enter 'y' or 'n' to continue"
check_match "$continue_or_not"

print_delimiter "Calling Administration API for running database change management for all consumer accounts..."
curl_url="https://${tenant_manager_app_url}/admin/subaccounts/db_migrations"
echo "HTTP Request Content Type: application/json, HTTP Method: PUT, URL: $curl_url"
echo ""
admin_status=$(curl -sk -o /dev/null -w '%{http_code}' -u "$tenant_admin_user:$tenant_admin_password" -X PUT -H "Accept: application/json" -H "Content-type: application/json" "$curl_url")
echo "Tenant Administration API returned HTTP Status Code $admin_status"
print_delimiter

if [ "$admin_status" == "200" ]; then
	echo ""
	echo "=================================================================================="
	echo ""
	print_green "Database change management for all consumer subaccounts completed successfully"
	echo "=================================================================================="
else
	echo ""
	echo "=================================================================================="
	print_blue "Database change management for all consumer subaccounts failed- please check the application logs for more details"
	echo "=================================================================================="
fi
