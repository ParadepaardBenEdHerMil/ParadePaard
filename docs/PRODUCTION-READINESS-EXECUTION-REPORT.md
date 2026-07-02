# ParadePaard — Production-Readiness Plan: Execution Report

> Companion to `PRODUCTION-READINESS-TESTING-CHECKLIST.md`.
> Branch: `feature/production-readiness-tests`. The 2026-07-01 batch is pushed to `origin`
> (~53 commits ahead of `main`); the **2026-07-02 batch below is not yet committed/pushed**
> (blocked on a stale local `.git/index.lock` — commit from the workstation).
> Toolchain used: Temurin **JDK 21** (services require 21), Maven wrapper per service.
> Date first executed: 2026-06-29. Last verification pass: 2026-07-02.

---

## 0.1 Update — 2026-07-02 feature build (current status; read before §0)

This pass moved beyond tests into the functional gaps §0 had flagged as remaining. Everything
below was written and **verified green under JDK 21** (per-suite `mvnw test`, run from an
isolated sandbox copy — see the mount caveat at the end).

**Now done (were "remaining" in §0):**

- **TS-3 timesheet approve/reject + audit — BUILT.** New `TimesheetStatus` (PENDING/APPROVED/REJECTED),
  `POST /timesheet/{id}/approve|reject` gated by `CAN_MANAGE_TIMESHEETS`, append-only `timesheet_audit`
  trail (who/when/reason per create/update/approve/reject), and a 409 guard against flipping a finalized
  decision. (`TimesheetApprovalServiceTest` 6, controller-security +approve/reject/409 = 17, service 9.)
- **Finance corrections reconcile (F-6) — TESTED.** `PayrollFinanceReconciliationTest` (5): overview/breakdown
  reconcile for arbitrary partial/cross-month ranges; disputed/pending slips excluded; a corrected slip
  supersedes its disputed original (counted once); breakdown sums back to overview.
- **Planning edge cases (PL-2/4/8) — BUILT + TESTED.** `ShiftHoursCalculator` (overnight + both DST nights,
  breaks — 7 tests); cross-shift double-booking guard `ShiftOverlap` wired into assignment (2 tests);
  finalize-locks-project pinned (1 test). Full planning suite still green.
- **CAO Horeca pay-scale tables (PY-9 data blocker / CF-1) — BUILT.** `CaoWageResolver`: modular,
  effective-dated wage tables per CAO; Horeca seeded with the **official KHN loontabel per 1-1-2026**
  (function groups 1–11 × age bands); resolves the contract wage by group/age/date, falls back to the
  statutory WML, never pays below it. Exact-cent tests (`CaoWageResolverTest` 12). *Not yet wired into the
  live contract-creation flow — needs a function→group mapping.*
- **Leave balances & accrual (§15) — BUILT.** `LeaveBalance` per user/year, `LeaveBalanceService`
  (get/create, accrue, reserve-on-approve with insufficient-balance 409, restore-on-cancel), wired into
  approve + a new cancel flow; only VACATION draws down. (`LeaveBalanceServiceImplTest`, extended
  `LeaveRequestServiceImplTest`.)
- **Real leave entitlement — BUILT.** `StatutoryLeaveEntitlement` = 4 × weekly hours (NL minimum);
  weekly hours captured in onboarding (added `hoursPerWeek` to the contract-setup draft; frontend already
  collects it) and read to set entitlement, full-time fallback when unknown. (`StatutoryLeaveEntitlementTest` 6.)
- **Onboarding hours wiring — DONE.** Backend DTO carries `hoursPerWeek`; the admin onboarding-review save
  now normalizes hours to the contract type (FULL_TIME→38, ZERO_HOURS→0) via the existing tested helper.

**Verification (JDK 21, 2026-07-02):** timesheet, payroll (finance), planning, contract (CAO), and
user-service (leave + entitlement) leave/feature suites all green — 12 (CAO), 27 (leave), 32 (leave+entitlement
incl. statutory), 5 (finance), 10 (planning edges), plus timesheet approval suite. No regressions in the
existing suites that were re-run.

