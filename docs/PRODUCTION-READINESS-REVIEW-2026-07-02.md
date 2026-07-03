# ParadePaard — Independent Production-Readiness Review

**Date:** 2026-07-02
**Scope:** Full codebase — architecture, backend (7 Spring Boot services), API gateway, frontend (React/Vite), database design, auth/authz, security, validation, error handling, logging, performance, scalability, core product flows.
**Method:** Static review of source. Nothing was run; findings on runtime behaviour are reasoned from the code and noted as such.

---

## Verdict

**Not ready to ship.** The product is feature-rich and largely coherent, but it carries several **hard security blockers** (committed secrets, a disabled-user token bypass, and cross-tenant data leaks in the leave module) and **operational blockers** (a broken production config profile, schema managed by `ddl-auto: update` in most services, seed/admin credentials committed). None of these are hard to fix, but they must be fixed before any real-world deployment because they either expose one company's data to another or make the prod deployment non-functional/insecure.

A realistic path to production is roughly **1–2 focused weeks**: rotate and externalise all secrets, close the authorization gaps, fix the prod profile and migration strategy, then re-verify the core flows end to end.

---

## How the system is put together

Seven Spring Boot services (auth, user, contract, payroll, planning, timesheet) sit behind a Spring Cloud Gateway, each with its own Postgres database, wired together with Kafka (events) and gRPC (synchronous cross-service reads). The frontend is a React 19 + Vite SPA talking only to the gateway. Auth is JWT-based: the gateway validates every request by calling `auth-service /validate`, then forwards the bearer token; each downstream service *also* validates the JWT signature locally (shared HMAC secret) and enforces fine-grained permissions with Spring `@PreAuthorize`. Tokens live in `httpOnly` cookies. Multi-tenancy is by `companyId` claim carried in the JWT.

The permission model is the strong part of the design: a large catalogue of `CAN_*` authorities, method-level checks on nearly every endpoint, self-vs-admin resolvers (`@userPermission.isSelf`, `@contractPermission.isOwner`, `@payrollPermission.isOwner`), and a platform-admin scope-switch. Contract, payroll and timesheet endpoints consistently scope reads by the token's `companyId`. The problems below are where that discipline breaks down.

---

## Blocker issues (must fix before release)

### 1. Secrets are committed to the repository
**What:** The JWT signing secret is hardcoded in `docker-compose.yml` and duplicated verbatim in every service's `application.yml` (`cc028f2d…8741ad`). The password-reset HMAC secret, the Postgres password (`password`), the default SES from-address, and the admin bootstrap password all live in the repo too.
**Why it matters:** Anyone with repo access can forge valid tokens for any user of any company (the secret is symmetric and shared by every service), decrypt reset tokens, and reach the databases. This is the single most serious issue.
**Where:** `Program/microservice/docker-compose.yml`; `*/src/main/resources/application.yml` (auth, user, contract, payroll, timesheet); `planning-service/.../application.yml`.
**Severity:** Critical.
**Fix:** Move every secret to environment variables / a secret manager, remove them from the repo, and **rotate all of them** (they must be considered compromised). The compose file already uses `${VAR:?...}` syntax for the SMTP creds — apply the same to `JWT_SECRET`, DB passwords, and HMAC. Purge from git history.
**Blocks release:** Yes.

### 2. Disabled users can still refresh tokens (auth bypass)
**What:** `AuthService.authenticate()` rejects login when `user.isDisabled()`, but `AuthService.refreshToken()` does **not** check the disabled flag. It loads the user, re-issues a fresh access+refresh pair, and returns.
**Why it matters:** Disabling or off-boarding a user does not actually cut off access. Anyone holding a valid refresh cookie (7-day lifetime) keeps minting 15-minute access tokens indefinitely. Combined with there being no server-side token revocation (logout only clears cookies client-side), "disable user" is effectively cosmetic until the refresh token naturally expires.
**Where:** `auth-service/.../service/AuthService.java` — `refreshToken(String)` (~line 458) vs. the `isDisabled()` guard at ~line 223.
**Severity:** High.
**Fix:** In `refreshToken`, after loading the user, reject with 401 if `isDisabled()`. Longer term, add a token version / revocation list so disable and logout invalidate outstanding refresh tokens immediately.
**Blocks release:** Yes.

