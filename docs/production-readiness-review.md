# ParadePaard — Production-Readiness Review

**Date:** 2026-07-08
**Reviewer:** End-to-end product / security / QA pass over the whole repository
**Scope:** Frontend, backend microservices, database & migrations, authentication, authorization, service-to-service sync, deployment/ops, tests, and overall product completeness.
**Repository:** `github.com/ParadepaardBenEdHerMil/ParadePaard` (currently **public**)
**Live demo:** https://lambdamanager.com (throwaway showcase droplet — *not* the real ~2500-user production target)

---

## How to read this document

Severity levels used throughout:

- **P0 — Blocker.** Must be fixed before *any* real deployment with real users/data. Legal, security, or data-loss exposure.
- **P1 — Important.** Fix before launch or immediately after; materially hurts security, reliability, or trust.
- **P2 — Nice to have.** Polish, maintainability, and UX refinements that can follow launch.

Each issue lists **what**, **why it matters**, **where** (exact files/functions), **severity**, and a **suggested fix**.

A large amount of hard security work is already done and verified (per-endpoint authorization on all 7 services, tenant isolation on leave/contracts/payslips, per-account login lockout, token-version revocation, versioned Flyway migrations, TLS/HSTS via nginx, health probes, backup scripts). This review focuses on **what still stands between the current state and a polished, reliable product** — and there are still genuine blockers, most notably a live-secret exposure and personal data committed to a public repo.

---

## 1. Executive summary

ParadePaard is a Dutch payroll/HR/planning platform built as 7 Spring Boot microservices behind a Spring Cloud Gateway, with a React 19 + Vite SPA, PostgreSQL-per-service, and Kafka/gRPC for inter-service communication. The core domain logic (payroll to the cent, tax tables, minimum-wage enforcement, contracts, timesheets, leave) is mature and well tested (≈140 backend test files, 67 frontend test files). The security posture has been through a deliberate hardening pass and most of the previously-identified blockers (B2–B8, S1–S7) are implemented.

**However, it is not ready to ship to real users yet.** The dominant issues are not code defects — they are launch-safety and data-governance gaps:

1. **Live, usable secrets are in the public git history and have not been rotated** (AWS SES SMTP keys, the shared JWT signing secret, the password-reset HMAC secret, DB passwords, an old admin password). This is a standing compromise of the entire trust boundary and the single most urgent item.
2. **Real personal data and third-party copyrighted material are committed to the public repo** (`Project/` contains a real signed Dutch payroll agreement naming an actual employee, tax documents, meeting notes; `Books/` contains copyrighted PDFs). This is a GDPR/privacy and IP problem independent of the code.
3. **A public, unauthenticated, unthrottled file-upload endpoint** (`POST /applications`) accepts images + CVs with **no server-side size cap in user-service**, storing bytes directly in Postgres — an abuse, cost, and DoS vector.
4. **The frontend never refreshes access tokens.** The access-token cookie lives 15 minutes; there is no interceptor or timer calling `/auth/refresh`, so active users are silently logged out / start getting 401s mid-session. The backend refresh machinery exists but is effectively unused by the UI.
5. **No CI/CD, no application-level monitoring/error tracking, and a build-time config footgun** (`VITE_API_BASE_URL` bakes to `localhost:4004` unless a gitignored file is present on the droplet).

Also worth noting: there is **uncommitted work in the working tree** (a substantial "central audit log" feature spanning auth, user, and planning services) that is functional but not yet committed or covered end-to-end — the tree must be committed and re-verified before it can count as "done."

**Bottom line:** the product is *functionally* close, but shipping today would expose live credentials and real people's data on a public repo, leave a public upload endpoint open to abuse, and log users out every 15 minutes. Fix the P0 list first; the P1 list makes it feel reliable; the P2 list makes it feel polished.

---

## 2. Critical issues that must be fixed before launch (P0)