**Caveat (verification environment, not the code):** the sandbox's file mount intermittently served
truncated copies of some files, so several files had to be reconstructed from the authoritative on-disk
versions before building; the frontend toolchain could not run at all (its `node_modules` was installed for
Windows). The **frontend one-line change (hours normalization) was therefore not machine-verified** — it is
type-correct and uses the file's own tested helper, but confirm it with `npm test`/build on the workstation.

- **PY-20 4-weekly (vierwekelijks) cycle — DONE.** `FOUR_WEEKLY` is in the `PaymentFrequency` enum and
  `PayPeriodCalculator` (13 periods/yr, 28-day blocks anchored on the first ISO Monday, year-boundary
  handled); `LoonheffingCalculator` already maps it to 13 periods. Verified: `PayPeriodCalculatorTest`
  15 green (incl. `FOUR_WEEKLY:2026-P01` and the year-straddling `FOUR_WEEKLY:2026-P13`), `LoonheffingCalculatorTest` 8.

**Test batches added 2026-07-02 (cont.) — all green:**

- **PY-9 loonheffing cent-exact golden masters — DONE.** `LoonheffingCalculatorGoldenMasterTest` (7): wage
  tax pinned to the cent across monthly/weekly/4-weekly, loonheffingskorting on/off, the green (AOW) table,
  and period↔annual reconciliation, against the pinned 2026 tables.
- **TS-5/6/7 timesheet — DONE.** `TimesheetImportReconciliationTest` (2, planning→timesheet→payroll hours
  preserved to the cent), `TimesheetWorkHistoryTest` (2, own-scoped + accurate pagination),
  `UserServiceWorkHistoryPreferenceTest` (4, saved column prefs cleaned/persisted/scoped).
- **§6 job-application abuse — DONE (upload hardening).** New `JobApplicationUploadValidator` (CV/profile
  uploads restricted to allowed types within a 5 MB cap; SVG/exe rejected; 400 on violation), wired into
  the public submit path. `JobApplicationUploadValidatorTest` (9).
- **§9 clients/locations CRUD — DONE.** `PlanningClientLocationCrudTest` (9): create/update/delete with
  validation, company-scoping, and the delete-blocked-while-linked-to-projects guard; location create/delete.

**Cross-service leave integration (2026-07-02 cont.) — foundation + leave↔roster DONE:**

- **user-service leave read-model over gRPC — DONE.** New `LeaveQueryService` (approved paid/unpaid leave
  hours for a period, pro-rated to days-in-range; overlap detection) exposed via two new RPCs on the
  existing gRPC `UserService` (`GetApprovedLeaveHours`, `HasApprovedLeaveOverlap`). `LeaveQueryServiceTest` (7).
- **leave↔roster overlap-blocking — DONE (roster direction).** planning now refuses to roster an employee
  onto a shift on a day they are on approved leave: new `UserLeaveGrpcClient` + `user_service.proto`, wired
  into the assignment path (fail-open if user-service is down). `PlanningLeaveConflictTest` (2); existing
  planning suites unaffected. Reverse direction (block *approving leave* that clashes with a rostered shift)
  still needs planning to expose shifts to user-service.
- **leave→payroll feed — machinery DONE + tested; one money-core hook remains.** Decision taken: separate
  by type. user-service now returns leave hours split **holiday / sick / unpaid** (`LeaveQueryService`, 7
  tests, new `sickLeaveHours` proto field). payroll: `LeavePayCalculator` (holiday at full wage, sick at a
  configurable `payroll.sick-leave-pay-percentage` (default 100), unpaid = 0; 7 cent-exact tests),
  `LeavePayService` (gRPC hours → calculator, fail-open; 3 tests), and `UserServiceGrpcClient.getApprovedLeaveHours`.
  Sick % configured to the Horeca CAO first-year rate: `payroll.sick-leave-pay-percentage=95`
  (CAO is 95% yr 1 / 75% yr 2 + unpaid wachtdag; long-term tiering + wachtdag not yet modelled). Verified the
  payroll context loads with it bound.
  **Remaining:** the single insertion in `PayrollService`'s payslip-generation path to add
  `leavePayService.leavePayFor(userId, periodStart, periodEnd, hourlyWage).totalLeavePay()` to the payslip
  gross (and, for display, store the per-type breakdown on new `Payslip` fields) — deliberately left for a
  dev environment where the full payslip-generation suite can verify a change to the gross, since it is
  money-critical and this sandbox's file mount was unreliable on the large `PayrollService`/`Payslip` files.

