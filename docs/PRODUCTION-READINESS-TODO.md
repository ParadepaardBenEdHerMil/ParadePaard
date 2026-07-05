# ParadePaard — Production-Readiness To-Do List

**Created:** 2026-07-02
**Updated:** 2026-07-03 — added B8 (auth rate limiting) and S5–S7 (TLS, health probes, backups); these are launch-safety gaps not in the original security review.
**Source:** `PRODUCTION-READINESS-REVIEW-2026-07-02.md`
**How to read this:** Work top to bottom. Everything under "Blockers" must be done before any real deployment. "Should do" can land just before or right after launch. "Cleanup" is safe to defer but improves maintainability. Each item says *what to do*, *why*, and *where*.
**Note on line numbers:** Some services (notably `auth-service`) have been refactored since the review, so the exact line references below may have drifted. Treat them as pointers and confirm the method/config by name before editing.

---

## Current status — 2026-07-05

**Branch:** `feature/ops-readiness-config`. Most code changes below are implemented but **uncommitted** in the working tree (only the "untrack build artifacts" step is committed). The stack **boots locally** via `docker compose up`, but "boots" is not "verified".

**NOT production-ready yet.** The remaining hard gate is:

1. **No tests have run.** B2/B3/B4/B8 and S1/S2/S4 were written but never compiled or unit-tested in this effort. Run `mvn test` (or `./mvnw test`) in every service and fix failures before trusting any of it. (This is V1.)

**B6 runtime-fixed (2026-07-05), but the test suites are broken by it.** The five services are back on `ddl-auto=validate` with `flyway.enabled: true`; the `SPRING_JPA_HIBERNATE_DDL_AUTO` env in `docker-compose.yml` is `validate`. Complete fresh-DB migrations were regenerated from the authoritative Hibernate schema (captured via `pg_dump`) and **verified on a `docker compose down -v` clean boot**: Flyway builds every schema and Hibernate `validate` passes on all six services. **This is runtime verification only — NOT suite verification.** The migrations are now full PostgreSQL, but the unit/`@SpringBootTest`/`@DataJpaTest` suites still run on H2, so Flyway executes Postgres syntax against H2 and those suites fail; moving the seed from `V1` to `V2` also broke tests that read `V1__init_schema.sql`. The branch is **not** PR-ready until the suites move to Postgres/Testcontainers (or a Postgres test profile) and the stale seed assertions are updated — see `NEXT-STEPS-TWO-STREAM-PLAN.md`.

**Item status:**

- B1 — env wiring + `.env.example` done; `.env` filled locally; build artifacts untracked. **Left:** purge the old secret from git history (BFG), and generate fresh prod secrets (the local dev values were shared in chat).
- B2, B3, B8 — implemented, **untested**.
- B4 — implemented and **verified live (2026-07-05, see V3)**. Two-company probe confirms leave reads/writes are company-scoped and the by-id IDOR is closed (cross-tenant read/update/delete/approve all denied; owner-of-own still works).
- B5 — done (prod gateway config).
- B6 — **runtime-verified only; suites broken by it (2026-07-05).** `V1__init_schema.sql` for auth/user/timesheet/contract/payroll regenerated as complete fresh-DB schemas (captured from the running Hibernate schema via `pg_dump`, so `validate` matches 1:1). auth adds `V2__seed_platform_reference_data.sql` (idempotent company/roles/permissions seed that `AdminBootstrapRunner` depends on); auth `V100` retained as an idempotent no-op / adopt-path safety net. All 5 services flipped to `ddl-auto: validate` + `flyway.enabled: true` in both `application.yml` and compose. **Verified on a `down -v` fresh boot (Flyway applied every migration, Hibernate `validate` passed) — runtime only.** The unit/app-context suites still run on H2 and now fail (Postgres-only migrations under H2; stale `V1` seed assertions after the seed moved to `V2`). Migrations must NOT be dumbed down to H2 — move DB/app-context tests to Postgres/Testcontainers instead (see `NEXT-STEPS-TWO-STREAM-PLAN.md`). Legacy adopt-path backfills and the stale `functions` seed were dropped (all DBs were empty).
- B7 — bootstrap runner implemented, **untested**; no admin created yet (`BOOTSTRAP_ADMIN_*` still blank).
- S1 — implemented and **verified live (2026-07-05, see V3)**. With `INTERNAL_SERVICE_TOKEN` set (it is, in `.env`), a browser user is blocked from `/api/users/public/company-settings/{otherCompanyId}` (403) and `/public/display-names` is scoped to the caller's own company. S2, S4 — implemented, **untested**. S2 needs `JWT_SECRET` on the gateway (wired in compose).
- S3, S5, S6, S7 — implemented. S5 (TLS) only activates with real certs + the `tls` compose profile; currently plain HTTP. S7 backup scripts exist but restore is untested.
- C1 — **not done** (junk files still present; delete them + the `.drawio.bkp`). C3/C4/C5 — done. C2 — n/a. C6 (package rename) — not done, optional.
- V1 (run test suites), V2 (manual end-to-end), V3 (two-company tenant-isolation test) — **none done.** V3 is the highest-value check for the B4/S1 tenant-isolation work.

