-- B3 (server-side token revocation) + B8 (brute-force lockout) columns on users.
--
-- NOTE ON VERSIONING: this file is numbered V100 to stay clear of the baseline
-- migrations (V1..V99) that own the auth-service schema. On a fresh database V1
-- already creates these columns, so this migration is an idempotent no-op. It is
-- retained as a safety net for any database that was baselined from an existing
-- Hibernate schema created before the B3/B8 columns existed (IF NOT EXISTS keeps
-- it safe either way).

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS locked_until timestamptz;
