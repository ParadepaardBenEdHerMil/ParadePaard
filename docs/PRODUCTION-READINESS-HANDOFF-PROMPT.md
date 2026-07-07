# Handoff prompt — finish ParadePaard for launch ("shelf ready")

**Rewritten 2026-07-07** to match the actual repo state. The previous version described this work as
uncommitted on `feature/ops-readiness-config` and "mostly untested" — that is stale. The ops-readiness
and deploy work is now **merged to `main`** (PRs #22 and #24) and a demo is **deployed** (nginx TLS +
Postgres-per-service on the target host). Test suites are green. What remains is a short list of
**launch blockers, live validation, CI, and unbuilt product features** — not the security refactor,
which is done.

Copy everything below the line into a fresh agent session, or use it as a checklist.

---

You are finishing ParadePaard for launch: a Spring Boot 3.5 / Java 21 microservice payroll system
(auth, user, contract, payroll, timesheet, planning + api-gateway), Postgres per service, Kafka, a
React/Vite frontend. Run locally from `Program/microservice/` via `docker compose up -d --build`
(dev, plain HTTP) or the prod/TLS profile behind nginx. The canonical status is
`docs/PRODUCTION-READINESS-TODO.md`; read it and `docs/STATUS-PLAIN-LANGUAGE.md` first.