### P0-1 — Live secrets exposed in public git history, not yet rotated
- **What:** The repo is public and its history contains working credentials baked as `${VAR:-default}` fallbacks in old `docker-compose.yml` revisions: AWS SES SMTP access keys + passwords (eu-north-1), the shared `JWT_SECRET`, the 161-char `PASSWORD_RESET_HMAC_SECRET`, Postgres passwords, and an old admin password (`ParadeAdmin123!`). The in-tree `.idea/` leak was untracked in `c0478b7`, but **that commit is not pushed and the source secrets have not been rotated**, and history is not purged.
- **Why it matters:** The JWT secret is symmetric and shared by every service and the gateway (`api-gateway` `jwt.secret`, each service `SecurityConfig`), so anyone who has read the history can **forge a valid token for any user in any company**. The SES keys allow email abuse billed to the AWS account. This defeats every other auth control in the system.
- **Where:** git history of `Program/microservice/docker-compose.yml`; `docs/runbooks/B1-secret-rotation.md`; current live values referenced by `JWT_SECRET`, `PASSWORD_RESET_HMAC_SECRET`, `SES_SMTP_*`, `*_SERVICE_DB_PASSWORD`, `INTERNAL_SERVICE_TOKEN`.
- **Severity:** **P0 — this is the top risk.**
- **Suggested fix (in order):**
  1. At AWS IAM, **delete/rotate the exposed SES SMTP credentials now** (before any purge — assume they are already scraped).
  2. Generate fresh `JWT_SECRET`, `PASSWORD_RESET_HMAC_SECRET`, `INTERNAL_SERVICE_TOKEN`, and all DB passwords; install them in the droplet/production `.env` and any secret manager. Rotating the JWT secret invalidates all existing tokens (acceptable, forces re-login).
  3. Purge the values from history with `git filter-repo`/BFG (not currently installed on the dev box) and force-push; rotate again after, since a public repo may already be cloned/forked.
  4. Consider making the repo **private** until the purge is complete.

### P0-2 — Real personal data and copyrighted files committed to a public repo
- **What:** The tracked `Project/` directory contains a **real signed Dutch payroll agreement** (`Payrollovereenkomst - BT - Oproep NL - JAM! B.V - Femke Klijsen (1).pdf`) naming a real individual, plus tax documents, ID-looking scans (`Please photo 1–3.png`), meeting notes with names/dates, and business planning docs. `Books/` contains four copyrighted technical PDFs.
- **Why it matters:** Publishing a real person's employment/payroll contract is a **GDPR personal-data breach** (special-category-adjacent: salary, contract terms, likely BSN/bank details in the PDF). The books are a copyright violation. Both are live right now on a public GitHub repo and in history.
- **Where:** `Project/**` (esp. the payroll PDF, `SDU954505194.txt`, `Please photo *.png`, `Tax/`), `Books/**`.
- **Severity:** **P0 — privacy/legal.**
- **Suggested fix:** Remove these directories from the working tree *and* history (same purge pass as P0-1), add `Books/` and `Project/` (or the specific sensitive files) to `.gitignore`, and keep source material out of the code repo entirely (use a private drive). Notify the data subject if required by GDPR breach-notification rules.

### P0-3 — Public upload endpoint has no rate limiting and no size cap in user-service
- **What:** `POST /applications` (job application) is public (permitAll in `user-service/SecurityConfig`, no `JwtValidation` on the gateway route `user-service-public-applications`) and accepts a `profilePicture` (required) and `cv` (optional) as multipart. **user-service defines no `spring.servlet.multipart.max-file-size`/`max-request-size`** (only planning-service caps at 2 MB). Files are stored as bytes directly in the Postgres row (`JobApplication` `profilePictureBytes`/`cvBytes`).
- **Why it matters:** Anyone on the internet can submit unlimited large uploads with no throttling — filling the database, exhausting memory, and (with SES-backed flows nearby) enabling abuse. The auth `AuthRateLimitingFilter` covers `/login`, `/refresh`, `/forgot-password`, `/reset-password` but **not** this endpoint, and it lives in a different service anyway.
- **Where:** `user-service/.../controller/JobApplicationController.java` (`submit`), `user-service/.../service/JobApplicationService.java` (`submitApplication`), `user-service/src/main/resources/application.yml` (no multipart limits), gateway route `user-service-public-applications` in `api-gateway/.../application.yml`.
- **Severity:** **P0 — public abuse/DoS/cost.**
- **Suggested fix:** Add `spring.servlet.multipart.max-file-size: 5MB` and `max-request-size: 10MB` to user-service. Add per-IP rate limiting on `/applications` (extend the gateway with a `RequestRateLimiter` filter, or add a filter analogous to `AuthRateLimitingFilter`). Validate content-type strictly (already partly done via `JobApplicationUploadValidator`). Consider a CAPTCHA/honeypot on the public application form. Move large binaries to object storage rather than DB rows for scale.

