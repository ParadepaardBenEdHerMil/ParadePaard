#!/bin/sh
set -eu

interval_seconds="${BACKUP_INTERVAL_SECONDS:-86400}"

while true; do
  /bin/sh /scripts/backup-all.sh
  sleep "$interval_seconds"
done