### 3. Cross-tenant data leak + IDOR in the leave module
**What:** The leave service ignores company scoping and, in several places, ignores the `userId` path segment used for the authorization check.

- `getAllLeaveRequests(status)` calls `leaveRepo.findByStatus(...)` / `findAll()` with **no company filter**. An admin with `CAN_VIEW_ALL_LEAVE_REQUESTS` in company A sees every company's leave requests.
- `GET /users/{userId}/leave-requests/{requestId}` is authorised by `@userPermission.isSelf(#userId, …)`, but the handler calls `getLeaveRequest(requestId)` which looks the record up **by requestId only**. A normal user can put their own id in `{userId}` (passing the self-check) and any other user's `{requestId}` and read it. The same pattern applies to `updateLeaveRequest` and `deleteLeaveRequest` — a self-user can edit or delete another user's leave request.
- `getUserLeaveRequests(userId)` is likewise not company-scoped.

**Why it matters:** Direct horizontal privilege escalation and cross-tenant exposure of personal HR data (dates, sick leave, reasons).
**Where:** `user-service/.../service/impl/LeaveRequestServiceImpl.java` (`getAllLeaveRequests`, `getLeaveRequest`, `updateLeaveRequest`, `deleteLeaveRequest`, `getUserLeaveRequests`); `controller/LeaveRequestController.java`.
**Severity:** High.
**Fix:** Scope every read/write to the caller's `companyId` (the approve/reject/cancel paths already do this via `getScopedOrThrow`). For the by-id reads/updates/deletes, verify the loaded request's `user.userId` matches the `{userId}` in the path (or that the caller has the "all" authority) before returning. Reuse the `getScopedOrThrow` pattern everywhere.
**Blocks release:** Yes.

### 4. Production config profile is broken/stale
**What:** `api-gateway/src/main/resources/application-prod.yml` is a leftover from the original "patient management" template. It routes `/api/patients/**` to `host.docker.internal:4000`, defines no routes for user/contract/payroll/planning/timesheet, and has no CORS config. The whole codebase is still in package `com.pm` (patient management) with a stale medical scaffold.
**Why it matters:** If the app is ever run with the `prod` Spring profile, the gateway won't route to the real services and auth flows won't work. There is effectively no working production configuration — only the dev `application.yml` with hardcoded `localhost` origins.
**Where:** `api-gateway/src/main/resources/application-prod.yml`; also `application.yml` hardcodes `http://localhost:5173` as the only CORS origin across gateway and auth-service.
**Severity:** High (operational).
**Fix:** Write a real `application-prod.yml` mirroring the dev routes, drive the frontend origin and service URLs from env vars, and delete the patient-service remnants.
**Blocks release:** Yes.

