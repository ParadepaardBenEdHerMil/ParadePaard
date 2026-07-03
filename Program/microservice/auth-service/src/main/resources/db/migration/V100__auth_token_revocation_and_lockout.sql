-- B3 (server-side token revocation) + B8 (brute-force lockout) columns on users.
--
-- NOTE ON VERSIONING: this file is numbered V100 to stay clear of the baseline
-- migrations introduced by B6 (Flyway adoption), which own the V1..V99 range for
-- the existing auth-service schema. It is inert until Flyway is enabled for
-- auth-service; while the service still runs with ddl-auto=update, Hibernate
-- creates these columns from the User entity and this file is a no-op safety net
-- (IF NOT EXISTS keeps it idempotent either way).

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS locked_until timestamptz;