---

## Blockers — must be done before shipping

### B1. Remove and rotate all secrets
**Do:** Take the JWT signing secret, password-reset HMAC secret, Postgres password, and SES credentials out of the repo and load them from environment variables / a secret manager. Then **generate brand-new values** for every one of them (the current ones are compromised because they've been in git). Purge the old values from git history.
**Why:** The JWT secret is symmetric and shared by every service, so anyone who has seen the repo can forge a valid token for any user in any company. This is the most serious issue.
**Where:** `Program/microservice/docker-compose.yml`; `auth/user/contract/payroll/timesheet/planning */src/main/resources/application.yml`.
**Done when:** No secret values exist anywhere in the repo or its history; all services start from env-provided secrets; old secrets are rotated.

### B2. Stop disabled users from refreshing tokens
**Do:** In `AuthService.refreshToken(...)`, after loading the user, return 401 if the account is disabled — the same check that login already does.
**Why:** Right now, disabling a user only blocks new logins. Anyone holding a refresh cookie keeps minting fresh access tokens for up to 7 days, so "disable user" doesn't really cut off access.
**Where:** `auth-service/src/main/java/com/pm/authservice/service/AuthService.java` — `refreshToken(String)` (~line 458); compare with the `isDisabled()` guard at ~line 223.
**Done when:** A disabled user's refresh request returns 401 and no new tokens are issued.

### B3. Add server-side token revocation
**Do:** Persist refresh tokens (or keep a per-user token version). Invalidate them on logout, on disable, and on password reset. Rotate the refresh token on each use.
**Why:** Logout currently only clears the browser cookie; there's no way to kill a stolen or off-boarded token server-side. This is what makes B2 fully effective.
**Where:** `auth-service` — `AuthService.logout()`, `refreshToken()`, `setUserDisabled()`, and the password-reset flow.
**Done when:** Logging out, disabling a user, or resetting a password immediately invalidates that user's outstanding refresh tokens.

### B4. Fix cross-tenant leaks and IDOR in the leave module
**Do:** Scope every leave read/write to the caller's `companyId`, and for the by-id endpoints verify the loaded request actually belongs to the `{userId}` in the path (or that the caller has the "view-all" authority). Reuse the existing `getScopedOrThrow` pattern that approve/reject/cancel already use.
**Why:** Three concrete holes: (a) `getAllLeaveRequests` returns every company's data with no company filter; (b) get/update/delete-by-id look up only by `requestId`, so a user can pass their own id in `{userId}` (passing the self-check) and someone else's `{requestId}` to read, edit, or delete another person's leave; (c) `getUserLeaveRequests` isn't company-scoped.
**Where:** `user-service/src/main/java/com/pm/userservice/service/impl/LeaveRequestServiceImpl.java` (`getAllLeaveRequests`, `getLeaveRequest`, `updateLeaveRequest`, `deleteLeaveRequest`, `getUserLeaveRequests`) and `controller/LeaveRequestController.java`.
**Done when:** A user in company A cannot see or touch company B's leave data, and a normal user cannot access another user's request by id.

### B5. Write a working production gateway config
**Do:** Replace the stale `application-prod.yml` (it still routes `/api/patients/**` to a non-existent patient service) with real routes for user/contract/payroll/planning/timesheet, matching the dev `application.yml`. Drive the frontend origin and service URLs from environment variables. Delete the patient-service remnants.
**Why:** If the app is ever launched with the `prod` profile, the gateway won't route to the real services and auth won't work — there is effectively no working production configuration today.
**Where:** `api-gateway/src/main/resources/application-prod.yml` (and `application.yml`, which hardcodes `http://localhost:5173`).
**Done when:** The gateway routes correctly under the prod profile with env-driven origins and URLs.

### B6. Move all services to versioned migrations
**Do:** Adopt Flyway (planning-service already uses it) across auth/user/contract/payroll/timesheet. Set `ddl-auto: validate` everywhere and stop using `SQL_INIT_MODE=always`. Make any seed data idempotent and environment-gated.
**Why:** Five of six services currently let Hibernate auto-alter the schema (`ddl-auto: update`), which never safely migrates or rolls back and silently diverges between environments — dangerous for a payroll system. `SQL_INIT_MODE=always` also re-runs seed SQL on every boot.
**Where:** `docker-compose.yml` per-service env; `*/src/main/resources/db/migration`.
**Done when:** Every service's schema is defined by reviewed migration files and `ddl-auto` is `validate`.

### B7. Remove the committed default admin account
**Do:** Stop seeding known platform-admin credentials in production. Bootstrap the first admin through a one-time secure process (env-provided password or an invite flow) and force a password change on first login. Remove reusable credentials from the README.
**Why:** A known admin password living in the repo is a guaranteed break-in on any deployment that uses the seed.
**Where:** `README.md`; `auth-service/src/main/resources/db/migration`.
**Done when:** No default credentials ship in prod and the first admin is created securely.

### B8. Rate-limit and lock out brute-force on auth endpoints
**Do:** Add rate limiting / progressive lockout on `login`, `refresh`, and the password-reset request/confirm endpoints (e.g. a gateway rate-limit filter plus per-account failed-attempt lockout). Also cap and throttle the "forgot password" endpoint so it can't be used to enumerate accounts or spam SES.
**Why:** There is no throttling anywhere today (no lockout, no 429), so login and password-reset are wide open to credential-stuffing and brute force — unacceptable for a payroll system holding salary and identity data, and it also leaves the SES account open to abuse/cost.
**Where:** `auth-service` login/refresh/reset flows; `api-gateway` filter chain.
**Done when:** Repeated failed logins for an account are throttled/locked and reset requests are rate-limited, verified by a test.

---

## Should do — before or immediately after launch

### S1. Lock down the internal "public" endpoints
**Do:** Authenticate service-to-service calls separately (mTLS or a dedicated service token) and stop exposing `/public/**` through the browser-facing gateway — or scope them strictly to the caller's own company.
**Why:** `GET /api/users/public/company-settings/{companyId}` and `POST /api/users/public/display-names` are reachable with any valid token and accept an arbitrary company/user id, so a user in one company can read another company's settings and resolve arbitrary display names.
**Where:** `user-service` `UserController` (`/public/...`) and gateway route config.

### S2. Validate JWTs at the gateway instead of calling auth-service each request
**Do:** Verify the JWT signature locally in the gateway filter (it can hold the same key) and drop the per-request HTTP call to `auth-service /validate`. Keep a remote check only for revocation, once B3 exists.
**Why:** Every request currently makes a network round-trip to auth-service, which then re-validates downstream anyway — redundant latency, and it makes auth-service a bottleneck and single point of failure for the whole platform.
**Where:** `api-gateway/src/main/java/com/pm/apigateway/filter/JwtValidationGatewayFilterFactory.java`.

### S3. Set production log levels
**Status:** Done in `application.yml` / `application-prod.yml`: DEBUG defaults removed; Spring Security, web, gateway, CORS, and ROOT levels are env-driven and default to INFO.
**Do:** Default Spring Security / web / gateway logging to `INFO` or `WARN` and make levels env-driven. Confirm no tokens or auth headers are logged.
**Why:** auth-service, user-service, and the gateway currently log at `DEBUG`, which floods prod logs and can print sensitive headers.
**Where:** `*/src/main/resources/application.yml` logging sections.

### S4. Harden CORS
**Do:** Drive allowed origins from per-environment config; never combine a wildcard origin pattern with `allowCredentials(true)`.
**Why:** auth-service sets both `allowedOriginPatterns("*")` and a hardcoded localhost origin with credentials enabled — fragile and risky, and the only origin is a dev URL.
**Where:** `auth-service/.../config/SecurityConfig.java`; gateway `application.yml` CORS block.

### S5. Enforce TLS in transit and set HSTS
**Status:** Done for Compose deployments via `deploy/nginx/paradepaard.conf`, `tls-proxy`, gateway forwarded-header handling, HTTPS redirect, and HSTS/security headers.
**Do:** Terminate TLS in front of the gateway (ingress/load balancer or `server.ssl`), redirect HTTP→HTTPS, and send HSTS. Make sure refresh/session cookies are `Secure` in prod.
**Why:** There is no TLS config anywhere in the repo. Serving JWTs, login credentials, and payroll data over plaintext HTTP would expose them on the wire, and `Secure` cookies won't be honoured without HTTPS.
**Where:** ingress/reverse-proxy config; `api-gateway` cookie/security settings.

### S6. Add health and readiness probes
**Status:** Done for Compose deployments: all HTTP services use Actuator health/readiness config and compose healthchecks; every Postgres service has `pg_isready`.
**Do:** Enable Spring Boot Actuator health endpoints on each service and wire `healthcheck`/readiness+liveness probes in `docker-compose.yml` (and any orchestrator manifests).
**Why:** No service exposes a health endpoint and compose has no `healthcheck`, so the platform can route traffic to a service that started but isn't ready (e.g. DB not connected), causing silent failures on boot and deploy.
**Where:** `*/src/main/resources/application.yml` (actuator); `docker-compose.yml` per-service `healthcheck`.

### S7. Automated database backups with a tested restore
**Status:** Done for Compose deployments via the `postgres-backup` profile, backup/restore scripts, retained `postgres_backups` volume, and `deploy/OPERATIONS.md` restore drill.
**Do:** Schedule regular backups of every Postgres instance (or use a managed DB with point-in-time recovery) and actually perform a restore drill before launch.
**Why:** There is no backup mechanism in `infrastructure/` or compose. For a payroll system, losing or corrupting the database is catastrophic and effectively unrecoverable without backups; an untested backup is not a backup.
**Where:** `infrastructure/`; deployment/DB configuration.

---

## Cleanup — safe to defer, improves maintainability

### C1. Delete junk files
Empty accidental files in `Program/microservice/` (`onClick`, `onBlur`, `onFocus`, `onKeyDown`, `onContextMenu`, `className`, `tabIndex`, `ref`, `dir`) and the root `.$System Design.drawio.bkp` lock file.

### C2. Fix the malformed `.git/config`
Git reports `bad config line 24`. Clean it so hooks/tooling behave.

### C3. Remove dead token-reading code in the frontend
`AuthContext.getCachedStatus()` reads `token`/`accessToken`/`authToken` from local/session storage, but tokens live in httpOnly cookies and are never stored there, so the branch is always null. Remove it.
**Where:** `Program/frontend/src/context/AuthContext.tsx`.

### C4. Consolidate `JwtUtil` token builders
Six overloads of `generateAccessToken`/`generateRefreshToken` (plus a churn comment) increase the risk of issuing a token with the wrong claims. Collapse to one builder.
**Where:** `auth-service/.../util/JwtUtil.java`.

### C5. Narrow broad exception handling
Several controllers catch `Exception` and return a generic `badRequest`, hiding real errors (a DB failure looks like a validation error). Narrow the catches and log server-side.
**Where:** e.g. `UserController` upload/logo/CAO-assign handlers.

### C6. Rename the `com.pm` package / remove patient-management scaffold
The whole codebase is still in the original patient-management package namespace. Rename to the real domain when convenient to reduce confusion.

---

## Final verification (after blockers are fixed)

- **V1.** Run every service's test suite (the team checklist in `PRODUCTION-READINESS-TESTING-CHECKLIST.md` is a good base).
- **V2.** Manual end-to-end pass of each core flow: onboarding, login, role-based access, planning, payroll, contracts, payslips, leave, messaging, admin/company/employee setup.
- **V3.** **Two-company tenant-isolation test** — **DONE for leave + S1 public endpoints (2026-07-05); PARTIAL for contracts/payslips.** Automated black-box probe (`scratchpad/v3_tenant_isolation.sh`): stood up two companies via `/auth/register`, seeded user-service directly (see Kafka bug below), created a leave request per tenant with a unique sentinel, then probed cross-tenant from company A. Result: **8/8 isolation checks pass** — admin list-all is scoped to own company (no leak); by-id read/update/delete/approve of another tenant's leave return "not found"; owner-of-own still works (positive control); S1 `/public` company-settings returns 403 and display-names is company-scoped. Contracts/payslips were **not** live-probed (they need the full contract→timesheet→payroll lifecycle to produce data) but were **statically confirmed** to use the same JWT-`companyId`-then-scoped-query pattern (`requireContractInCompany`/`requireUserInCompany`; payroll `findByCompanyId…`). Follow-up: live-probe contracts/payslips once V2 can generate them.
  - **Two bugs surfaced by V3 (both pre-existing, unrelated to B6):**
    1. **user-service Kafka consumer — multi-company bug (HIGH) — FIXED 2026-07-05.** `KafkaConsumer.consumeEvent` inserted every new company into user-service with a hardcoded `name = "Company"`, but `companies.name` is UNIQUE. The **second distinct company** to register a user threw a duplicate-key violation; the event failed and was skipped after retries, so **no user in any new company propagated to user-service** — multi-tenant onboarding was broken. Fix: `UserRegisteredEvent` now carries `companyName` (proto + auth-service producer, which resolves the name from its own unique `companies` table), and the consumer creates the company stub with that real name, falling back to a unique `company-<id>` if the name is blank/taken — so the unique-name collision can't recur. Verified: users in two distinct companies (and a second user in one) all propagate, each company row gets its real name, no consumer errors. Producer contract test updated. Needs a consumer-side regression test (V1).
    2. **leave mapper `LazyInitializationException` (HIGH) — FIXED 2026-07-05.** `LeaveRequestServiceImpl` read the lazy `User` association in the response mapper with `open-in-view=false` and no transaction, so any leave call that returned data 500'd (empty lists happened to work). Added `@Transactional` (reads `readOnly`) to the service; this also makes `approve`'s balance-drawdown + status-change atomic. Rebuilt user-service and re-verified. Needs a regression test (V1).
- **V4.** **Auth abuse test** — confirm repeated failed logins get throttled/locked (B8), a disabled user can no longer refresh (B2), and logout/disable/password-reset immediately kill outstanding tokens (B3).
- **V5.** **Deploy dry-run on the `prod` profile** — start the full stack with the production gateway config (B5) behind TLS (S5), confirm every service passes its health probe (S6), and verify no secrets or DEBUG logs appear in output.
