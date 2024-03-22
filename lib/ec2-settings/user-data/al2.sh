#!/bin/bash

# -x to display the command to be executed
set -xe

# Redirect /var/log/user-data.log and /dev/console
exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1

declare -r SYSTEM_PREFIX=__SYSTEM_PREFIX__
declare -r ENV_NAME=__ENV_NAME__

echo "$SYSTEM_PREFIX $ENV_NAME AL2 Instance"