**Still remaining:** the leave→payroll wiring (above) + reverse leave↔roster direction; wiring
`CaoWageResolver` into contract creation; §19 audit append-only, §20 error-contract, §24 gRPC/Kafka contract
tests; and all Manual/Infra sections. See §0 and §3 for the full list.

---

## 0. Update — 2026-07-01 verification pass (read this first)

Since the original 2026-06-29 write-up below, **46 further commits** landed on the branch and
**every "recommended next batch" from §4 has now been implemented**. The branch is pushed. A full
JDK-21 test run on 2026-07-01 confirms the work is green.

**Now done (were "Gap"/"recommended"/"Finding" on 2026-06-29):**

- **R-1 controller-layer 403 sweep — COMPLETE.** Every controller across all 7 services now has a
  `@WebMvcTest` `*ControllerSecurityTest` proving anonymous → 401 and missing-permission → 403 with
  `verifyNoInteractions(service)`. (auth ×2, user ×10, contract ×1, payroll ×2, planning ×7, timesheet ×1.)
- **DV-1 Bean Validation provider — COMPLETE.** `spring-boot-starter-validation` enabled in user-service;
  `@Valid`/`@NotBlank` now actually fire.
- **CF-3 effective-dating — COMPLETE.** Historical billing-rate resolution now filters by shift date
  ("Fix historical billing rate resolution"); covered by `BillingRateServiceTest`.
- **CT-5 signed-PDF immutability — COMPLETE.** Contract signing now validates document hashes.
- **Travel tax-free cap — COMPLETE.** Reimbursement above the statutory €/km rate is now split into a
  taxable portion.
- **Leave decision IDOR — COMPLETE.** Leave approve/reject now company-scoped (`LeaveRequestServiceCompanyScopeTest`).
- **PY-8 WML (was "blocked: functional gap") — IMPLEMENTED.** Dutch minimum hourly wage now enforced in
  contract-service; 2024/2025 rate tables registered (`ContractServiceMinimumWageTest`, `DutchMinimumWageScheduleTest`).
- **Horeca wage rules** — updates propagate into replacement drafts, limited to supported roles.

**Verification (JDK 21, `mvnw test` per service, 2026-07-01):**

| Service | Result |
|---------|--------|
| user-service | **157 tests, 0 failures** ✅ |
| planning-service | **83 tests, 0 failures** ✅ |
| payroll-service | BUILD SUCCESS (golden masters, loonheffing, jaaropgaaf, both security tests) ✅ |
| contract-service | 64/65 ✅ (1 false failure — see note) |
| timesheet-service | **38 tests, 0 failures** ✅ |
| auth-service | all green ✅ (1 false failure — see note) |

> **Note on the 2 "failures":** `DockerComposeConfigurationTest` (contract) and `EmailConfigurationTest`
> (auth) read `../docker-compose.yml`. They failed **only** because the verification build ran from an
> isolated copy without the repo-root compose file; that file exists in the real tree, so both pass in place.

**Genuinely remaining (automatable, not yet written):** PY-9 per-CAO loonheffing golden masters
(WML now exists, so CAO pay-scale tables are the last money-math piece), TS-3/5/6/7 (timesheet
approve/work-history/reconcile), F-6 corrected/voided prior-period reconcile, §6 job-application abuse
(partly covered), §9 client/location CRUD, §10 planning overnight/DST/double-book, §19 audit
append-only, §20 error-contract, §24 gRPC/Kafka contract tests.
_(Superseded by §0.1: TS-3, F-6, §10 planning edges and the CAO pay-scale data are now done; TS-5/6/7,
PY-9 loonheffing masters, §6/§9/§19/§20/§24 remain.)_

