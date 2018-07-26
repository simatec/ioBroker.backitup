#!/bin/bash

STRING=$1
IFS="|"
VAR=($STRING)

BACKUP_TYPE=${VAR[0]}

C:\pWork\ioBroker.backitup/backitup.sh "$1" > "C:\pWork\ioBroker.backitup/${BACKUP_TYPE}.txt"