### P0-4 — Frontend never refreshes the access token; sessions silently break after 15 minutes
- **What:** The access-token cookie is issued with `maxAge = 15 * 60` (`AuthService.responseAccessCookie`). There is **no code path in the SPA that calls `/auth/refresh`** — grep across `Program/frontend/src` finds no usage of the refresh endpoint and no axios/fetch interceptor that retries a 401 by refreshing. Logout calls `/auth/logout`; refresh is orphaned.
- **Why it matters:** An active user is silently logged out (or starts getting 401s that surface as broken screens) 15 minutes into a session, even while working. For a payroll/HR tool where people fill in long forms (onboarding, planning, payslip review), this is a serious reliability/UX defect and will read as "the app randomly logs me out." The backend already implements safe rotation/revocation (B2/B3) — the client just never uses it.
- **Where:** `Program/frontend/src/services/**` (no refresh call), `Program/frontend/src/context/AuthContext.tsx` (no proactive refresh), `Program/frontend/src/components/Navbar.tsx:495` (logout is wired, refresh is not). Backend counterpart: `AuthService.refreshToken` and gateway route `auth-service-refresh`.
- **Severity:** **P0 — core session flow is broken for real usage.**
- **Suggested fix:** Add a response interceptor (or a shared fetch wrapper) that, on a 401 from any API call, calls `POST /auth/refresh` once and retries the original request; on refresh failure, redirect to login. Optionally refresh proactively a minute before expiry. Add an integration test that a request after >15 min still succeeds via silent refresh.

### P0-5 — No CI/CD pipeline; "green" is only ever local
- **What:** There are no `.github/workflows` (the only matches are inside `node_modules`). Every "V1 passed locally" claim in the tracking docs is a manual run on one machine. There is no automated build, test, lint, image build, or deploy gate.
- **Why it matters:** For a payroll system, an untested change reaching production is a financial-correctness risk. Without CI you cannot prove `main` builds and passes on a clean checkout, and the deploy is a manual "clone on the droplet and rebuild" (per the demo runbook) with the documented `VITE_API_BASE_URL` footgun (see P1-6). This is the difference between "it works on my machine" and a product.
- **Where:** repository root (`.github/` absent); deploy is manual per `docs/DEPLOYMENT-CHECKLIST-DIGITALOCEAN.md` and the demo memory.
- **Severity:** **P0 for a payroll product going to real users** (arguably P1 if launch is a tiny pilot, but do not ship real payroll without it).
- **Suggested fix:** Add a CI workflow that runs `mvn -B test` for all 7 services + integration-test and `npm ci && npm run build && npm test` for the frontend on every PR. Add a deploy workflow (or at least a scripted, reproducible build) that bakes `VITE_API_BASE_URL` from an environment secret so a clean rebuild can never fall back to localhost.

---

## 3. Important issues that should be fixed soon (P1)

