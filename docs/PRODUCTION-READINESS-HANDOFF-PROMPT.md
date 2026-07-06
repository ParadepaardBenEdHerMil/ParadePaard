# Handoff prompt — finish ParadePaard production-readiness

Copy everything below the line into a fresh agent session (or use it yourself as a checklist).

---

You are continuing production-readiness work on the ParadePaard payroll app: a Spring Boot 3.5 / Java 21
microservice system (auth, user, contract, payroll, timesheet, planning services + an api-gateway),
Postgres per service, Kafka, a React frontend, run locally via `Program/microservice/docker-compose.yml`.
The full task list and current status are in `docs/PRODUCTION-READINESS-TODO.md` (read it first).

## Where things stand
- Work is on branch `feature/ops-readiness-config`. Most changes are **uncommitted** in the working tree —
  commit them early (`.env` is gitignored; do not commit it).
- The stack **boots** via `docker compose up`, but nothing has been tested. Booting ≠ verified.
- Security fixes B2 (disabled-user refresh block), B3 (token-version revocation), B4 (leave IDOR/tenant
  scoping), B8 (login lockout + auth rate limiting), S1 (internal `/public` service-token), S2 (local JWT
  validation at the gateway), S4 (CORS) and B7 (env-driven admin bootstrap) are implemented but UNTESTED.

## Hard-won gotchas (don't relearn these)
- **Env vars override `application.yml`.** `docker-compose.yml` sets `SPRING_*` env that wins over yaml.
- **B6 is currently reverted:** the 5 services run with `ddl-auto=update` + `flyway.enabled: false` because
  the `V1__init_schema.sql` migrations only "adopt" an existing Hibernate schema and FAIL on a fresh DB.
- Build/tests need **JDK 21** (+ Maven). Dockerfiles build from source, so `docker compose up --build` picks
  up code changes; env-only changes just need `docker compose up` (no rebuild).
- `docker compose config` validates ALL profiles, so profile-gated `tls`/`backup` vars must exist in `.env`.
- Changing a DB password requires `docker compose down -v` (Postgres ignores it on an existing volume).

## What to do, in priority order

1. **Run the test suites (V1) — do this first.** For each service under `Program/microservice/`:
   `./mvnw test`. Fix every failure. The untested code above is the priority. Report which pass/fail.

2. **Fix B6 properly (blocker).** Regenerate complete, fresh-DB-safe Flyway migrations for auth, user,
   contract, payroll, timesheet — e.g. bring each schema up once with `ddl-auto=create`, dump the schema
   (`pg_dump --schema-only`), and make that the real `V1`. Then revert the temporary workaround: set the 5
   services back to `SPRING_JPA_HIBERNATE_DDL_AUTO=validate` (compose) and `flyway.enabled: true` (yaml),
   and confirm a `docker compose down -v && up` builds a clean schema.

3. **Two-company tenant-isolation test (V3).** Create two companies, log in as company A, and confirm you
   cannot read/modify company B's users, leave, contracts, or payslips (exercises B4 + S1). This is the
   highest-value manual check.

4. **Finish B1 secrets.** Purge the old JWT/HMAC secret from git history (BFG or git-filter-repo), force-push,
   have collaborators re-clone. Generate fresh production secrets (the local dev values were exposed in chat).

5. **B7 first admin.** Set `BOOTSTRAP_ADMIN_USERNAME/EMAIL/PASSWORD` in `.env`, restart auth-service, log in,
   confirm the forced password change works, then blank the bootstrap password again.

6. **S5 TLS.** For any non-local environment, provide real certs and run the `tls` compose profile; enable
   `GATEWAY_REQUIRE_HTTPS`/`GATEWAY_HSTS_ENABLED`. Currently plain HTTP.

7. **Cleanup C1 / C6.** Delete the junk files in `Program/microservice/` (`onClick`, `onBlur`, `onFocus`,
   `onKeyDown`, `onContextMenu`, `className`, `tabIndex`, `ref`, `dir`) and the root `.$System Design.drawio.bkp`.
   C6 (rename the `com.pm` package) is optional and large — only with an IDE refactor + full test run.

8. **Commit + PR.** Commit the working-tree changes on `feature/ops-readiness-config` and open a PR into main.

## Constraints
- Do not commit `.env` or `target/` (both should stay untracked).
- Prefer per-account/tenant scoping and env-driven secrets; never hardcode secrets or reintroduce
  `ddl-auto=update` for production.
- After each change that alters config baked into a jar, rebuild (`--build`); for compose env-only changes,
  just recreate containers.
