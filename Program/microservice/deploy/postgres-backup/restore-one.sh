#!/bin/sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "Usage: restore-one.sh <service-db> <dump-file>" >&2
  exit 2
fi

service_name="$1"
dump_file="$2"

case "$service_name" in
  auth-service-db)
    host="auth-service-db"
    password="$AUTH_SERVICE_DB_PASSWORD"
    ;;
  user-service-db)
    host="user-service-db"
    password="$USER_SERVICE_DB_PASSWORD"
    ;;
  payroll-service-db)
    host="payroll-service-db"
    password="$PAYROLL_SERVICE_DB_PASSWORD"
    ;;
  timesheet-service-db)
    host="timesheet-service-db"
    password="$TIMESHEET_SERVICE_DB_PASSWORD"
    ;;
  contract-service-db)
    host="contract-service-db"
    password="$CONTRACT_SERVICE_DB_PASSWORD"
    ;;
  planning-service-db)
    host="planning-service-db"
    password="$PLANNING_SERVICE_DB_PASSWORD"
    ;;
  *)
    echo "Unknown service database: $service_name" >&2
    exit 2
    ;;
esac

PGPASSWORD="$password" dropdb -h "$host" -U admin_user --if-exists db
PGPASSWORD="$password" createdb -h "$host" -U admin_user db
PGPASSWORD="$password" pg_restore -h "$host" -U admin_user -d db --clean --if-exists "$dump_file"