## Where things actually stand (2026-07-07)
- **Merged to `main`.** The ops-readiness branch (PR #22) and deploy config (PR #24) are in `main`.
  The latest commits add nginx TLS termination, a DigitalOcean deploy checklist, and bootstrap-admin
  propagation to user-service. A **demo is live**. (Note: the working copy is currently on a
  **detached HEAD** at the tip — check out `main` before committing, and clear the stale
  `.git/index.lock` your editor is holding, or commits will fail.)
- **Tests are green (V1 done).** All service suites + frontend + integration-test passed locally on
  2026-07-05; integration-test ran against a live stack (confirmed run, not skipped).
- **The security refactor is done and verified**, not "untested": B2 (disabled-user refresh block),
  B3 (token-version revocation), B4 (leave IDOR/tenant scoping — live-probed 8/8), B5 (prod gateway
  config), B6 (Flyway `validate` on all 5 services, pg_dump-faithful migrations), B8 (login lockout +
  auth rate-limit), S1 (internal service-token, live-probed), S2 (local JWT validation at gateway),
  S3 (prod log levels), S4 (CORS), S6 (health probes), S7 (backup scripts). Junk files (C1) deleted.

## Hard-won gotchas (don't relearn these)
- **Env vars override `application.yml`.** `docker-compose.yml` sets `SPRING_*` env that wins over yaml.
- **Migrations are full PostgreSQL** (captured via `pg_dump` so Hibernate `validate` matches 1:1).
  Do **not** rewrite them to be H2-compatible; DB/app-context tests use Postgres/Testcontainers (needs
  a Docker daemon in CI).
- **Seed layout:** `V1__init_schema.sql` = schema only; auth `V2__seed_platform_reference_data.sql` =
  company/roles/permissions seed that `AdminBootstrapRunner` depends on. Tests asserting seed data read V2.
- Build/tests need **JDK 21** + Maven. Dockerfiles build from source and run `-DskipTests`, so run
  `mvn test` locally/CI to actually exercise tests. `--build` picks up code changes; env-only changes
  just need `docker compose up`.
- `docker compose config` validates ALL profiles, so profile-gated `tls`/`backup` vars must exist in `.env`.
- Changing a DB password requires `docker compose down -v` (Postgres ignores it on an existing volume).

## What to do, in priority order

### Launch blockers (must finish before real customer data)
1. **B1 — purge the leaked secret from git history + rotate all prod secrets.** The old JWT signing
   secret (`cc028f2d…`, symmetric, shared by every service) **is still in git history** — anyone who
   has seen the repo can forge tokens for any user in any company. This is the top risk. Coordinated,
   stop-the-world: everything committed + pushed, then BFG / git-filter-repo purge, force-push,
   everyone re-clones. Generate brand-new values for `JWT_SECRET`, `PASSWORD_RESET_HMAC_SECRET`, the
   six `*_SERVICE_DB_PASSWORD`s, and rotate SES SMTP creds (needs AWS access — a human step). Runbook:
   `docs/runbooks/B1-secret-rotation.md`. **Done when:** no secret exists in repo *or history*; all
   services boot from env; old values rotated.
2. **B7 — create the real first admin.** Flow is validated on dev (idempotent, `mustChangePassword`
   enforced, no-op when unset). On the target env after B1: set `BOOTSTRAP_ADMIN_USERNAME/EMAIL/PASSWORD`
   in `.env`, boot, log in, confirm forced password change, then blank the bootstrap password again.
3. **S5 — confirm TLS on the target env.** nginx TLS config exists and the demo runs behind it; verify
   real certs, HTTP→HTTPS redirect, HSTS, and that refresh/session cookies are `Secure` in prod.

### Validation (prove it, don't assume it)
4. **V2 — manual end-to-end pass** of every core flow: onboarding, login, RBAC, planning, payroll,
   contracts, payslips, leave, messaging, admin/company/employee setup. Deliver an executable checklist
   under `docs/validation/`; automate what's scriptable, flag human-only steps.
5. **V4 — auth-abuse black-box pass.** Confirm end-to-end: repeated failed logins throttle/lock (B8),
   a disabled user can no longer refresh (B2), and logout/disable/password-reset immediately kill
   outstanding tokens (B3).
6. **V3 finish — live-probe contracts + payslips cross-tenant.** Drive the contract→timesheet→payroll
   lifecycle to generate real data in two companies, then attempt cross-tenant reads (should be denied).
   Leave + S1 are already live-probed; contracts/payslips are only statically confirmed.
7. **S7 — run a real restore drill.** Backup → wipe → restore against a throwaway prod/TLS stack;
   capture evidence in `deploy/OPERATIONS.md`. Scripts exist; no drill has been done.
8. **V5 — prod-profile deploy dry-run.** Full stack on the prod profile behind TLS, every service
   passing its health probe, no secrets or DEBUG in logs.

### Engineering gaps that block "shelf ready"
9. **CI/CD pipeline.** There is **no `.github/workflows/`** — nothing runs the (now-green) suites on
   push/PR, so regressions ship silently. Add a pipeline: `mvn verify` per service + `npm test`, with a
   Postgres service or Testcontainers (Docker daemon required for the migration tests), building on
   PRs into `main`.
10. **C6 (optional) — rename the `com.pm` package.** The code is still in the original
    patient-management namespace (~2k refs). Do it alone with an IDE refactor + full test run; not
    launch-blocking.

## Product features still missing (from STATUS + `TODO/TODO.txt`) — needed for a complete product, not just a safe one
- **Leave balances & accrual.** Leave is currently only CRUD — it doesn't track entitlement, subtract
  taken days, block clashing shifts, or feed pay. Needs building.
- **CAO pay-scale data + exact-cent tests.** Minimum wage is enforced, but per-industry CAO scale
  tables aren't in code yet (the "CAO auto hook" in TODO).
- **4-weekly (vierwekelijks) pay cycle.** Common Dutch cycle, not yet supported — needs a decision then build.
- **Super-super-admin console.** A cross-company admin that can view/adjust everything, create a new
  company, and onboard its first users (today a company with no privileged user can't be onboarded).
- **Product polish from `TODO/TODO.txt`:** backend-driven location list tied to client, a modular
  (admin-editable) application form, finer permissions (e.g. contract-view vs employee-ID visibility),
  history/contract page improvements, notifications.

## Constraints
- Do not commit `.env` or `target/` (both stay untracked).
- Prefer per-account/tenant scoping and env-driven secrets; never hardcode secrets or reintroduce
  `ddl-auto=update` for production.
- Checkout `main` (not detached HEAD) and clear `.git/index.lock` before committing. After config baked
  into a jar changes, rebuild (`--build`); for compose env-only changes, just recreate containers.
- Follow the repo git convention: feature branches named `feature/...` (never `claude/...`), and only
  for large changes.
