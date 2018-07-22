#!/bin/bash

STRING=$1
IFS="|"
VAR=($STRING)

BACKUP_TYPE=${VAR[0]}

/opt/iobroker/node_modules/iobroker.backitup/backitup.sh "$1" > "/opt/iobroker/node_modules/iobroker.backitup/${BACKUP_TYPE}.txt"