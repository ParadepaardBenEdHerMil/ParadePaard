# ParadePaard — Production Readiness Testing Checklist

> Prepared as a senior-QA sign-off gate before onboarding real clients.
> Scope: React 19 / TypeScript SPA frontend + 7 Spring Boot microservices
> (`auth`, `user`, `payroll`, `timesheet`, `contract`, `planning`, `api-gateway`),
> PostgreSQL-per-service, Kafka events, gRPC inter-service calls, AWS SES email,
> JWT auth, multi-tenant (company-scoped) Dutch payroll domain (CAO, Horeca rules,
> BSN, loonheffingen, jaaropgaaf, payslip & contract PDF generation).

---

## 1. How to use this document

Every testable item is a row with six attributes, matching the brief:

1. **What to test** — the concrete behaviour under test.
2. **Why it matters** — the risk if it breaks (the business/legal/security reason it's on this list).
3. **Expected result** — the pass condition.
4. **Key edge cases** — boundary and failure conditions that must be exercised, not just the happy path.
5. **Test type** — `Auto` (unit/integration/contract/e2e), `Manual` (exploratory/UX/visual), or `Both`.
6. **Pri** — release priority (see tiers below).

### Priority tiers

| Tag | Meaning | Gate |
|-----|---------|------|
| **P0** | Launch-blocking. Money, legal compliance, security, data isolation, or auth correctness. A bug here can leak data across tenants, mispay an employee, or break the law. | Must be 100% green before go-live. |
| **P1** | Core flow. Primary user journeys; failure makes the product unusable for a role but isn't a safety/legal breach. | Green or documented known-issue + workaround. |
| **P2** | Polish / resilience / nice-to-have. UX, edge resilience, performance headroom. | Tracked; not blocking. |

### Risk weighting (where to spend the most effort)

Per the agreed risk-weighted approach, the deepest coverage goes to the domains where a defect is irreversible or unsafe:

- **Payroll & payslip accuracy** (§9) — wrong money, wrong tax.
- **Contract generation & signing** (§11) — legally binding documents.
- **Permissions, roles & multi-tenant isolation** (§4, §17) — cross-company data leakage is catastrophic.
- **Security & auth** (§3, §18) — account takeover, token abuse.
- **Data validation & integrity** (§16) — BSN/IBAN correctness, financial reconciliation.

Lighter (but still present) coverage: notifications, UX polish, non-financial reporting.

### Suggested test-evidence columns (add when executing)

When running this as a live checklist, append: `Status` (Pass/Fail/Blocked/N-A), `Owner`, `Env`, `Build/commit`, `Evidence link`, `Date`, `Notes`.

### Current automated-test baseline (observed in repo)

- ~69 backend JUnit tests exist across services; an `integration-test` module exists but contains stale template tests (`PatientIntegrationTest`) that should be removed/replaced.
- Frontend has Vitest specs colocated as `*.test.tsx` (good coverage on several admin pages). No e2e (Playwright/Cypress) layer detected — **gap to close (§20)**.
- Treat "Auto" rows without an existing test as *tests to be written*, not assumed-covered.

---

## 2. Cross-cutting / environment readiness (do these first)

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| X-1 | Clean-environment bring-up: `docker compose up --build` from zero volumes | If first-boot ordering (DB → Kafka → gateway → services) is fragile, no client can be provisioned | All 7 services + 6 Postgres DBs + Kafka reach healthy; gateway routes resolve | Kafka not ready when a service starts; DB migration race; port already in use | Both | P0 |
| X-2 | Secrets & config externalised | Hard-coded `JWT_SECRET`, SES creds, DB passwords in `docker-compose.yml`/`.env` are a breach risk in prod | No secret committed; all injected via env/secret manager; prod uses unique rotated values | Default dev secret reused in prod; `.env` checked into git | Both | P0 |
| X-3 | `SPRING_JPA_HIBERNATE_DDL_AUTO` is **not** `update` in prod | `ddl-auto=update` lets Hibernate silently alter prod schemas → data loss/drift | Prod uses `validate` + versioned migrations (Flyway/Liquibase) | Column type narrowing; dropped not-null; reserved-word columns (e.g. `year`) | Both | P0 |
| X-4 | Database migration scripts are idempotent & ordered | Re-runs or partial failures must not corrupt schema | Re-applying migrations is a no-op; failure rolls back cleanly | H2/strict-dialect vs Postgres quoting; reserved column `year` in `jaaropgaven` | Auto | P0 |
| X-5 | Health checks & readiness probes per service | Orchestrator must not route traffic to a not-ready service | `/actuator/health` (or equivalent) returns DOWN until deps ready, UP after | DB down mid-life; Kafka partition unavailable | Both | P1 |
| X-6 | Centralised structured logging + correlation/trace IDs across services | Without request tracing across gateway→service→gRPC, prod incidents are undebuggable | A single request is traceable end-to-end by correlation ID | Async Kafka consumer logs; gRPC call logs; PII not logged | Both | P1 |
| X-7 | Build reproducibility & dependency vulnerability scan | Supply-chain CVEs in Spring/React deps | `mvn`/`npm audit` + SCA gate passes; no critical CVEs shipped | Transitive CVEs; outdated base images (`postgres:16.4`, `kafka:4.1.2`) | Auto | P1 |
| X-8 | Time zone & clock correctness (Europe/Amsterdam) | Payroll periods, shifts, DST transitions depend on TZ; server in UTC mispays | All date math uses a defined business TZ; DST days handled | DST spring-forward/back day; server TZ ≠ business TZ; leap year | Both | P0 |
| X-9 | Backup & restore drill of all 6 databases | Payroll/contract data loss is unrecoverable and a legal liability | Documented backup cadence; a restore is verified to a working state | Cross-service referential consistency after restore; PITR | Manual | P0 |

---

## 3. Authentication & session management

Endpoints observed: `/auth/login`, `/refresh`, `/logout`, `/validate`, `/register`, `/forgot-password`, `/reset-password`, `/is-admin`. JWT issued by auth-service; validated at api-gateway via `JwtValidationGatewayFilterFactory`.

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| A-1 | Valid login returns access + refresh tokens and correct claims | Front door of the whole product | 200 with JWT containing userId, companyId, roles/permissions; refresh token set | Username case-sensitivity; trailing whitespace; trailing-slash route variants (`/login/`) | Both | P0 |
| A-2 | Invalid credentials rejected without leaking which field was wrong | Username-enumeration & brute-force risk | 401 generic "invalid credentials"; no "user not found" vs "wrong password" distinction | Wrong password; non-existent user; disabled user; empty body | Both | P0 |
| A-3 | Brute-force / rate limiting on login & forgot-password | Credential stuffing and SES abuse | After N failures, throttle/lockout/backoff; SES send rate-limited | Distributed attempts; lockout reset timing; lockout never permanent for legit user | Both | P0 |
| A-4 | JWT signature & expiry validated at gateway for every protected route | A forged/expired token must never reach a service | Tampered/expired/`alg:none` tokens → 401 at gateway, never proxied | `alg:none`; wrong-key signature; expired; future `nbf`; missing claims | Both | P0 |
| A-5 | Token refresh rotation & reuse detection | Stolen refresh token must not grant indefinite access | Refresh issues new token; old refresh invalidated; reuse is detected/revoked | Refresh after logout; refresh with revoked token; concurrent refresh | Both | P0 |
| A-6 | Logout invalidates session/refresh token server-side | "Logged out" must actually revoke access | After logout, access & refresh tokens are unusable | Logout twice; logout with already-expired token; multi-device logout | Both | P0 |
| A-7 | `/validate` and `/is-admin` reflect live permission state | Stale authority after a role change is a privilege bug | Reflects current roles; revoked permission takes effect on next validate/refresh | Role removed mid-session; token issued before grant change | Both | P0 |
| A-8 | Forgot-password issues single-use, time-limited, HMAC-signed token | Reset link is an account-takeover vector | Token expires, is single-use, HMAC-verified; email enumeration not possible | Reused token; expired token; tampered HMAC; reset for disabled user; unknown email returns generic success | Both | P0 |
| A-9 | Reset-password enforces password policy and invalidates old sessions | Weak/long-lived sessions after reset | Strong-password rules enforced; all existing sessions revoked on reset | Same-as-old password; minimum length/complexity; concurrent reset links | Both | P0 |
| A-10 | Password storage uses strong adaptive hashing | DB compromise must not reveal passwords | Passwords stored with bcrypt/argon2 + per-user salt; never plaintext/reversible | Hash upgrade path; pepper/secret rotation | Auto | P0 |
| A-11 | gRPC `UpdatePassword` (auth→service) authenticated & authorised | Internal password-change RPC must not be callable by anyone on the network | Only authorised callers; channel secured; no anonymous gRPC | Spoofed internal caller; plaintext gRPC on shared network | Both | P0 |
| A-12 | Session/idle timeout & "remember me" behaviour | Unattended sessions on shared devices | Token TTL enforced; idle timeout where required | Very long-lived token; clock skew between gateway and service | Both | P1 |
| A-13 | Concurrent sessions / multi-tab consistency | Confusing or unsafe state across tabs | Login/logout in one tab reflected consistently; no privilege bleed | Two tabs, two companies (platform admin scope switch) | Manual | P1 |

---

## 4. User roles, permissions & authorization (RBAC)

Permission model is fine-grained (`CAN_VIEW_USERS`, `CAN_MANAGE_PAYSLIPS`, `CAN_REVIEW_ONBOARDING`, `CAN_VIEW_EMPLOYEE_IDENTIFICATION`, `CAN_MANAGE_PLATFORM`, etc.). Frontend gates routes via `RequirePermission` / `RequireActiveUser` / `RequireOnboarding`. **Frontend gating is UX only — every check must be re-enforced server-side.**

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| R-1 | Every protected endpoint enforces its permission **server-side**, independent of UI | Hiding a button doesn't protect the API; this is the #1 RBAC failure | Direct API call without the permission → 403, regardless of frontend | Call API with valid token but missing permission; manipulated request | Both | P0 |
| R-2 | `RequirePermission` (anyOf/allOf/single) routes correctly per permission set | Wrong gating exposes or hides admin features | User with/without each permission sees the correct allow/redirect to `/dashboard` | `anyOf` partial match; `allOf` missing one; empty permission list; loading state | Both | P0 |
| R-3 | Privilege escalation is impossible via role/permission editing | A user must not grant themselves higher authority | Cannot assign a role/permission they don't hold; cannot edit own roles upward | Self-elevation; assigning `CAN_MANAGE_PLATFORM`; editing protected/system role | Both | P0 |
| R-4 | Sensitive-field masking (`CAN_VIEW_EMPLOYEE_IDENTIFICATION`) | BSN/ID numbers are special-category personal data (GDPR) | Without the permission, BSN/ID type/number/dates are masked in UI **and** API response | Admin without the perm hitting the raw API; export/CSV path; PDF embedding | Both | P0 |
| R-5 | Role CRUD: create/update/delete/assign/remove (`CAN_CREATE_ROLE`…`CAN_DELETE_ROLES`) | Mis-scoped role management breaks the whole authority model | Each op requires its specific permission; changes audited | Delete a role still assigned to users; delete last admin role; rename collisions | Both | P0 |
| R-6 | Deleting/disabling a role cascades safely | Orphaned permissions or locked-out admins | Users lose only that role's permissions; at least one admin always remains | Delete role held by all admins; user left with zero roles | Both | P0 |
| R-7 | Permission changes take effect promptly (no stale-token authority) | Revoked access must actually revoke | New permission set applies on next validate/refresh; revocation can't be bypassed by old token | Long-lived token after revocation; cached permission list | Both | P0 |
| R-8 | "Own vs all" scoping (`CAN_VIEW_OWN_*` vs `CAN_VIEW_ALL_*`) | Employee must see only their own payslips/timesheets/contracts | Own-scope user can read only their own records; all-scope sees company-wide | Request another user's payslip/timesheet/contract by ID | Both | P0 |
| R-9 | Default/least-privilege for a brand-new employee | New accounts must not start over-privileged | Fresh user has only self-service permissions | Newly onboarded user; user with no roles assigned | Both | P0 |
| R-10 | Horizontal access control (IDOR) on every `/{id}` resource | Sequential/guessable IDs let users read others' data | Accessing another user's/company's resource by ID → 403/404 | Increment payslipId/userId/contractId; UUID enumeration | Both | P0 |

---

## 5. Multi-tenancy & company-scope isolation (Platform Admin)

The system is multi-tenant: data is `companyId`-scoped (101+ backend files reference it), and a platform admin can switch company scope (`/auth/platform/company-scope`, `PlatformAdminContext`, `SwitchPlatformCompanyScope`). **Tenant isolation is the single highest-impact correctness property.**

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| T-1 | Every query/command is filtered by the caller's `companyId` | Cross-tenant leakage exposes another company's employees, pay & contracts — catastrophic | Company A user can never read/write Company B data on any endpoint | Forged companyId in token/body; missing companyId; null/legacy records | Both | P0 |
| T-2 | Platform-admin company-scope switch changes context completely & safely | A leftover scope shows/edits the wrong company's data | After switch, all reads/writes target the selected company only; prior scope fully cleared | Switch mid-operation; switch with stale tab; non-platform user calling the endpoint | Both | P0 |
| T-3 | `CAN_MANAGE_PLATFORM` strictly gates all platform-admin endpoints/pages | Platform admin can see all tenants — must be airtight | Non-platform user → 403 on `/platform/*` API and redirect on UI | Regular company admin probing platform routes; token without the perm | Both | P0 |
| T-4 | Cross-company referential integrity (user↔company↔contract↔payslip) | A record must not bind to the wrong tenant via service-to-service calls | gRPC/Kafka cross-service lookups carry & honour companyId | Event consumed by wrong company context; user moved between companies | Both | P0 |
| T-5 | Company provisioning / company details (PlatformAdminCompanies, CompanyDetails) | New-client onboarding correctness | Creating a company sets up isolated data, default roles, settings | Duplicate company; disable/suspend a company; company with no users | Both | P1 |
| T-6 | Aggregations/reports never cross tenant boundaries | A finance/jaaropgaaf total mixing companies is a reporting & legal error | All totals, counts, exports are company-scoped | Platform-admin-wide vs company-scoped report; shared reference data only | Both | P0 |
| T-7 | Uploaded assets (logo, profile picture, ID doc) are tenant-isolated in storage | Direct asset URL must not be guessable across companies | Asset access authorised & company-scoped; no public bucket listing | Direct file URL from another company; deleted-then-reuploaded asset | Both | P0 |

---

## 6. Job application (public intake)

Public route `/apply` → `JobApplicationController`; admin review at `/management/applications` (`AdminApplications`, `AdminApplicationDetails`). Permissions: `CAN_VIEW_APPLICATIONS`, `CAN_REVIEW_APPLICATIONS`.

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| AP-1 | Public application submission validates & stores all fields | Bad intake data pollutes onboarding downstream | Valid submission stored & queued for review; confirmation shown | Missing required fields; oversized free-text; unicode/emoji names | Both | P1 |
| AP-2 | Public endpoint is abuse-resistant (no auth = spam/DoS target) | Open form invites bots & injection | Rate-limited; CAPTCHA/honeypot or equivalent; input sanitised | Bot flooding; script/HTML in fields; duplicate spam submissions | Both | P0 |
| AP-3 | File/CV upload (if present) restricts type & size, scans content | Malware or huge files via public form | Only allowed types/sizes; stored safely; no execution | Disguised extension; polyglot file; zip bomb; oversize | Both | P0 |
| AP-4 | Application appears correctly in admin queue with status workflow | Reviewers must see accurate, complete applications | Listed with correct status; detail matches submission | Concurrent reviewers; status race; large queue pagination | Both | P1 |
| AP-5 | Approve/reject transitions and hand-off to onboarding | Wrong transition strands a candidate | Approve creates onboarding path; reject closes cleanly with reason | Double-approve; approve already-rejected; reject after onboarding started | Both | P1 |
| AP-6 | Application visibility scoped to company & permission | A public applicant must not see others; cross-company review blocked | Only authorised reviewers in the right company can view | Applicant guessing application IDs; cross-company reviewer | Both | P0 |

---

## 7. Onboarding & employee setup

Flow: admin onboards (`/auth/admin/onboard-user`, `AdminOnboarding`, `AdminOnboardEmployee`) → invite email (SES) → employee self-service `Onboarding` + `CompleteSetup` (personal info, bank details, employment details, ID document) → review queue (`AdminOnboardingReview`, `AdminOnboardingReviewDetails`, `UpdateOnboardingReview`). Guards: `RequireOnboarding`. Permissions: `CAN_VIEW_ONBOARDING_QUEUE`, `CAN_REVIEW_ONBOARDING`.

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| O-1 | Admin onboards employee → account created + invite email sent | Broken invite = employee can never start | Account created (disabled/pending), unique invite email delivered via SES | Duplicate email; existing user; SES failure/bounce; invalid email | Both | P0 |
| O-2 | Resend onboarding email (`ResendOnboardingEmail`) | Lost invites are common; must be safe to resend | New valid link sent; previous link invalidated or still single-use | Resend spam; resend after completion; resend for disabled user | Both | P1 |
| O-3 | Invite link is single-use, time-limited, and identity-bound | Invite link is an account-claim vector | Link claims only the intended account, once, before expiry | Reused link; expired; link for already-onboarded user; forwarded link | Both | P0 |
| O-4 | `RequireOnboarding` blocks app access until setup complete | Half-onboarded users in core flows cause data gaps | Incomplete users are routed to onboarding, can't reach dashboard/payroll | Partially complete steps; refresh mid-flow; back-button | Both | P1 |
| O-5 | Each onboarding step validates & persists (personal/bank/employment/ID) | Garbage data here flows into contracts & payroll | Each step validated; progress saved & resumable | Resume after logout; skip step; concurrent edits; browser refresh | Both | P0 |
| O-6 | BSN / ID-document capture validated (format, expiry, issuing country) | BSN drives tax; invalid BSN = rejected payroll filing | Valid BSN (11-proef), document type/number/dates required & validated | Invalid BSN checksum; expired ID; future issue date; foreign formats | Both | P0 |
| O-7 | ID-document image upload secure & access-controlled (`GetUserIdDocumentImage`) | Passport scans are highly sensitive | Image stored encrypted/private; only `CAN_VIEW_EMPLOYEE_IDENTIFICATION` can fetch | Direct URL access; cross-company fetch; oversize/malicious image | Both | P0 |
| O-8 | IBAN/bank details validated before payroll uses them | Wrong IBAN = salary paid to wrong/invalid account | IBAN format + checksum validated; mismatch flagged | Foreign IBAN; whitespace; BIC mismatch; account name mismatch | Both | P0 |
| O-9 | Review queue: approve/reject/request-changes with reasons | Reviewer is the quality gate before activation | Status transitions correct; rejection reasons captured & shown to employee | Concurrent reviewers; approve incomplete; reject after contract sent | Both | P1 |
| O-10 | Approval activates the user and triggers downstream (contract/payroll eligibility) | Activation must atomically flip the right switches | On approval, user becomes active with correct roles; downstream events fire | Partial activation failure; event lost; re-approval | Both | P0 |
| O-11 | Self-service onboarding can only edit own record | An onboarding user must not touch others | All onboarding writes scoped to the authenticated user | Tampered userId in request; another user's onboarding token | Both | P0 |

---

## 8. Employee management & account self-service

Admin: `AdminUsers`, `AdminUserDetails`, `UpdateUser`, `DisableUser`, enable/delete (`/auth/admin/users/{id}/disable|enable`, `DELETE`). Self-service: `Account`, `AccountPersonalInfo`, `AccountBankDetails`, `AccountEmploymentDetails`, profile picture. Permissions: `CAN_VIEW_USERS`, `CAN_MANAGE_USERS`, `CAN_DELETE_USERS`.

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| E-1 | User list & detail load with correct, company-scoped data + pagination | The admin's primary roster view | Accurate list; pagination/search/filter correct; only own company | Large roster (1000s); search injection; empty company | Both | P1 |
| E-2 | Edit employee (admin) validates and persists; audited | Bad edits corrupt payroll/contract inputs | Valid changes saved, audit entry written; invalid rejected with message | Concurrent admin edits (lost update); changing employment terms mid-period | Both | P0 |
| E-3 | Disable user blocks login immediately but preserves records | Offboarding must cut access yet keep payroll/contract history | Disabled user cannot authenticate; historical data intact | Disable mid-session (active token); disable then re-enable; disable self | Both | P0 |
| E-4 | Delete user — hard vs soft delete & legal retention | Payroll/tax records must be retained for years (NL ~7yr); careless delete is illegal | Delete respects retention (soft-delete/anonymise, not purge of fiscal data) | Delete user with payslips/contracts; GDPR erasure vs tax retention conflict | Both | P0 |
| E-5 | Self-service: user edits only their own personal/bank/employment info | Users must not edit others or restricted fields | Own-record edits only; restricted fields (salary, role) not self-editable | Tampered userId; editing employment terms; editing BSN after lock | Both | P0 |
| E-6 | Bank-detail change re-validates & is audited/notified | Salary-redirect fraud vector | IBAN re-validated; change logged; ideally confirmation/notification | Change just before payroll run; invalid IBAN; rapid repeated changes | Both | P0 |
| E-7 | Profile picture / logo upload, replace, delete (`Update/DeleteMyProfilePicture`, company logo) | Asset handling is a common XSS/SSRF/storage bug source | Allowed types/size only; replace & delete work; tenant-isolated | SVG with script; huge image; broken/missing image fallback; orphaned files | Both | P1 |
| E-8 | Employment details (contract type, hours, function, CAO) drive payroll correctly | These fields feed pay & contract generation | Changes propagate correctly to payroll/contract calc | Mid-period change; function not in CAO; zero-hours/oproep contract | Both | P0 |
| E-9 | Account state machine (pending→active→disabled→deleted) consistent across services | User-service and auth-service must agree on state | State synced via events; no "active in auth, deleted in user" divergence | Event lost/duplicated; partial failure; replay | Both | P0 |

---

## 9. Client & location management (planning domain)

Clients: `PlanningClientCompanyController`, `Create/Update/DeletePlanningClient`, `AdminPlanningClients`, `AdminPlanningClientDetail`, general info, billing rates. Locations: `ManagePlanningLocations`, `AdminPlanningLocations`, `AdminPlanningClientLocations`. Permission: `CAN_MANAGE_PLANNING`.

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| C-1 | Client CRUD (create/read/update/delete) with validation | Clients are the billing counterparties; bad data breaks invoicing | Valid client saved; required fields enforced; company-scoped | Duplicate client; delete client with active projects/shifts; very long names | Both | P1 |
| C-2 | Deleting a client referenced by projects/shifts/billing | Orphaned planning or lost billing rates | Blocked or safely cascaded with warning; no dangling references | Delete client mid-project; client with historical billed shifts | Both | P0 |
| C-3 | Location CRUD and association to client | Wrong location → wrong shift address / travel calc | Locations save, link to correct client, company-scoped | Location shared across clients; delete location used by shift; geo/address validation | Both | P1 |
| C-4 | Client general info edits audited and scoped | Counterparty data integrity | Edits persisted, audited, only by permitted users in the right company | Cross-company edit attempt; concurrent edits | Both | P1 |
| C-5 | Client/location lists paginate, search, filter correctly | Usability at scale | Correct, performant lists; filters combine correctly | Large client base; special chars in search; empty states | Both | P2 |

---

## 10. Planning & scheduling (projects, shifts, assignments)

Core scheduling: `PlanningManagementController`, `PlanningViewController`, `EmployeePlanningController`, `PlanningFinalizationController`. Pages: `AdminPlanningOverview`, `AdminPlanningProjectDetail`, `AdminPlanningShiftDetail`, `MyPlanning`, `MyPlanningShiftDetail`, `FinalizePlanningProject`, `EmployeePlanning`, `GetPlanningOverview/Assignment`.

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| PL-1 | Create/edit project with date range, client, location, shifts | Planning is the upstream source of payable hours | Project saved with valid structure; shifts attached correctly | Project end before start; zero shifts; overlapping projects | Both | P1 |
| PL-2 | Create/edit shift: start/end, breaks, role, rate, capacity | Shift data feeds timesheets → payroll → billing | Shift times valid; break handling correct; capacity enforced | Overnight shift (crosses midnight); DST day; end before start; 24h+ shift; zero-length | Both | P0 |
| PL-3 | Assign employee to shift (and unassign/reassign) | Wrong assignment = wrong pay & no-show | Assignment respects availability, capacity, qualifications | Double-booking same employee; assign disabled/offboarded user; over-capacity; assign across companies | Both | P0 |
| PL-4 | Double-booking & conflict detection | One person can't work two places at once | Overlapping assignments flagged/blocked | Back-to-back with travel; partial overlap; leave-conflicting assignment | Both | P0 |
| PL-5 | Employee self-view (`MyPlanning`) shows only own shifts | Privacy + clarity | Employee sees only their assignments, correct times in business TZ | Shift edited by admin after employee viewed; cancelled shift; TZ display | Both | P1 |
| PL-6 | Shift availability / accept-decline (if employees confirm) | Unconfirmed shifts cause no-shows | Accept/decline updates state & notifies planner | Decline after deadline; double-accept; accept cancelled shift | Both | P1 |
| PL-7 | Project finalization (`FinalizePlanningProject`) locks planning → generates payable/billable hours | Finalization is the hand-off to payroll/finance; errors here mispay & misbill | Finalize aggregates hours correctly, locks edits, emits events to timesheet/payroll/finance | Finalize with unassigned shifts; re-finalize; finalize partially worked project; edit after finalize | Both | P0 |
| PL-8 | Planning changes after finalization are controlled | Late edits must not silently alter pay already in flight | Post-finalize edits blocked or require re-finalize with audit | Edit finalized shift; reopen project; retroactive change to paid period | Both | P0 |
| PL-9 | Large planning board performance (`AdminPlanningOverview` is very large) | The 90k+ line overview page is a perf risk | Renders & interacts smoothly for a busy month | Many projects/shifts; long date ranges; many concurrent planners | Both | P1 |
| PL-10 | Concurrent planner edits (two admins same project) | Lost updates double-book or drop shifts | Optimistic-lock/conflict handling; last-write isn't silently lost | Simultaneous shift edits; assign + delete race | Both | P1 |

---

## 11. Timesheets & work history

`TimesheetController`, `CreateTimesheet`, `Get(My/All)Timesheets(Page)`, `GetTimesheetById`, `WorkHistory`, `WorkHistoryShiftDetail`, `WorkHistoryPreferences`. Permissions: `CAN_VIEW_OWN_TIMESHEETS`, `CAN_VIEW_ALL_TIMESHEETS`, `CAN_MANAGE_TIMESHEETS`.

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| TS-1 | Timesheet creation from worked shift records correct hours | Timesheets are the source of truth for pay | Hours computed correctly from shift incl. breaks | Overnight shift; break > shift; manual override vs planned; DST day | Both | P0 |
| TS-2 | Worked hours rounding rules are explicit & consistent | Rounding differences = systematic over/underpay | Documented rounding (e.g., to minute) applied uniformly across pay & billing | 7.5-min increments; floating-point drift; cumulative rounding | Both | P0 |
| TS-3 | Edit/approve/reject timesheet (manager) audited | Manual corrections are fraud/error-prone | Edits require `CAN_MANAGE_TIMESHEETS`, audited, reason captured | Edit after payroll run; approve already-paid; negative hours | Both | P0 |
| TS-4 | Own vs all timesheet visibility enforced | Employees must not see others' hours | Own-scope sees only self; all-scope company-wide | Request another user's timesheet by ID; cross-company | Both | P0 |
| TS-5 | Work-history view accuracy & pagination | Employee's record of worked shifts/earnings | Matches finalized planning & timesheets; paginates correctly | Long history; deleted shift; corrected entries; empty history | Both | P1 |
| TS-6 | Work-history preferences persistence | Per-user view config | Preferences saved per user, scoped, restored on return | Conflicting prefs across devices; invalid stored pref | Both | P2 |
| TS-7 | Timesheet ↔ planning ↔ payroll reconciliation | All three must agree on hours | Same worked hours flow consistently end-to-end | Late edit; finalize-then-edit; partial period | Both | P0 |

---

## 12. Payroll, payslip generation & pay calculation  *(deepest coverage — money & tax)*

Payroll: `PayrollController`, `Payslips`, `PayslipDetails`, `PayslipReview`, `UpdatePayslip`, `UpdateMyPayslipFrequency`, `ReportPayslipError`, `GetPayslipPdf`, `GetPayslipsForReview`, `AdminPayslipDetails`. Dutch rules: CAO, Horeca payroll rules, loonheffingen (wage tax), 2026 tax figures pinned to Handboek Loonheffingen Bijlage 1. Permissions: `CAN_VIEW_PAYSLIPS`, `CAN_VIEW_ALL_PAYSLIPS`, `CAN_REVIEW_PAYSLIPS`, `CAN_MANAGE_PAYSLIPS`.

> **Testing principle:** payroll math must be validated against an independent reference (the Handboek Loonheffingen tables and worked examples), not just against the app's own previous output. Use golden-master fixtures per CAO/scenario and assert to the cent.

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| PY-1 | Gross-pay calculation from worked hours × rate (+ surcharges) | Wrong gross = wrong everything downstream | Gross matches hours × applicable rate incl. shift surcharges to the cent | Overtime; night/weekend/holiday surcharge; multiple rates in one period; zero hours | Both | P0 |
| PY-2 | Loonheffing (wage tax) & social premiums per 2026 Handboek tables | Legally mandated; errors = fines + employee harm | Withholdings match official tables (white/green table, special tariff) | Loonheffingskorting on/off; special-rate (bijzonder tarief) income; bracket boundaries | Both | P0 |
| PY-3 | Net pay = gross − deductions, reconciled | The number that actually hits the bank | Net is arithmetically correct and matches sum of components | Rounding to cent; negative net (over-deduction); multiple deductions | Both | P0 |
| PY-4 | Holiday allowance (vakantiegeld 8%) accrual & payout | Statutory NL entitlement | Accrues correctly per period; payout (usually May) correct | Mid-year start/leave; accrual reset; reservation vs payout timing | Both | P0 |
| PY-5 | Reservations (vakantiegeld, reserveringen, holiday hours) tracked | Reservations are real liabilities owed to employees | Balances accrue/decrement correctly; visible & reconciled | Negative reservation; payout exceeding balance; carryover across year | Both | P0 |
| PY-6 | Pro-rata for partial periods / mid-period start or end | New hires & leavers must be paid exactly for time worked | Pay prorated to days/hours actually employed | Start/end mid-period; 0-day period; full-period denominator (per commit history) | Both | P0 |
| PY-7 | Pay-frequency change (`UpdateMyPayslipFrequency`: weekly/4-weekly/monthly) | Frequency drives period boundaries & tax tables | Switching frequency recalculates periods & tax basis correctly | Switch mid-period; 4-weekly vs monthly table; back-dated switch | Both | P0 |
| PY-8 | Minimum-wage (WML) compliance per age/hours | Paying below WML is illegal | Computed pay ≥ statutory minimum for the period | Youth minimum wage by age; age birthday mid-period; part-time WML | Both | P0 |
| PY-9 | CAO-specific rules applied (Horeca rules engine) | Wrong CAO = systematic miscalculation for a whole client | Correct CAO scales, surcharges, allowances applied per employee's CAO | Employee with no CAO; CAO change; conflicting company override | Both | P0 |
| PY-10 | Payslip PDF generation correctness & completeness (`GetPayslipPdf`) | The payslip is a legal document the employee relies on | PDF shows all statutory fields, correct totals, employer/employee data | Missing field; long names; special chars; multi-page; locale formatting (€, comma decimals) | Both | P0 |
| PY-11 | Payslip review workflow (`PayslipReview`, `GetPayslipsForReview`) | Human gate before pay is finalised | Reviewer can approve/flag; only `CAN_REVIEW_PAYSLIPS`; status transitions correct | Approve already-approved; bulk review; reject with reason; concurrent reviewers | Both | P0 |
| PY-12 | Manual payslip edit/override (`UpdatePayslip`) audited & bounded | Manual overrides are the biggest fraud/error surface | Edits require `CAN_MANAGE_PAYSLIPS`, fully audited, recomputed totals consistent | Override breaking net=gross−deductions; edit finalised/paid payslip; negative override | Both | P0 |
| PY-13 | Payslip immutability after finalisation/payment | A paid payslip is a fixed legal record | Finalised payslips locked; corrections via new corrective slip, not edit-in-place | Edit after payment; delete paid payslip; re-run payroll for closed period | Both | P0 |
| PY-14 | Employee "report payslip error" (`ReportPayslipError`) flow | Employees need a correction channel; legal requirement | Report logged, routed to admin, tracked to resolution | Report on others' payslip; spam reports; report after correction | Both | P1 |
| PY-15 | Payslip access strictly own-vs-all scoped | Salary data is highly confidential | Employee sees only own payslips; `scope=all` requires `CAN_VIEW_ALL_PAYSLIPS` | Guess payslipId; cross-company; PDF direct URL without auth | Both | P0 |
| PY-16 | Idempotent payroll run (no double-pay on retry) | A retried/duplicated run could pay twice | Re-running a period is idempotent; no duplicate payslips/payments | Crash mid-run; duplicate Kafka event; concurrent runs for same period | Both | P0 |
| PY-17 | Currency, rounding & locale formatting throughout | €1.234,56 vs $1,234.56 confusion = real errors | All money in EUR, NL formatting, half-up cent rounding consistently | Thousands separator; negative amounts; zero; very large totals | Both | P0 |
| PY-18 | Cumulative/year-to-date figures correct (feeds jaaropgaaf) | YTD errors compound into the annual statement | Per-period cumulatives match sum of periods to the cent | Mid-year hire; correction in prior period; year boundary | Both | P0 |

---

## 13. Finance: revenue, margin, billing & jaaropgaaf  *(deep — money & legal filing)*

`FinanceController`, `PayrollFinance`, `PayrollFinanceApi`, `Finance`, `MyFinance*`, `Jaaropgaaf`, billing-rate-driven revenue/margin (per `PHASE2-REVENUE-MARGIN-PLAN.md`, `AUDIT-AND-RECONCILE-finance-jaaropgaaf.md`). Permissions: `CAN_VIEW_PAYROLL_FINANCE`, `CAN_MANAGE_PAYROLL_FINANCE`.

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| F-1 | Revenue = billable hours × client billing rate | Revenue drives the whole P&L view | Revenue per shift/project/period matches billed hours × rate | Rate change mid-project; multiple rates; non-billable shift | Both | P0 |
| F-2 | Margin = revenue − employee cost (incl. employer burden) | Margin is the core business metric clients trust | Margin reconciles to revenue minus fully-loaded cost | Employer charges (werkgeverslasten); reservations in cost; rounding | Both | P0 |
| F-3 | Finance↔payroll reconciliation (ACTUAL allocation, full denominator) | Per commit history, allocation must reconcile for any date range | Allocations sum back to source totals for any chosen range | Arbitrary date range; partial period; cross-month; leap year | Both | P0 |
| F-4 | Jaaropgaaf (annual income statement) generation per employee/year | Legally required annual statement; errors harm employees' tax filings | Jaaropgaaf totals = sum of that year's payslips; all statutory fields present | Mid-year hire/leave; multiple employments; year-boundary corrections; reserved `year` column | Both | P0 |
| F-5 | Jaaropgaaf vs sum-of-payslips audit ties out exactly | Annual must equal the periods it summarises | Reconciliation report shows zero variance | Corrected prior-period payslip; rounding accumulation; voided payslip | Both | P0 |
| F-6 | Employee MyFinance views (overview/payslips/work-history/contract/documents) | Employee's financial self-service; must be accurate & private | Each tab shows correct, own-only data | Cross-user access; empty year; missing document; stale cache | Both | P0 |
| F-7 | Finance figures strictly permission-gated & company-scoped | Revenue/margin are sensitive commercial data | Only `CAN_VIEW_PAYROLL_FINANCE` in the right company; no cross-tenant totals | Employee probing finance API; cross-company aggregate | Both | P0 |
| F-8 | Export/report outputs (CSV/PDF) match on-screen figures | Exports get sent to accountants/tax — must be authoritative | Exported numbers equal UI numbers; correct formatting | Large export; locale formatting; partial-period export | Both | P1 |
| F-9 | Recalculation after upstream correction propagates | A fixed timesheet must ripple to finance | Correcting hours/rates recomputes revenue/margin/jaaropgaaf consistently | Retroactive correction; closed-period correction; event ordering | Both | P0 |

---

## 14. Contract generation & e-signing  *(deep — legally binding)*

`contract-service` (`ContractController`), Kafka `contract-events`. Pages: `AccountContractSign`, `AdminContracts`, `GetContracts`. Permissions: `CAN_VIEW_ALL_CONTRACTS`, `CAN_MANAGE_CONTRACTS`, `CAN_REVIEW_CONTRACTS`, `CAN_FINALIZE_CONTRACT`, `CAN_VIEW_OWN_CONTRACTS`, `CAN_SIGN_OWN_CONTRACTS`. Reference: real `Payrollovereenkomst` PDF in `/Project`.

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| CT-1 | Contract generated with correct merged data (name, BSN, dates, salary, function, CAO, hours) | A contract with wrong terms is legally void / disputable | Every merge field populated from authoritative source; matches employment details | Missing field; special chars in name/address; zero-hours/oproep; fixed vs indefinite term | Both | P0 |
| CT-2 | Generated PDF matches the approved `Payrollovereenkomst` template exactly | Layout/clause errors create legal exposure | Output matches reference template (clauses, order, branding) byte-for-intent | Long values overflowing layout; multi-page; logo rendering; locale dates | Both | P0 |
| CT-3 | Contract review/finalize workflow honours each permission | Wrong actor finalizing an unreviewed contract is a compliance failure | Review→finalize transitions gated by `CAN_REVIEW_CONTRACTS`/`CAN_FINALIZE_CONTRACT` | Finalize unreviewed; review own contract; skip review | Both | P0 |
| CT-4 | Employee e-signature (`AccountContractSign`) binds signer identity & timestamp | A signature must be attributable and tamper-evident | Signature records who/when; signed PDF immutable; consent captured | Sign someone else's contract; re-sign; sign expired offer; signature on edited contract | Both | P0 |
| CT-5 | Signed contract is immutable & tamper-evident | Post-signature edits invalidate the agreement | Signed document hash stored; any change detectable; new version required for changes | Edit after signing; replace stored PDF; hash mismatch detection | Both | P0 |
| CT-6 | Contract versioning & amendment trail | Employment terms change; history must be auditable | Each version retained; current vs historical clearly distinguished | Amend signed contract; multiple amendments; concurrent edits | Both | P0 |
| CT-7 | Own-vs-all contract visibility | Contracts contain salary + BSN — highly confidential | Employee sees only own; `CAN_VIEW_ALL_CONTRACTS` for admins; scoped to company | Guess contractId; cross-company; PDF direct URL | Both | P0 |
| CT-8 | `contract-events` Kafka flow drives downstream state | Contract status must sync to user/payroll | Events emitted on generate/sign/finalize; consumers update correctly | Lost/duplicate event; consumer down; out-of-order events | Both | P0 |
| CT-9 | Contract expiry / renewal / termination handling | Expired contracts must not keep someone "active" for payroll | Status reflects expiry; renewal/termination flows correct | Contract end in past; auto-renew; terminate mid-term; back-to-back contracts | Both | P1 |
| CT-10 | Unsigned/declined contract blocks activation appropriately | Working without a signed contract is illegal | Employee can't be fully active/payable until contract signed (per policy) | Decline contract; never sign; sign after start date | Both | P0 |

---

## 15. Leave requests (verlof)

`LeaveRequestController`, `CreateLeaveRequest`, `ApproveLeaveRequest`, `RejectLeaveRequest`, `GetLeaveRequests`, `GetLeaveRequestsByStatus`, `GetListUserLeaveRequests`. Permissions: `CAN_APPROVE_LEAVE_REQUESTS`, `CAN_MANAGE_LEAVE_REQUESTS`, `CAN_VIEW_ALL_LEAVE_REQUESTS`.

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| LV-1 | Create leave request validates dates & balance | Leave affects pay, planning & reservations | Valid request created; insufficient-balance handled; overlaps detected | End before start; past dates; overlapping existing leave; zero-day; balance exceeded | Both | P1 |
| LV-2 | Approve/reject workflow gated & notified | Only authorised managers decide; employee must be informed | Approve/reject requires `CAN_APPROVE_LEAVE_REQUESTS`; status + notification correct | Approve already-approved; reject after approval; self-approval | Both | P0 |
| LV-3 | Approved leave updates balance & blocks conflicting shifts | Double-booking a person who's on leave | Balance decremented; planning conflict prevented/flagged | Approve leave overlapping assigned shift; partial-day; balance race | Both | P0 |
| LV-4 | Leave impact on payroll (paid vs unpaid, accrual) | Leave can be paid/unpaid and accrues holiday hours | Correct pay treatment per leave type; reservations adjusted | Unpaid leave proration; sick vs holiday; carryover at year-end | Both | P0 |
| LV-5 | Own-vs-all leave visibility | Employees shouldn't see colleagues' leave by default | Own requests visible to self; team/all needs `CAN_VIEW_ALL_LEAVE_REQUESTS` | Guess request ID; cross-company; manager scope | Both | P0 |
| LV-6 | Cancel/withdraw a request | Plans change; must reverse cleanly | Withdraw restores balance & frees planning | Cancel after approval; cancel after leave started; cancel rejected | Both | P1 |

---

## 16. CAO, Horeca rules & billing rates (config that drives money)

`CaoController`, `AdminCaoList`, `AdminCaoDetails`, `HorecaRuleAdminController`, `HorecaPayrollRules` (large rules engine), `BillingRateController`, `AdminUserBillingRates`, `AdminPlanningClientBillingRates`. Permissions: `CAN_MANAGE_FUNCTIONS`, `CAN_VIEW_FUNCTIONS`, `CAN_VIEW_BILLING_RATES`, `CAN_MANAGE_BILLING_RATES`, `CAN_MANAGE_COMPANY`.

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| CF-1 | CAO scale/rule create/edit applied to payroll | CAO config errors mis-pay everyone on that CAO | Saved rules drive correct gross/surcharges; validation on inputs | Invalid scale; overlapping effective dates; delete in-use CAO | Both | P0 |
| CF-2 | Horeca payroll-rules engine evaluates correctly per scenario | This large rules engine is high-complexity, high-risk | Each rule (surcharges, allowances, thresholds) produces correct result | Boundary thresholds; conflicting rules; rule precedence; disabled rule | Both | P0 |
| CF-3 | Effective-dating of rules/rates (no retroactive surprise) | A rate change must apply from the right date only | Period uses the rate effective for that period, not "latest" | Future-dated rate; back-dated change; gap between effective ranges | Both | P0 |
| CF-4 | Employee billing rate vs client billing rate distinction | One feeds cost, other feeds revenue — must not be swapped | Correct rate used on correct side of margin | Missing rate; default fallback; per-function vs per-user rate | Both | P0 |
| CF-5 | Billing-rate visibility/edit strictly permissioned | Rates are sensitive commercial data | View needs `CAN_VIEW_BILLING_RATES`; edit needs `CAN_MANAGE_BILLING_RATES` | Employee probing rates; cross-company rate read | Both | P0 |
| CF-6 | Rate/rule change audited and reconciles with finance | Money-affecting config must be traceable | Every change audited; downstream finance recomputed consistently | Change mid-finalized period; concurrent edits | Both | P0 |

---

## 17. Travel claims

`PlanningTravelClaimAdminController`, `TravelClaims`. Permission: `CAN_MANAGE_TIMESHEETS`.

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| TC-1 | Submit travel claim with distance/amount validation | Travel reimbursement is taxable/untaxable money | Valid claim stored; amount/distance validated; rate applied | Negative/zero distance; excessive amount; duplicate claim | Both | P1 |
| TC-2 | Approve/reject claim and flow into payroll | Approved claims affect net pay & tax (untaxed allowance limits) | Approval routes amount to payroll correctly within tax-free limits | Claim exceeding tax-free km rate; approve already-paid; reject after payroll | Both | P0 |
| TC-3 | Claim visibility own-vs-all & company scope | Employees shouldn't see others' claims | Own claims to self; management view permissioned & scoped | Cross-user/cross-company access | Both | P1 |

---

## 18. Messages & notifications

`MessageController`, `Messages`, `AdminMessages`, Kafka `notification-events`, AWS SES email. Permission: `CAN_MANAGE_MESSAGES`.

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| N-1 | In-app message send/receive/read state | Primary internal comms | Messages delivered to correct recipients; read/unread accurate | Send to disabled user; bulk send; long body; HTML/script in body (XSS) | Both | P1 |
| N-2 | Admin broadcast/targeted messages scoped correctly | A broadcast leaking across companies is a privacy breach | Recipients limited to intended company/role set | Cross-company broadcast; empty recipient set; huge recipient list | Both | P0 |
| N-3 | Email notifications via SES deliver & render | Invites, resets, payslip-ready rely on email | Emails delivered, correct content, links valid, from verified domain | SES throttling; bounce/complaint handling; spam-folder; broken template | Both | P1 |
| N-4 | Event-driven notifications fire on key actions | Missed notifications cause missed work/pay actions | `notification-events` produce the right notification reliably | Lost/duplicate event; consumer down; ordering; idempotent delivery | Both | P1 |
| N-5 | Notification content excludes sensitive data | Emailing BSN/salary in plaintext is a breach | Notifications link to the app, don't embed sensitive PII | PII in email body; PII in push/subject line | Both | P0 |
| N-6 | Message/notification access control | Users must not read others' messages | Only sender/recipient (and permitted admins) can read | Guess message ID; cross-company; deleted message | Both | P1 |

---

## 19. Audit log & admin actions

`AuditLogController`, `AdminAuditLog`, `AuditLogs`. Audit underpins compliance for every money/permission/data action.

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| AU-1 | All sensitive actions write an audit entry | Without audit, fraud/error is untraceable & non-compliant | Role changes, payslip edits, rate changes, user disable/delete, contract finalize all logged | Action that fails partway; bulk action; async action via Kafka | Both | P0 |
| AU-2 | Audit entries capture who/what/when/before-after/company | Partial audit is nearly useless in an investigation | Each entry has actor, target, timestamp, change delta, companyId | Impersonated/scope-switched actor; system-generated change | Both | P0 |
| AU-3 | Audit log is tamper-resistant & read-only | Editable audit defeats its purpose | No UI/API to edit/delete entries; append-only storage | Attempt to delete/modify entry; direct DB tamper detection | Both | P0 |
| AU-4 | Audit log view is permissioned, scoped, searchable | Audit itself contains sensitive trails | Only permitted admins see it; company-scoped; filter/search/paginate | Cross-company audit view; huge log performance; date-range filter | Both | P1 |
| AU-5 | Platform-admin scope-switch actions are attributed correctly | A platform admin acting "as" a company must be traceable | Audit shows real actor + acting-company context | Action while scoped into another company | Both | P0 |

---

## 20. Error handling & resilience

`GlobalExceptionHandler` (gateway) and per-service handling; React error states.

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| EH-1 | Consistent API error contract (status, code, message) | Inconsistent errors break the UI & confuse integrators | Uniform error shape; correct HTTP codes (400/401/403/404/409/422/500) | Validation vs auth vs conflict vs server error all distinct | Both | P1 |
| EH-2 | Errors never leak stack traces, SQL, internal hosts, secrets | Verbose errors are an info-disclosure vuln | Client sees safe message; details only in server logs | Forced 500; malformed JSON; DB error; gRPC failure surfaced | Both | P0 |
| EH-3 | Downstream-service-down degradation (gateway, gRPC, Kafka) | One service down must not cascade to total outage | Graceful failure, timeouts, circuit-breaking, clear user message | auth down; payroll down; Kafka down; gRPC timeout; partial outage | Both | P0 |
| EH-4 | Frontend handles API errors, loading, empty & offline states | Blank/frozen screens erode trust | Every page shows spinner/empty/error states; retries where sensible | 401 mid-session (redirect to login); 403; network drop; slow API | Both | P1 |
| EH-5 | Transactional integrity on multi-step writes | A half-completed money/contract operation corrupts data | Operations are atomic or compensated; no partial commits | Crash mid-payroll-run; mid-onboarding-approval; mid-finalize | Both | P0 |
| EH-6 | Retry/idempotency for Kafka consumers & external calls | At-least-once delivery means duplicates will happen | Consumers idempotent; retries safe; dead-letter for poison messages | Duplicate event; malformed event; consumer crash + replay | Both | P0 |
| EH-7 | Input-too-large / timeout / 429 handled gracefully | Resource-exhaustion resilience | Bounded request sizes; sensible timeouts; 429 with retry-after | Huge payload; slow client; thundering herd | Both | P1 |

---

## 21. Data validation & integrity

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| DV-1 | Server-side validation on every input (never trust client) | Client validation is bypassable | All endpoints validate types/ranges/required server-side | Bypass UI via direct API; missing/extra fields; wrong types | Both | P0 |
| DV-2 | Dutch-specific format validation: BSN (11-proef), IBAN, postcode, phone | Invalid BSN/IBAN breaks tax filing & payments | Format + checksum enforced; clear errors | Invalid checksum; foreign formats; whitespace; leading zeros | Both | P0 |
| DV-3 | Date/period validation across the system | Bad dates corrupt pay periods, contracts, leave | Start≤end; no impossible dates; period alignment enforced | 29 Feb; DST day; year boundary; far-future/past dates | Both | P0 |
| DV-4 | Numeric precision for money (no float drift) | Float money = cent errors at scale | Money stored/computed as fixed-precision decimal | Repeated division; rounding accumulation; very large sums | Auto | P0 |
| DV-5 | Referential integrity & cascade rules across services | Orphans/dangling refs corrupt reports | FK/constraint integrity within & logical integrity across services | Delete parent with children; cross-service orphan; reused ID | Both | P0 |
| DV-6 | Uniqueness & duplicate prevention (email, BSN, company, role names) | Duplicates break login, tax, assignment | Unique constraints enforced; friendly duplicate errors | Case/whitespace-different duplicates; race on concurrent create | Both | P0 |
| DV-7 | Encoding/length/special-char handling everywhere | Names with accents/apostrophes are normal in NL | Unicode preserved end-to-end incl. PDFs; lengths bounded | `Ã¶`/`Ã©`/`'`/emoji in names; very long strings; RTL; null bytes | Both | P1 |
| DV-8 | Optimistic concurrency / lost-update protection | Two admins editing one record can silently overwrite | Version/etag conflict detected; no silent data loss | Concurrent edit of user/payslip/planning | Both | P1 |

---

## 22. Security (application & infrastructure)

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| S-1 | OWASP Top 10 pass (injection, XSS, SSRF, broken access control, etc.) | Baseline security bar for handling salary/PII | No high/critical findings; broken-access-control specifically clean (this app's biggest risk) | SQLi in search/filter; stored XSS in messages/names; SSRF via upload/URL fields | Both | P0 |
| S-2 | Authorization enforced at API for every route (re-test of R-1 from attacker view) | Most real breaches are broken access control | No endpoint relies on UI hiding; pentest of direct calls | Forced browsing; param tampering; method override; missing-perm calls | Both | P0 |
| S-3 | Secrets management & rotation | Leaked JWT/SES/DB secret = full compromise | No secrets in repo/images/logs; rotation procedure tested | Dev secret in prod; secret in client bundle; secret in error/log | Both | P0 |
| S-4 | Transport security: TLS everywhere incl. internal gRPC/Kafka | Plaintext internal traffic is sniffable | HTTPS enforced (HSTS); internal channels encrypted/authenticated | HTTP downgrade; plaintext gRPC; Kafka without TLS/auth | Both | P0 |
| S-5 | Security headers & CORS | Misconfigured CORS/headers enable token theft | Strict CORS allowlist; CSP, X-Frame-Options, HSTS, no wildcard with creds | `*` CORS with credentials; clickjacking; missing CSP | Both | P0 |
| S-6 | File-upload security (ID docs, CVs, logos, pictures) | Upload is a classic RCE/XSS/storage vector | Type/size validated, content-sniffed, stored non-executable, AV-scanned, private | SVG/HTML with script; double extension; path traversal in filename; oversize | Both | P0 |
| S-7 | PII & special-category data protection (BSN, ID scans, salary) | NL/GDPR special-category data; legal duty | Encrypted at rest & in transit; access-logged; minimised in responses | BSN in logs/URLs; ID scan cache; PII in analytics | Both | P0 |
| S-8 | JWT hardening (alg pinning, short TTL, audience/issuer checks) | Token forgery = total bypass | `alg` pinned, iss/aud/exp validated, refresh rotation | `alg:none`; key confusion (RS/HS); long-lived token; missing claim checks | Both | P0 |
| S-9 | Rate limiting & anti-automation on public + auth endpoints | Brute force, scraping, SES abuse | Throttling on `/login`, `/apply`, `/forgot-password`, public reads | Credential stuffing; application spam; reset-email flood | Both | P0 |
| S-10 | Dependency & container vulnerability scanning | Known CVEs in deps/base images | SCA + image scan in CI; no critical CVEs at release | Outdated Spring/React; base-image CVEs; transitive deps | Auto | P1 |
| S-11 | Audit/log integrity & no sensitive data in logs | Logs are both evidence and a leak risk | Logs tamper-evident, retained, PII-scrubbed | Password/token/BSN in logs; log injection | Both | P1 |
| S-12 | Session fixation / CSRF (if cookie-based anywhere) | State-changing requests must be protected | New session on login; CSRF protection on cookie-auth endpoints | Pre-auth session reuse; cross-site state change | Both | P1 |

---

## 23. Performance, load & scalability

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| P-1 | Payroll run performance for a full company | Month-end run for hundreds of employees must finish in time | Run completes within SLA; no timeouts; bounded memory | 1,000+ employees; many shifts each; concurrent companies running | Both | P1 |
| P-2 | Large list endpoints paginate efficiently (no N+1) | Slow rosters/planning/payslip lists kill UX | Server-side pagination; indexed queries; stable latency | 10k users/payslips; deep page; combined filters | Both | P1 |
| P-3 | Heavy frontend pages render acceptably (`AdminPlanningOverview` ~90k LOC, `AdminUserDetails`, `AdminPayslipDetails`) | These very large pages are bundle/runtime risks | Reasonable load & interaction time; code-split where needed | Slow device; large dataset; many re-renders | Both | P1 |
| P-4 | PDF generation under load (payslips & contracts in bulk) | Bulk month-end PDF generation can exhaust resources | Bulk generation throttled/queued; no OOM; completes reliably | Generate all payslips at once; large multi-page PDFs | Both | P1 |
| P-5 | Kafka throughput & consumer lag under burst | Event backlog delays pay/notifications | Consumers keep up or recover; lag monitored & alerted | Burst of finalize events; consumer restart; partition rebalance | Both | P1 |
| P-6 | Database connection-pool sizing & query indexing | Pool exhaustion = sitewide 500s | Pools sized per service; slow-query log clean; key indexes present | Many concurrent users; long transactions; report queries | Both | P1 |
| P-7 | Concurrency/soak/stress test (realistic mixed load) | Find leaks & contention before clients do | Stable over sustained load; no memory leak; graceful at peak | Sustained multi-tenant load; spike; gradual ramp | Auto | P2 |

---

## 24. API behaviour & contracts

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| API-1 | Gateway routing maps every public path to the right service | A mis-route exposes or breaks an endpoint | Each route reaches intended service; no unintended exposure | Trailing-slash variants; unknown path → 404; method not allowed → 405 | Both | P0 |
| API-2 | Auth filter applied to all protected routes; public routes intentional | An accidentally-public route leaks data | Protected routes 401 without token; only `/apply`,`/login`,`/forgot`,`/reset` public | New route added without auth; misconfigured allowlist | Both | P0 |
| API-3 | Request/response schema validation & content-type handling | Loose APIs accept bad data / break clients | Rejects malformed/oversized/wrong content-type; consistent JSON | Extra fields; wrong types; missing content-type; non-JSON body | Both | P1 |
| API-4 | Pagination/sort/filter params validated & bounded | Unbounded queries = DoS & data leaks | Page size capped; invalid params rejected; filters can't bypass scope | `pageSize=1e9`; negative page; filter-based IDOR; SQL in sort | Both | P0 |
| API-5 | Consistent date/number/currency serialization (ISO, EUR) | Client/integration mismatches cause real errors | ISO-8601 dates, explicit decimals, documented formats | TZ in timestamps; null vs absent; decimal precision | Both | P1 |
| API-6 | Inter-service contracts (gRPC `UpdatePassword`, REST between services) stable & versioned | A silent contract change breaks another service | Contract tests pin shapes; breaking change caught in CI | Field removed/renamed; type change; new required field | Auto | P0 |
| API-7 | Idempotency for state-changing endpoints where retries occur | Network retries must not double-act | Idempotency keys / natural idempotency on pay/contract/leave actions | Duplicate POST; client retry after timeout | Both | P1 |
| API-8 | Backward compatibility for the SPA against deployed API | A frontend/back mismatch on deploy breaks users mid-session | Rolling deploy compatible; versioned where needed | Old tab vs new API; new field optional | Both | P1 |

---

## 25. Integrations & eventing (Kafka, gRPC, SES, PDF)

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| I-1 | Kafka topics (`user`, `contract-events`, `notification-events`) end-to-end | Cross-service state & notifications depend on events | Producers emit, consumers process, state converges | Broker down; consumer lag; duplicate; out-of-order; schema change | Both | P0 |
| I-2 | Event idempotency & exactly-effective processing | At-least-once delivery → duplicates | Reprocessing an event has no double effect | Replayed event; partial consume + retry; poison message → DLQ | Both | P0 |
| I-3 | gRPC auth-service↔services (`UpdatePassword`, user lookups) | Internal RPC failure breaks password & user flows | Calls succeed, secured, time out gracefully on failure | Service unavailable; deadline exceeded; auth on channel; TLS | Both | P0 |
| I-4 | AWS SES email integration (invites, resets, notifications) | Email is on the critical path for onboarding & auth | Emails send from verified domain; bounce/complaint handled; rate-limited | SES sandbox vs prod; throttle; suppression list; DKIM/SPF/DMARC | Both | P0 |
| I-5 | PDF generation pipeline (payslips, contracts) | Legal documents must render correctly & reliably | Correct, complete, well-formatted PDFs every time | Fonts/encoding for accents; €/comma; multi-page; concurrency | Both | P0 |
| I-6 | Eventual-consistency windows are acceptable & visible | Cross-service lag can confuse users ("I approved it but…") | Acceptable lag; UI reflects pending state; converges | Read immediately after write across services | Both | P1 |
| I-7 | External-dependency outage handling (SES/Kafka/DB down) | Third-party/infra outages must degrade gracefully | Retries, queueing, clear messaging; no data loss | SES outage during onboarding; Kafka down during finalize | Both | P0 |

---

## 26. Frontend, UX, accessibility & localisation

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| UX-1 | Routing guards (`RequireActiveUser`, `RequireOnboarding`, `RequirePermission`) behave correctly | Wrong guard = lockout or leak | Each guard redirects/permits correctly incl. loading state | Deep-link while unauth; refresh on guarded route; permission still loading | Both | P1 |
| UX-2 | Cross-browser & responsive (desktop/tablet/mobile) | Clients use varied devices | Core flows work on supported browsers & viewports | Small screens on planning board; old browser; zoom 200% | Manual | P1 |
| UX-3 | Forms: validation messaging, disabled-while-submitting, double-submit prevention | Double-submit can double-create pay/contracts | Inline errors; submit disabled during request; no duplicate submit | Rapid double-click submit; back after submit; slow network | Both | P0 |
| UX-4 | Number/date/currency display in NL locale | Mis-formatted money confuses & misleads | `€ 1.234,56`, NL dates, consistent across app & PDF | Locale mismatch; negative; thousands separators | Both | P1 |
| UX-5 | Language/i18n consistency (NL/EN as applicable) | Mixed-language UI looks unfinished & risky on legal text | Consistent language; legal/contract terms correct in NL | Untranslated keys; mixed NL/EN; long-translation overflow | Manual | P2 |
| UX-6 | Accessibility (keyboard nav, labels, contrast, screen reader) | Inclusivity + possible legal requirement | Meets WCAG AA on core flows | Keyboard-only onboarding; SR on forms; color-only status | Both | P2 |
| UX-7 | Loading/empty/error states on every data view | Blank screens read as "broken" | Spinner/empty/error consistently shown | Slow API; zero results; failed fetch | Both | P1 |
| UX-8 | Session-expiry UX (redirect to login, preserve intent) | Abrupt failures lose user work | 401 → graceful redirect with message; ideally resume | Expiry mid-form; expiry mid-multi-step onboarding | Both | P1 |

---

## 27. Compliance, privacy & data lifecycle (GDPR / NL payroll law)

| ID | What to test | Why it matters | Expected result | Key edge cases | Type | Pri |
|----|--------------|----------------|-----------------|----------------|------|-----|
| GD-1 | Lawful retention vs erasure (tax records ~7yr vs GDPR erasure) | Conflicting legal duties must be reconciled correctly | Erasure honours retention; non-fiscal PII removable; documented policy | Erasure request from ex-employee with payslips; partial anonymisation | Both | P0 |
| GD-2 | Data-subject access export (employee's own data) | GDPR right of access | User can obtain their personal data; export accurate & scoped | Large export; includes only own data; format | Both | P1 |
| GD-3 | Consent & e-signature record-keeping | Signed contracts & consents must be provable | Consent/signature timestamped, attributable, retained | Withdrawn consent; re-consent; signature audit | Both | P0 |
| GD-4 | Data minimisation in API responses & logs | Over-returning PII expands breach surface | Endpoints return only needed fields; BSN masked unless permitted | Full-object responses leaking BSN/salary; verbose logs | Both | P0 |
| GD-5 | Access logging for special-category data (ID scans, BSN) | Accountability for sensitive-data access | Every view of ID doc/BSN is logged with actor | Bulk access; export of sensitive fields | Both | P1 |
| GD-6 | Cross-tenant data-processing boundaries documented | Multi-tenant + processor obligations | Clear processor/controller boundaries; isolation evidenced | Platform-admin access to tenant PII logged | Both | P1 |

---

## 28. Go-live gate & test-automation strategy

| ID | What to test / establish | Why it matters | Expected result | Test type | Pri |
|----|--------------------------|----------------|-----------------|-----------|-----|
| G-1 | CI runs all backend JUnit + frontend Vitest on every PR | Regressions caught before merge | Green required to merge; coverage tracked | Auto | P0 |
| G-2 | Replace stale `integration-test` template (`PatientIntegrationTest`) with real cross-service integration suite | Current integration module tests nothing real | Meaningful auth/payroll/contract integration tests run in CI | Auto | P0 |
| G-3 | Add end-to-end suite (Playwright/Cypress) for critical journeys | No e2e layer detected; critical flows unguarded | E2e covers: apply→onboard→contract sign→plan→work→payslip→jaaropgaaf | Auto | P0 |
| G-4 | Golden-master fixtures for payroll/finance per CAO & scenario | Money math needs cent-exact regression protection | Fixtures asserted against Handboek Loonheffingen examples | Auto | P0 |
| G-5 | Contract tests for gRPC & Kafka schemas | Prevent silent inter-service breakage | Provider/consumer contract tests in CI | Auto | P0 |
| G-6 | Security scan gate (SAST/DAST/SCA + image scan) in CI | Stop shipping known vulns | No critical findings to release | Auto | P0 |
| G-7 | UAT with a pilot client on production-like data | Real-world validation before broad launch | Pilot signs off on payroll accuracy & core flows | Manual | P0 |
| G-8 | Load/soak test against production-like infra | Validate capacity & stability | Meets SLA at expected peak with headroom | Both | P1 |
| G-9 | Disaster-recovery & rollback drill | Must be able to recover/roll back fast | Restore + deploy-rollback rehearsed and timed | Manual | P0 |
| G-10 | Monitoring, alerting & on-call runbook live | You can't operate what you can't see | Dashboards + alerts on errors/lag/latency; runbook exists | Both | P0 |

---

## 29. Release sign-off summary

Before declaring production ready, confirm **all P0 rows pass** and P1 rows are pass-or-documented:

- [ ] §3–4 Auth & RBAC: server-side enforcement verified by direct-API attack tests (R-1, S-2).
- [ ] §5 Multi-tenant isolation: zero cross-company leakage proven (T-1…T-7).
- [ ] §12–13 Payroll & finance: cent-exact vs Handboek Loonheffingen; jaaropgaaf ties out (PY-*, F-4/F-5).
- [ ] §14 Contracts: correct merge, immutable signed PDF, attributable signature (CT-1, CT-4, CT-5).
- [ ] §16 CAO/Horeca/rates: effective-dating and correct cost-vs-revenue rates (CF-3, CF-4).
- [ ] §22 Security: OWASP pass, secrets externalised, TLS internal+external, upload hardening.
- [ ] §20–21 Error handling & validation: atomic money ops, idempotent events, server-side validation.
- [ ] §25 Integrations: Kafka idempotency, SES deliverability, PDF correctness.
- [ ] §28 Gates: CI green, real integration + e2e suites, golden-master payroll fixtures, DR drill.

> **Highest-risk reminder:** the two failure modes most likely to be missed and most damaging here are (1) **broken access control / cross-tenant leakage** (test every endpoint from an attacker's seat, not the UI) and (2) **silent payroll/tax miscalculation** (assert to the cent against an independent reference, with regression fixtures per CAO and per edge case). Spend disproportionate effort there.