### P1-1 — Substantial audit-log feature is uncommitted and not end-to-end verified
- **What:** The working tree has a large, coherent but **uncommitted** change: a central audit log owned by user-service (`AuditLogController` `/internal/audit-log` + `/admin/audit-log`), with auth-service, planning-service (billing rates), and user-service (leave decisions, CAO assignment, company logo) all posting best-effort audit events by forwarding the acting admin's token. New files (`AuditLogClient`, `integration/`, `AuditLogCreateRequestDTO`, `AuditLogMessagePartDTO`, `AuthServiceRoleAuditTest`) are untracked.
- **Why it matters:** Audit trails are a compliance expectation for payroll/HR. The feature looks well-built (best-effort, non-blocking, optional-injection so unit tests still construct services by hand), but until it's committed and the full suites + an end-to-end check are re-run, it doesn't count as delivered, and a dirty tree is easy to lose or ship half-applied.
- **Where:** working-tree diff across `auth-service`, `user-service`, `planning-service`; new `com/pm/*/integration/AuditLogClient.java` and `dto/AuditLog*DTO.java`.
- **Severity:** **P1.**
- **Suggested fix:** Finish, commit on a branch, run every affected service suite + the integration test, then verify one real admin action produces a queryable audit entry via `GET /api/admin/audit-log`. Confirm the token-forwarding path works through the gateway (the acting admin's bearer, not an internal token, is what auth-service forwards).

### P1-2 — In-memory rate limiting does not hold across instances; depends on a trusted `X-Forwarded-For`
- **What:** `AuthRateLimitingFilter` keeps counters in a `ConcurrentHashMap` per service instance and keys on the first `X-Forwarded-For` hop. Per-account lockout is in the DB (fine), but the endpoint-level throttle is per-instance and trusts a client-supplied header.
- **Why it matters:** Any horizontal scaling (more than one auth-service replica) multiplies the effective limit and lets attackers round-robin. If nginx/gateway doesn't strictly *overwrite* `X-Forwarded-For`, an attacker can rotate the header to dodge the limit. The class comment already acknowledges the single-instance limitation.
- **Where:** `auth-service/.../security/AuthRateLimitingFilter.java`; `deploy/nginx/paradepaard.conf` (must set, not append, `X-Forwarded-For`).
- **Severity:** **P1.**
- **Suggested fix:** For the target scale, either keep a single auth-service instance (document it) or move throttling to a shared store (Redis / Spring Cloud Gateway `RequestRateLimiter`). Ensure the proxy sets `X-Forwarded-For` from the real connection and the app trusts only the proxy hop.

### P1-3 — Job-application listing is not company-scoped
- **What:** `JobApplicationService.getApplications()` does `repository.findAll(...)` with no company filter and returns every application to any user holding `CAN_VIEW_APPLICATIONS`/`CAN_REVIEW_APPLICATIONS`. `JobApplication` has no `companyId` on submission (applications are platform-level; company is resolved from the reviewer only at decision time).
- **Why it matters:** If more than one company reviews applications, one company's reviewers can read another company's applicants' PII (name, email, CV, photo). This is the same class of cross-tenant leak that was closed for leave/contracts/payslips, but the applications module predates that scoping.
- **Where:** `user-service/.../service/JobApplicationService.java` (`getApplications`, `getApplication`, `getApplicationCv`, `getApplicationProfilePicture`), `user-service/.../controller/JobApplicationController.java`.
- **Severity:** **P1** (P0 if the product is genuinely multi-tenant for hiring; confirm the intended model).
- **Suggested fix:** Decide whether applications are platform-global (single hiring org) or per-company. If per-company, add `companyId` to `JobApplication` (from the vacancy/target) and scope every read to the reviewer's company, mirroring `requireUserInCompany`. If genuinely global, document that and restrict who holds the permission.

### P1-4 — Kafka runs PLAINTEXT with a host-published EXTERNAL listener and no auth
- **What:** `docker-compose.yml` runs Kafka with `PLAINTEXT` everywhere and publishes `9092` and an `EXTERNAL` listener on `9094` to the host. The prod override (`docker-compose.prod.yml`) does not remove those published ports. There is no SASL/ACL; any process that reaches the port can read/write the `user` topic (which carries `UserRegisteredEvent`).
- **Why it matters:** The `user` topic drives cross-service user/company propagation. On a single droplet the cloud firewall is the only thing preventing external access to 9092/9094, and the base compose publishes them. A misconfigured firewall = anyone can inject fake `USER_CREATED` events or read registration data.
- **Where:** `docker-compose.yml` `kafka` (`KAFKA_LISTENERS`, `ports: ["9092:9092","9094:9094"]`), `docker-compose.prod.yml` (no `ports: !override`).
- **Severity:** **P1.**
- **Suggested fix:** In the prod override, do not publish Kafka ports to the host (`ports: !override []`) — inter-service traffic uses the compose network. Rely on the DO cloud firewall as defense-in-depth, not the only layer. For a hardened deployment, add SASL and ACLs.

### P1-5 — Broad `catch (Exception)` / `catch (IllegalArgumentException)` returning generic 400s hides real failures
- **What:** Several controllers catch broadly and return `badRequest`/generic messages. E.g. `BillingRateController` wraps each handler in `try { ... } catch (IllegalArgumentException ex) { return badRequest(...) }`; the older cleanup item C5 flagged `UserController` upload/logo/CAO handlers catching `Exception`. A DB outage or a bug then looks like a client validation error.
- **Why it matters:** Masks 500s as 400s, making incidents hard to diagnose and hiding server-side failures from monitoring; also risks returning internal detail in messages.
- **Where:** `planning-service/.../controller/BillingRateController.java`; `user-service/.../controller/UserController.java` (upload/logo/CAO); check each `GlobalExceptionHandler` returns sanitized messages and logs the stack server-side.
- **Severity:** **P1.**
- **Suggested fix:** Narrow catches to the specific expected exceptions, let unexpected ones become 500s handled centrally with a generic body + server-side stack log. Ensure no `ex.getMessage()` with internal detail is echoed to clients.

### P1-6 — `VITE_API_BASE_URL` build-time footgun
- **What:** The SPA resolves its API base from `import.meta.env.VITE_API_BASE_URL` and **falls back to `http://localhost:4004`** (`src/services/auth-service/AuthServices.ts:22`, `src/native/env.ts`). On the demo droplet the real origin lives only in a host-only, gitignored `Program/frontend/.env.production.local`; a clean rebuild anywhere else silently ships a frontend that calls the visitor's own laptop.
- **Why it matters:** A reproducible build in CI or on a new host produces a broken app with no error until a user tries to log in. This already bit the demo once.
- **Where:** `Program/frontend/src/native/env.ts`, `src/services/auth-service/AuthServices.ts:22`; deploy process.
- **Severity:** **P1.**
- **Suggested fix:** Make the build fail (or warn loudly) if `VITE_API_BASE_URL` is unset for a production build; supply it from a CI/deploy secret; do not rely on a gitignored file present only on one machine.

### P1-7 — No application-level monitoring, error tracking, or alerting
- **What:** Health/readiness probes exist (Actuator + compose healthchecks) and the deploy checklist mentions DO monitoring, but there is no centralized log aggregation, no error-tracking (Sentry/rollbar) on frontend or backend, and no alerting on error rates, failed payroll runs, or Kafka consumer failures.
- **Why it matters:** When something breaks in production (a failed scheduled payslip run, a Kafka event that never lands), no one is notified. The payslip scheduler and Kafka consumer log errors and move on; a swallowed `InvalidProtocolBufferException` in `KafkaConsumer` is invisible without log scraping.
- **Where:** `payroll-service/.../scheduler/PayslipScheduler.java`; `user-service/.../kafka/KafkaConsumer.java` (`catch ... log.error` then returns); no observability stack in `infrastructure/`.
- **Severity:** **P1.**
- **Suggested fix:** Add structured logging + a log sink, an error tracker for both tiers, and alerts on 5xx rate, health-probe flaps, scheduler failures, and Kafka consumer errors / DLT depth.

### P1-8 — No frontend error boundary; an uncaught render error white-screens the app
- **What:** No React error boundary (`componentDidCatch`/error-boundary component) exists anywhere in `Program/frontend/src`.
- **Why it matters:** A single render exception in any route takes down the whole SPA to a blank page with no recovery, which for a payroll tool during, say, payslip review is a hard failure with no user-facing message.
- **Where:** `Program/frontend/src/App.tsx` (route tree), no `ErrorBoundary` component present.
- **Severity:** **P1.**
- **Suggested fix:** Add a top-level error boundary that renders a friendly fallback + "reload," and report caught errors to the error tracker (P1-7).

### P1-9 — Kafka event failures are dropped with no dead-letter / retry
- **What:** `KafkaConsumer.consumeEvent` catches `InvalidProtocolBufferException`, logs, and returns; other exceptions propagate but there is no `@RetryableTopic`/DLT configured. The recent multi-company duplicate-name bug (now fixed) showed how a single failing event silently broke user propagation for whole companies.
- **Why it matters:** Cross-service consistency depends on these events. A poison message or transient DB error can leave user-service permanently out of sync with auth-service with no visibility or replay.
- **Where:** `user-service/.../kafka/KafkaConsumer.java`.
- **Severity:** **P1.**
- **Suggested fix:** Add retry + dead-letter topic handling, alert on DLT, and provide a replay path. Add a reconciliation/backfill job that detects auth users missing a user-service profile (the bootstrap runner already does an ad-hoc re-publish for the admin — generalize it).

---

## 4. Nice-to-have improvements (P2)

- **P2-1 — Package namespace still `com.pm` (patient-management scaffold).** The whole codebase is in the original patient-management package namespace (cleanup item C6). Cosmetic but confusing for new devs. *Where:* all services. *Fix:* rename when convenient.
- **P2-2 — Malformed `.git/config` (bad config line 24)** reported by git (cleanup C2). *Fix:* clean the file so hooks/tooling behave.
- **P2-3 — Dead auth code in the SPA.** `AuthContext` comments note the old `getCachedStatus()` token lookup was removed (C3 done), but confirm no residual token-in-storage reads remain; tokens are httpOnly cookies only.
- **P2-4 — `JwtUtil` still exposes multiple public token builders** (`accessToken`/`refreshToken` with and without scoped company) even though C4 collapsed the private builder. Low risk but keep the public surface minimal to avoid issuing a token with the wrong claims. *Where:* `auth-service/.../service/AuthService.java:664–682`.
- **P2-5 — Swagger/OpenAPI (`/v3/api-docs`, `/swagger-ui`) is permitAll on every service.** Fine internally, but ensure it is not reachable through the public nginx in production (it currently proxies `/api` + `/auth`; confirm `/api-docs/*` and `/swagger-ui` are not exposed). *Where:* each `SecurityConfig`, gateway `api-docs-*` routes, `deploy/nginx/paradepaard.conf`.
- **P2-6 — 4-weekly (vierwekelijks) pay cycle not implemented** (noted in `STATUS-PLAIN-LANGUAGE.md`); a common Dutch cycle. Product decision + build.
- **P2-7 — Bulk employee CSV import deferred** (per demo memory) — needed for onboarding ~2500 users without manual entry.
- **P2-8 — Accessibility & cross-browser pass** not done; verify keyboard nav, ARIA, and the major browsers for the main flows.
- **P2-9 — `.env` present on the dev box** (gitignored, verified) — keep verifying it never gets tracked; it currently holds the compromised dev values.

---

## 5. Missing features

| Feature | Status | Why it matters | Where |
|---|---|---|---|
| Access-token silent refresh (client) | **Missing** (P0-4) | Sessions break at 15 min | `frontend/src/services`, `AuthContext.tsx` |
| Leave balances & accrual | **Partial** | `LeaveBalanceService` now reserves on approval and restores on cancel, but accrual (how days are earned/carried) and clash-blocking against shifts are not confirmed end-to-end | `user-service/.../service/LeaveBalanceService.java`, `LeaveRequestServiceImpl` |
| CAO pay-scale tables in code | **Missing** | Minimum wage is enforced, but per-industry CAO scale tables + exact-cent tests are not present | payroll/user CAO modules |
| 4-weekly pay cycle | **Missing** | Common NL cycle | payroll scheduler/period logic |
| Bulk employee import | **Missing** | Onboarding at scale | user/auth onboarding |
| Central audit log | **Built but uncommitted** (P1-1) | Compliance | working tree diff |
| CI/CD pipeline | **Missing** (P0-5) | Release safety | `.github/` |
| Monitoring / error tracking / alerting | **Missing** (P1-7) | Operability | `infrastructure/` |
| GDPR data-subject flows (export/delete, retention) | **Missing/undocumented** | Legal requirement for HR/payroll PII | cross-cutting |

---

## 6. Security and privacy concerns

- **Live secrets in public history, unrotated (P0-1).** Highest priority; forge-any-token exposure.
- **Real PII + copyrighted material in the public repo (P0-2).** GDPR breach + IP.
- **Public unthrottled uploads with no size cap (P0-3).** Abuse/DoS/cost.
- **Kafka PLAINTEXT + published ports (P1-4).** Only the firewall protects the event bus.
- **Rate-limit is per-instance and header-trusting (P1-2).** Bypassable at scale.
- **Broad exception handling can leak internal detail / mask 500s (P1-5).** Verify no stack traces reach clients.
- **Good, already-done controls to preserve:** per-account login lockout with generic 401 (`AuthService.authenticate` / `registerFailedLogin`), token-version revocation on logout/disable/password-reset (`setUserDisabled`, `logout`, `PasswordResetService` all bump `tokenVersion`), `Secure`+`HttpOnly`+`SameSite=Strict` cookies, CORS allow-list driven by config (no wildcard+credentials), gateway local JWT signature validation (S2), internal-service-token gating of `/public/**` (S1), TLS/HSTS via nginx (S5). These are solid — don't regress them during the secret rotation.
- **Privacy of stored binaries:** profile pictures, ID document images, and CVs are stored as bytes in Postgres and served via authorized endpoints (`/{id}/id-document-image` gated by `CAN_VIEW_USERS`/onboarding perms). Confirm backups of these DBs are encrypted at rest (managed DB) and access-logged, given they hold identity documents.

---

## 7. Authentication and authorization concerns

- **Strengths (verified):** Every controller across all 7 services enforces authorization server-side (method security + gateway `JwtValidation`), not just UI hiding. Tenant isolation is enforced on leave (company-scoped reads + by-id ownership checks via `getScopedOrThrow`), contracts (`requireContractInCompany`), and payslips (`findByCompanyId…`). Disabled users can no longer refresh (B2); logout/disable/reset revoke server-side via token version (B3). Login lockout throttles brute force (B8).
- **Concern — client token lifecycle (P0-4):** the refresh path is unused by the SPA, so the carefully built rotation/revocation is not exercised in normal use and sessions break.
- **Concern — application listing not company-scoped (P1-3).**
- **Concern — admin bootstrap operational risk (P1-10, minor):** `AdminBootstrapRunner` requires the `SUPER_ADMIN` role to exist (seeded by auth `V2` migration) and depends on Kafka being up to publish `USER_CREATED`; if Kafka is down at first boot the admin exists in auth but has no user-service profile and `GET /api/users/me` fails (this exact issue bit the demo and is patched with a re-publish, but it's fragile). *Fix:* make profile creation idempotent and reconcilable (see P1-9); document that `BOOTSTRAP_ADMIN_PASSWORD` must be unset after first login.
- **Concern — `/admin/**` on auth-service is only `.authenticated()`** at the HTTP layer (`auth-service/SecurityConfig`), with fine-grained checks via `@PreAuthorize` on each method (`CAN_DELETE_ROLES`, etc.). That's correct, but it means any authenticated user reaches the controller; ensure every admin method has its `@PreAuthorize` (spot-checked: role CRUD do). Keep this invariant tested.

---

## 8. Sync and multi-device concerns

- **Event-driven propagation has no retry/DLT (P1-9).** A failed `user` event silently desyncs user-service from auth-service; the multi-company duplicate-name bug proved this is not hypothetical.
- **No cross-service reconciliation job.** The only healing is the bootstrap runner re-publishing the admin. A general "find auth users missing a user-service profile and replay" job is needed.
- **Multi-device sessions:** because access tokens are stateless (15 min) and refresh is token-versioned, a logout/disable on one device bumps `tokenVersion` and invalidates *all* devices' refresh tokens — good for off-boarding, but note the UX: logging out one device logs out all. Confirm that's intended; if per-device sessions are wanted, refresh tokens need per-session identity (currently only a version counter).
- **No optimistic-locking mention on concurrent edits.** For entities edited by multiple managers (planning shifts, billing rates, leave decisions), confirm concurrent updates don't silently overwrite (last-write-wins). Leave approval is now `@Transactional` and balance drawdown is atomic (good). Verify planning/billing-rate edits under concurrency.
- **Idempotency of payroll runs is handled** (scheduler can't double-pay; ISO-week uniqueness), which is the most important consistency guarantee — keep that covered by tests.

---

## 9. UI and UX issues

- **Silent logout at 15 minutes (P0-4)** is the biggest UX defect.
- **No error boundary (P1-8):** render errors white-screen the app.
- **Confusing/incomplete flows to verify manually (V2 never completed):** onboarding → profile review → contract sign → active is a multi-status state machine (`AuthContext` `UserStatus`), and there is no end-to-end manual pass on record. Walk each status transition and confirm the SPA routes correctly (`RequireOnboarding`, `RequireActiveUser`, `RequirePermission` guards exist — verify they gate every screen).
- **Generic error messaging:** because several backends return generic 400s (P1-5), the UI may show unhelpful errors; ensure user-facing validation messages are specific (BSN/IBAN validation is good; extend that clarity elsewhere).
- **Loading/empty states:** confirm every data screen has explicit loading and empty states (there is a `Spinner`/`spinnerText` util, good sign) so a slow API doesn't look broken.
- **Accessibility/browser matrix (P2-8)** unverified.

---

## 10. Testing checklist

**Automated (exists):** ~140 backend test files (user 49, payroll 23, contract 22, planning 17, auth 16, timesheet 10, gateway 3), 67 frontend test files, and an integration-test module (`FullEmployeeLifecycleSimulationTest`, `AuthIntegrationTest`). Strong unit/security coverage.

**Gaps to close before launch:**

- [ ] **Silent-refresh integration test** — a request after >15 min succeeds via `/auth/refresh` (blocks P0-4).
- [ ] **Public upload abuse test** — oversized/too-many `/applications` submissions are rejected/throttled (blocks P0-3).
- [ ] **CI runs the whole suite on a clean checkout** for every service + frontend (blocks P0-5).
- [ ] **Audit-log end-to-end** — an admin action writes a row queryable via `GET /api/admin/audit-log`, through the gateway, with token forwarding (P1-1).
- [ ] **Two-company application isolation** — company A reviewer cannot see company B applicants (P1-3).
- [ ] **Kafka failure/replay** — a poison/failed event lands in a DLT and can be replayed; user-service reconciles missing profiles (P1-9).
- [ ] **Full manual V2 pass** — onboarding, login, RBAC, planning, payroll, contracts, payslips, leave, messaging, admin/company/employee setup (never completed).
- [ ] **V4 auth-abuse pass** — lockout, disabled-user refresh denied, logout/disable/reset kill tokens (partly automated; run the manual confirmation).
- [ ] **V5 prod-profile deploy dry-run** — full stack behind TLS with the prod compose, every service healthy, no secrets/DEBUG in logs (blocked until secrets rotated, P0-1).
- [ ] **Restore drill** — actually restore from a `postgres-backup` dump into a scratch DB and boot against it (scripts exist; restore is untested per the TODO).
- [ ] **Timezone/DST** — payroll period math across Amsterdam DST boundaries and year-end (largely covered; confirm).
- [ ] **Load/soak** on production-like hardware (8 GB droplet + 2 GB managed DB) — verify the `DB_POOL_SIZE` math (6×pool) fits the cluster's connection limit.
- [ ] **Accessibility + browser matrix**.

---

## 11. Recommended next steps

**Immediately (this week, before anything is called production):**
1. **P0-1** — Rotate the SES keys at AWS *now*; generate and install fresh `JWT_SECRET`, HMAC, internal token, DB passwords; then purge git history and force-push (install `git-filter-repo`/BFG first). Consider making the repo private until done.
2. **P0-2** — Remove `Project/` and `Books/` from tree and history in the same purge; gitignore them; handle any GDPR notification obligation for the exposed contract.
3. **P0-3** — Add multipart size caps to user-service and rate-limit `/applications`.

**Before onboarding real users:**
4. **P0-4** — Implement client-side silent token refresh + 401 retry.
5. **P0-5** — Stand up CI (test all services + frontend on every PR) and a reproducible deploy that bakes `VITE_API_BASE_URL` (also fixes P1-6).
6. **P1-1** — Commit and end-to-end-verify the audit-log feature (or shelve it cleanly).
7. **P1-4** — Stop publishing Kafka ports in prod; confirm firewall.
8. **P1-3** — Decide the tenancy model for applications and scope accordingly.

**Hardening / reliability (launch or immediately after):**
9. **P1-7 / P1-8 / P1-9** — Add monitoring + error tracking, a frontend error boundary, and Kafka retry/DLT + a reconciliation job.
10. **P1-2 / P1-5** — Move rate limiting to a shared store (or pin to one instance) and narrow exception handling.
11. Run the full **V2/V4/V5** manual passes and the **restore drill**.

**Then polish (P2):** package rename, 4-weekly pay cycle, bulk import, CAO scale tables, accessibility/browser matrix, GDPR data-subject flows.

---

### One-line status

**Functionally close and security-hardened in the core, but not shippable until the live secrets are rotated/purged, real PII and copyrighted files are removed from the public repo, the public upload endpoint is capped/throttled, and the SPA can keep a session alive past 15 minutes.** Fix the five P0s and the launch-critical P1s, and this becomes a credible production release.
