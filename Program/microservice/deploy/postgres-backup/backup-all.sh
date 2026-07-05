#!/bin/sh
set -eu

backup_root="${BACKUP_DIR:-/backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="$backup_root/$timestamp"
mkdir -p "$backup_dir"

dump_database() {
  service_name="$1"
  host="$2"
  password="$3"

  PGPASSWORD="$password" pg_dump \
    -h "$host" \
    -U admin_user \
    -d db \
    -Fc \
    -f "$backup_dir/$service_name.dump"
}

dump_database "auth-service-db" "auth-service-db" "$AUTH_SERVICE_DB_PASSWORD"
dump_database "user-service-db" "user-service-db" "$USER_SERVICE_DB_PASSWORD"
dump_database "payroll-service-db" "payroll-service-db" "$PAYROLL_SERVICE_DB_PASSWORD"
dump_database "timesheet-service-db" "timesheet-service-db" "$TIMESHEET_SERVICE_DB_PASSWORD"
dump_database "contract-service-db" "contract-service-db" "$CONTRACT_SERVICE_DB_PASSWORD"
dump_database "planning-service-db" "planning-service-db" "$PLANNING_SERVICE_DB_PASSWORD"

find "$backup_root" -mindepth 1 -maxdepth 1 -type d -mtime +"${BACKUP_RETENTION_DAYS:-14}" -exec rm -rf {} +