### 5. Schema is managed by Hibernate `ddl-auto: update` in production
**What:** In `docker-compose.yml`, auth/user/contract/payroll/timesheet all run with `SPRING_JPA_HIBERNATE_DDL_AUTO=update` and `SPRING_SQL_INIT_MODE=always`. Only planning-service uses Flyway migrations with `ddl-auto: validate`.
**Why it matters:** `update` never drops or safely migrates columns, silently diverges between environments, and can't be reviewed or rolled back — a well-known way to corrupt or lock a production schema. `SQL_INIT_MODE=always` re-runs `data.sql` on every boot (the auth seed re-asserts the admin account each start). The mixed strategy (Flyway in one service, auto-DDL in five) means there's no single source of truth for the schema.
**Where:** `docker-compose.yml` (per-service env); `*/src/main/resources/data.sql`; planning is the exception with `db/migration/V1..V7`.
**Severity:** High (operational / data-integrity).
**Fix:** Adopt Flyway (or Liquibase) across all services, set `ddl-auto: validate`, and make seeds idempotent and environment-gated (don't seed a known admin password in prod).
**Blocks release:** Yes.

### 6. Default admin credentials are committed and auto-seeded
**What:** `README.md` and `auth-service/.../data.sql` ship a platform admin (`super.admin` / `sanne.admin`, password `ParadeAdmin123!`) with a committed bcrypt hash, seeded on every boot via `SQL_INIT_MODE=always`.
**Why it matters:** A known admin credential in the repo is a guaranteed break-in on any deployment that uses the seed.
**Where:** `README.md`; `auth-service/src/main/resources/data.sql`.
**Severity:** High.
**Fix:** Remove seeded credentials from prod; bootstrap the first admin via a one-time secure process (env-provided password or an invite flow), and force a password change on first login.
**Blocks release:** Yes.

---

## High-value issues (fix before or immediately after launch)

### 7. "Public" internal endpoints leak cross-company data through the authenticated gateway
`GET /api/users/public/company-settings/{companyId}` and `POST /api/users/public/display-names` are `permitAll` at the service and intended for service-to-service calls, but they are reachable via the gateway with *any* valid token and take an arbitrary `companyId` / list of `userId`s. A user in company A can read company B's settings (name, address, tax templates) and resolve arbitrary user display names. **Fix:** authenticate service-to-service calls separately (mTLS or a service token) and don't expose `/public/**` through the browser-facing gateway, or scope them to the caller's company. *Severity: Medium-High.*

### 8. Gateway does a network round-trip to auth-service on every request
`JwtValidationGatewayFilterFactory` calls `auth-service /validate` for each request, then downstream services validate the same JWT's signature locally anyway. This is redundant (double validation), adds latency to every call, and makes auth-service a single point of failure and a throughput bottleneck for the entire platform. **Fix:** validate the JWT signature at the gateway locally (it can hold the same key) and drop the per-request HTTP call; reserve remote validation for revocation checks if/when you add them. *Severity: Medium (performance/scalability).*

### 9. Verbose DEBUG logging of security and web layers
auth-service and user-service set `org.springframework.security: DEBUG` and `org.springframework.web: DEBUG`; the gateway logs `org.springframework.cloud.gateway: DEBUG`. In production this floods logs and can print headers/tokens. **Fix:** default to `INFO`/`WARN`, make log levels env-driven. *Severity: Medium.*

### 10. No server-side session/token revocation
Logout only clears cookies; there is no refresh-token store, rotation-with-invalidation, or blocklist. A stolen refresh token is valid for its full 7 days, and (per #2) even disabling the user doesn't stop it. **Fix:** persist refresh tokens (or a token version per user) and invalidate on logout/disable/password-reset. *Severity: Medium-High.*

### 11. CORS configuration is permissive and hardcoded
`auth-service` `CorsConfigurationSource` sets `allowedOriginPatterns("*")` *and* `allowedOrigins(localhost:5173)` with `allowCredentials(true)`. Mixing a wildcard pattern with credentialed CORS is fragile and risky, and the only origin is a dev URL. **Fix:** drive allowed origins from config per environment; never combine `*` patterns with credentials. *Severity: Medium.*

---

## Design / maintainability issues (won't block, will hurt later)

- **Repurposed template leftovers.** Everything is package `com.pm` (patient management); the prod gateway still references `patient-service`. This is confusing and error-prone. Rename to the real domain when convenient. *Low.*
- **Junk files committed.** `Program/microservice/` contains a set of empty files named `onClick`, `onBlur`, `onFocus`, `onKeyDown`, `onContextMenu`, `className`, `tabIndex`, `ref`, `dir` — accidental shell-redirect artifacts. Delete them; they suggest the repo isn't being kept clean. There's also a `.$System Design.drawio.bkp` lock file at the root. *Low.*
- **Dead auth code in the frontend.** `AuthContext.getCachedStatus()` reads `token`/`accessToken`/`authToken` from `localStorage`/`sessionStorage`, but tokens are stored in `httpOnly` cookies and never written to storage, so that branch is always null and the "cached status" optimisation never fires. Harmless but misleading; remove it. *Low.*
- **`JwtUtil` overloaded constructors.** Six overloads of `generateAccessToken`/`generateRefreshToken` plus a comment "was plusSeconds on millis" — signs of churn. Collapse to one builder to reduce the chance of issuing a token with the wrong claims. *Low.*
- **Broad exception swallowing.** Several controllers catch `Exception` and return generic `badRequest` (e.g. profile/logo upload, CAO assign), which hides real failures (e.g. a DB error looks like a validation error). Narrow the catches and log server-side. *Low-Medium.*
- **`.git/config` has a malformed line** (git reported `bad config line 24`). Worth cleaning so tooling/hooks behave. *Low.*
- **Frontend permission checks are cosmetic only** (correctly — the backend enforces). That's fine, but note the UI trusts `getPermissions`; ensure no sensitive data is fetched purely on a client-side gate. Backend `@PreAuthorize` coverage looked consistent in contract/payroll/timesheet. *Informational.*

---

## Core product flows — status from the code

- **Login / register / password reset:** Work. Cookies are `httpOnly`, `Secure`, `SameSite=Strict`. Reset tokens are random 32-byte + HMAC-hashed with a TTL — good. Caveats: the disabled-user refresh bypass (#2) and committed secrets (#1).
- **Role-based access:** Solid permission model, method-level enforcement, self/owner resolvers. Weak spot is the leave module (#3).
- **Onboarding / employee setup / company setup:** Present and reasonably complete (status state machine `PENDING_SETUP → … → ACTIVE`, admin review flow, ID-document handling with dedicated view permissions). Verify end-to-end after fixing auth.
- **Contracts / signing / payslips:** Company-scoped reads, owner checks on PDF/sign, employer-signature and finalize flows gated by distinct permissions — the best-guarded area. CAO wage tables exist but (per the team's own report) aren't yet wired into live contract creation.
- **Planning / billing rates / travel claims:** Uses Flyway, custom auth converter, permission gates. Looks the most production-disciplined service.
- **Leave requests:** Functionally complete (balances, accrual, reserve/restore) but has the authorization holes in #3 — treat as blocked until scoped.
- **Messaging:** SSE-based shared inbox, user/admin split with `CAN_MANAGE_MESSAGES`. Looks coherent; load-test SSE fan-out before relying on it at scale.
- **Payroll finance / jaaropgaaf / verzamelloonstaat:** Extensive, permission-gated. Depends on the schema strategy being fixed (#5) since payroll correctness is unforgiving.

---

## Prioritized checklist to ship

**Must fix (blockers):**

1. Remove and **rotate** all secrets; externalise via env/secret manager; purge from git history. (#1)
2. Add the `isDisabled()` check to `refreshToken`; add token revocation on disable/logout. (#2, #10)
3. Company-scope and de-IDOR the leave endpoints (list, get-by-id, update, delete). (#3)
4. Write a working `application-prod.yml`; drive origins/URLs from env; delete patient-service remnants. (#4)
5. Move all services to versioned migrations (Flyway) with `ddl-auto: validate`; make seeds idempotent and env-gated. (#5)
6. Remove committed/seeded admin credentials; secure first-admin bootstrap. (#6)

**Should fix (before or right after launch):**

7. Lock down `/public/**` internal endpoints (service auth, don't expose via gateway). (#7)
8. Validate JWT locally at the gateway; drop the per-request `/validate` call. (#8)
9. Set production log levels to INFO/WARN; ensure no token logging. (#9)
10. Harden CORS to per-environment origins without wildcard+credentials. (#11)

**Cleanup (maintainability):**

11. Delete junk files (`onClick`, `onBlur`, … , `.drawio.bkp`), fix `.git/config`, remove dead frontend token code, consolidate `JwtUtil`, narrow exception handling, rename `com.pm`.

---

*This review was static. After the blockers are addressed, run the full test suites (the team's own checklist under `docs/PRODUCTION-READINESS-TESTING-CHECKLIST.md` is a good base) and do a manual end-to-end pass of each flow above — especially a two-company tenant-isolation test that tries to read the other company's users, leave, contracts, and payslips.*