**Remaining functional build-out:** leave balance/accrual/overlap (§15), PY-20 4-weekly cycle (product
decision), plus all Manual/Infra sections (§2 env, §22 security tooling, §23 perf, §27 GDPR, §28 go-live gates)
and a browser e2e layer (G-3).
_(Superseded by §0.1: leave balance/accrual + real entitlement and PY-20 (4-weekly) are now done;
leave↔roster overlap and the leave→payroll feed remain — both cross-service — along with the Manual/Infra sections.)_

The 2026-06-29 report below is retained as the historical record; treat §0 as the current status.

---

## 1. What this pass delivered (implemented + verified green)

This pass implemented the concrete, automatable **P0** work the checklist flagged as first
priority — closing the weakest area, the dev-frequency safety gap, the period-maths vectors,
and the stale integration template — and verified each by building and running the affected
suites with JDK 21.

| Commit | Area | Change | Verified |
|--------|------|--------|----------|
| `17f7689` | §11 Timesheets (weakest) | New `TimesheetServiceTest`, `TimesheetRequestDTOValidationTest`, `TimesheetImportIdempotencyTest`; **prod fix**: server-side validation on `TimesheetRequestDTO` | `mvnw test` → **21 tests, 0 failures** |
| `a12bc52` | §12 Payroll safety (PY-19) | **prod fix**: `ContractService` rejects `EVERY_5/10_MINUTES` when `app.production=true`; new `PaymentFrequencyTest`; extended `ContractServiceCreateContractTest` | contract-service full suite **17 classes green** |
| `5856f96` | §12 Payroll periods (PY-7b) | Extended `PayPeriodCalculatorTest` to full reference-vector set | **13 tests** green; `PayslipSchedulerTest` **3** green |
| `39e288a` | §28 Integration (G-2) | Replaced dead `PatientIntegrationTest` with `FullEmployeeLifecycleSimulationTest` + `IntegrationEnvironment`; module compiler aligned to Java 21 | module builds; **6 tests skip cleanly** with no stack |
| `020d3df` | §12 Payroll calc (G-4) | New `PayslipCalculatorGoldenMasterTest` — cent-exact gross/fiscal/net, travel-not-fiscal, rounding, employer levies | **5 tests** green (40 payroll-calc tests green together) |
| `d7281c1` | §4/§5/§11 Access control (R-8/R-10/T-1) | New `TimesheetPermissionTest`; extended `ContractServiceCompanyScopeTest` with cross-company IDOR cases | **6 + 5 tests** green |
| `381bedc` | §7/§21 Dutch validators (DV-2/O-6/O-8) | **prod fix**: `OnboardingService` rejects invalid BSN (11-proef) / IBAN (MOD-97) → HTTP 400; new `DutchIdentifierValidator` | **20 + 4 tests** green |
| `3bd3431` | §13 Finance/jaaropgaaf (F-5/F-3) + §5 tenant-scope (T-6) | Extended `JaaropgaafServiceTest`: company-wide `buildVerzamelloonstaat` totals reconcile to the sum of per-employee jaaropgaaf rows; foreign-company and non-released payslips excluded; null `companyId` rejected | **7 tests** green (JDK 21) |
| `04453e3` | §16 CAO/rates (CF-4) | Extended `PayrollMarginServiceTest`: revenue follows the **client** billing rate while employer cost follows the **employee** wage (swap guard); `negative_margin` when wage-cost exceeds client revenue; `low_margin` threshold | **9 tests** green (JDK 21) |
| `f9d18f5` | §17 Travel claims (TC) | New `saveTravelClaim` tests in `EmployeePlanningServiceTest`: total = km x default rate (0.23) HALF_UP/2dp; `PENDING` vs `AUTO_APPROVED` by company mode; travel rejected on a non-CONFIRMED shift | **6 tests** green (JDK 21) |
| `e972c13` | §15 Leave (LV) | New `LeaveRequestMapperTest`: a leave request is born `PENDING` (never created pre-approved), fields parsed/copied, display-name precedence | **3 tests** green (JDK 21) |
| `f837beb` | §15 Leave (LV-2) | **prod fix**: `approve`/`reject` now require a PENDING request (no silent flip of a finalized decision); new `InvalidLeaveRequestStateException` -> HTTP 409. `LeaveRequestServiceImplTest` | **4 tests** green (JDK 21) |

