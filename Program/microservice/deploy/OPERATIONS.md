# Deployment Operations

## TLS proxy

Run the gateway behind the Compose TLS proxy with certificate files supplied by
the deployment environment:

```sh
TLS_CERT_PATH=/secure/fullchain.pem \
TLS_KEY_PATH=/secure/privkey.pem \
docker compose --profile tls up -d tls-proxy
```

The proxy redirects HTTP to HTTPS, forwards traffic to `api-gateway:4004`, and
sets `X-Forwarded-Proto: https` so the gateway can enforce HTTPS-aware security
headers.

## Postgres backups

Start the scheduled backup sidecar with:

```sh
BACKUP_INTERVAL_SECONDS=86400 docker compose --profile backup up -d postgres-backup
```

Backups are stored as custom-format dumps in the `postgres_backups` Docker
volume. The default retention is 14 days and can be changed with
`BACKUP_RETENTION_DAYS`.

## Restore drill

List available backup directories:

```sh
docker compose --profile backup run --rm --entrypoint sh postgres-backup -c 'find /backups -maxdepth 2 -type f -name "*.dump"'
```

Restore one service database from a selected dump:

```sh
docker compose --profile backup run --rm postgres-backup /scripts/restore-one.sh auth-service-db /backups/20260703T120000Z/auth-service-db.dump
```

Run this drill after backup configuration changes and before each production
release. For managed databases, keep provider point-in-time recovery enabled and
use these dumps as an application-level restore path.