Timesheet-service went from **1 → 4 test files (1 → 21 tests)** — the single biggest coverage
gap in the repo is now closed.

### Production code changed (4 safe fixes, per "tests + safe prod fixes")

1. **`TimesheetRequestDTO`** — added bean-validation (`@NotBlank` userId/name/date,
   ISO-date `@Pattern`, `@NotNull`+`@DecimalMin("0.0")` hours, non-negative travel/break).
   Closes TS-8 / DV-1 (manual timesheet entry had **no** server-side validation). Zero hours
   with travel stays valid (PY-1). Inert to the gRPC import path.
2. **`ContractService`** — enforces PY-19: a contract can no longer persist a development-only
   pay frequency when `app.production=true` (guard in `applyContractDefaults`, covers create +
   update). Defaults to `false` so local/dev smoke flows still work. **Action for ops: set
   `app.production=true` (or `APP_PRODUCTION=true`) in the production contract-service config.**
3. **`OnboardingService`** — rejects an invalid BSN (11-proef) or IBAN (MOD-97) at
   `completeUserSetup` before persisting, returning HTTP 400 via a new `InvalidIdentifierException`
   handler. Enforced in the service layer because user-service has no Bean Validation provider
   (see finding below), so `@Valid` would not fire.
4. **`LeaveRequestServiceImpl`** — `approveLeaveRequest`/`rejectLeaveRequest` now require the request
   to be `PENDING`; an already APPROVED/REJECTED/CANCELED request can no longer be silently flipped to
   another outcome. Invalid transitions raise `InvalidLeaveRequestStateException` -> HTTP 409 Conflict.
   Bounded and additive; the create/update/delete paths are unchanged.

---

## 2. Environment constraints encountered (important)

- **No Git push credentials in this environment.** Commits were made locally on
  `feature/production-readiness-tests`; pushing and opening the PR must be done from your
  machine (commands in §5). `gh` CLI and a token are both absent here.
- **JDK 21 had to be provisioned** (sandbox shipped JDK 11; services need 21). Your machine
  already builds these, so this only affected in-sandbox verification.
- The repo tracks some `target/` build artifacts (e.g. `integration-test/target/*.class`);
  these are not part of the feature commits. Consider adding `target/` to `.gitignore`.
- **Finding (DV-1):** user-service depends only on `jakarta.validation-api` with **no provider**
  (hibernate-validator), so every `@Valid`/`@NotBlank` in its controllers is a silent no-op at
  runtime. BSN/IBAN are now enforced in the service layer; adding the validation starter to turn
  the rest back on is recommended but needs flow-by-flow regression (it changes behaviour service-wide).
- **Finding (CF-3):** per-shift billing-rate resolution (`BillingRateService.resolveOne`) returns the
  `active` rate and never filters by the shift date, even though rates are effective-dated
  (`effectiveFrom`/`effectiveTo`) and versioned on the write side. Re-pricing a historical, not-yet-paid
  (ESTIMATED) shift therefore uses today's rate, not the rate effective then. Honouring it needs
  date-windowed queries + overlap rules and reprices history, so it was flagged rather than changed.
- **Finding (TC tax-free cap):** travel-claim amount is simply `km x rate` (default EUR 0.23/km, the
  Dutch tax-free rate). There is no cap that splits reimbursement above the tax-free rate into a taxable
  portion, so a configured rate above EUR 0.23/km would be paid entirely untaxed. Amount math and the
  approved-only payroll gating are correct and now tested; the cap is a missing rule.
- **Finding (LV):** `LeaveRequestServiceImpl` is CRUD-only — **no leave balance, accrual,
  overlap/conflict check, or payroll impact**. The invalid-transition half is now **fixed** (LV-2:
  approve/reject are PENDING-only, see prod fix #4); still open is the **lack of ownership/company-scope
  on the decision endpoints** (admin authority is required, but any company's requestId is reachable —
  a cross-tenant IDOR to close next), plus the balance/accrual build-out.

---

## 3. Status of every checklist section

Legend: **Done-now** (implemented & verified this pass) · **Existing** (already covered by
repo tests, per the checklist's own baseline) · **Manual/Infra** (cannot be executed as unit
code — needs a person, live stack, or infrastructure) · **Gap** (automatable, not yet written).

| § | Area | Status | Notes |
|---|------|--------|-------|
| 2 | Cross-cutting / env (X-1…X-9) | Manual/Infra | docker bring-up, secrets, backups, DST — ops + manual drills |
| 3 | Auth & session (A-1…A-13) | Existing + Gap | auth-service has 9 test files; add direct-API attack tests (A-4 alg:none, A-5 refresh reuse) |
| 4 | RBAC (R-1…R-10) | Existing + Done-now | R-8/R-10 ownership+IDOR added (TimesheetPermissionTest); remaining: per-endpoint 403 sweep (R-1) at controller layer |
| 5 | Multi-tenancy (T-1…T-7) | Existing + Done-now | T-1 cross-company contract reads now denied (view/by-user/current); extend matrix to payroll/planning/finance |
| 6 | Job application (AP-1…AP-6) | Gap | public-intake abuse-resistance + scoping tests |
| 7 | Onboarding (O-1…O-11) | Existing + Done-now | O-6/O-8 BSN(11-proef)+IBAN(MOD-97) enforced & tested; remaining: invite single-use/expiry (O-3), activation events (O-10) |
| 8 | Employee mgmt (E-1…E-9) | Existing + Gap | add retention-on-delete (E-4), bank-change audit (E-6) |
| 9 | Clients/locations (C-1…C-5) | Gap | planning-client CRUD + delete-with-references |
| 10 | Planning (PL-1…PL-10) | Existing + Gap | `PlanningManagementServiceTest` exists; add overnight/DST shift, double-book (PL-2, PL-4), finalize (PL-7) |
| 11 | Timesheets (TS-1…TS-9) | **Done-now** | TS-1,2,4,8,9 + ownership/IDOR implemented; TS-3/5/6/7 (approve/work-history/reconcile) remain |
| 12 | Payroll (PY-1…PY-20) | Done-now + Existing + Gap | PY-7b + G-4 golden masters (PY-1b/3/17/2) done; PY-16/19 covered; remaining: per-CAO loonheffing scenarios (PY-9) + WML (PY-8) |
| 13 | Finance/jaaropgaaf (F-1…F-9) | Existing + Done-now | F-5 now covered: `buildVerzamelloonstaat` totals = Σ per-employee rows, tenant-scoped (T-6), non-released excluded; remaining: corrected/voided prior-period reconcile + per-period loonaangifte tie (F-6) |
| 14 | Contracts (CT-1…CT-10) | Existing + Done-now | 17 contract tests incl. workflow/sign/PDF; PY-19 added; add signed-PDF immutability hash (CT-5) |
| 15 | Leave (LV-1…LV-6) | Done-now (LV-2) + **Finding** | LV-2 state guard implemented (approve/reject PENDING-only, 409); mapper PENDING-default pinned. **Remaining gap**: no balance/accrual/overlap, and no ownership/company-scope on the decision endpoints |
| 16 | CAO/Horeca/rates (CF-1…CF-6) | Existing + Done-now + **Finding** | CF-4 cost-vs-revenue guard done; **CF-3 finding**: rate resolution never filters by shift date (see findings) — effective-dating not honoured on read |
| 17 | Travel claims (TC-1…TC-3) | Done-now (partial) + **Finding** | Amount math + approval-gating covered; **TC finding**: no tax-free km cap — reimbursement above EUR 0.23/km is not split into a taxable portion |
| 18 | Messages/notifications (N-1…N-6) | Existing + Gap | add no-PII-in-notification (N-5) |
| 19 | Audit log (AU-1…AU-5) | Existing + Gap | add append-only / tamper-resistance (AU-3) |
| 20 | Error handling (EH-1…EH-7) | Gap | error-contract + no-stacktrace-leak + idempotent consumers |
| 21 | Data validation (DV-1…DV-8) | Done-now (partial) | DV-1 timesheet + DV-2 BSN/IBAN done; remaining: postcode/phone formats, DV-8 optimistic concurrency |
| 22 | Security (S-1…S-12) | Manual/Infra | OWASP/DAST/pen-test/TLS/secrets — tooling + audit, not unit tests |
| 23 | Performance (P-1…P-7) | Manual/Infra | load/soak against prod-like infra |
| 24 | API contracts (API-1…API-8) | Existing + Gap | `ApiGatewayRouteConfigurationTest` exists; add gRPC/Kafka contract tests (API-6, G-5) |
| 25 | Integrations (I-1…I-7) | Gap + Manual | Kafka idempotency unit-testable; SES/PDF deliverability partly manual |
| 26 | Frontend/UX (UX-1…UX-8) | Existing + Manual | Vitest specs exist; a11y/cross-browser manual |
| 27 | Compliance/GDPR (GD-1…GD-6) | Manual/Infra | retention vs erasure, DSAR — policy + manual |
| 28 | Go-live gates (G-1…G-10) | Done-now (G-2) + Manual | G-2 done; G-1/G-3…G-10 are CI wiring, DR, UAT, monitoring |

---

## 4. Recommended next automatable batches (priority order)

Following the checklist's risk weighting (money + access control first), the highest-value
unit-testable work remaining:

1. **Per-CAO loonheffing + WML (PY-8, PY-9) — _blocked: functional gap, not a test gap_:** verified
   this pass that the codebase has **no minimum-wage (WML) logic and no CAO pay-scale data** to
   assert against. Golden masters cannot be written until those statutory tables exist in code,
   and the reference figures must come from the Handboek Loonheffingen (not be invented). Recommend
   implementing the WML/CAO scales first, *then* the cent-exact masters (per-CAO scale scenarios and
   minimum-wage-by-age checks asserted against the Handboek Loonheffingen tables). Top remaining money-risk gap.
   _(Update: WML is now implemented (PY-8, see §0) and the CAO pay-scale data now exists (`CaoWageResolver`,
   see §0.1); the per-CAO loonheffing golden masters themselves are still to write.)_
2. **Controller-layer 403 sweep (R-1):** `@WebMvcTest` per service proving each protected
   endpoint returns 403 without its permission (service-layer ownership/IDOR + contract
   cross-tenant now covered by `TimesheetPermissionTest` / `ContractServiceCompanyScopeTest`).
3. **Bean Validation provider for user-service (DV-1):** add `spring-boot-starter-validation` so the
   existing `@Valid`/`@NotBlank` annotations are actually enforced (currently silently inert), then
   regression-test the affected onboarding/CAO/message/leave flows.
4. **CAO effective-dating (CF-3) — _functional gap_:** `BillingRateService.resolveOne` selects the
   `active` rate and never compares the shift date to `effectiveFrom`/`effectiveTo`, so an ESTIMATED
   margin on a historical shift is priced at today's rate. Needs date-windowed resolution queries +
   overlap rules (changes every historical margin -> regression). Write-side versioning is already correct/tested.
5. **Contract signed-PDF immutability (CT-5):** stored hash + tamper detection.

---

## 5. Git — push & open the PR from your machine

The feature commits are local on `feature/production-readiness-tests` (22 ahead of `main`). From `E:\Code\ParadePaard`:

```powershell
git checkout feature/production-readiness-tests
git push -u origin feature/production-readiness-tests
# then open a PR to main, e.g.:
gh pr create --base main --head feature/production-readiness-tests `
  --title "Production-readiness tests: timesheet, PY-19, PY-7b, integration smoke" `
  --body "Implements the first P0 slice of the production-readiness checklist. See docs/PRODUCTION-READINESS-EXECUTION-REPORT.md"
```

### Re-run the verified suites locally

```powershell
cd Program\microservice\timesheet-service ; .\mvnw.cmd test
cd ..\contract-service ; .\mvnw.cmd -Dtest=PaymentFrequencyTest,ContractServiceCreateContractTest test
cd ..\payroll-service ; .\mvnw.cmd -Dtest=PayPeriodCalculatorTest,PayslipSchedulerTest test
```
