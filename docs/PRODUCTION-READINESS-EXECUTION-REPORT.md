# ParadePaard — Production-Readiness Plan: Execution Report

> Companion to `PRODUCTION-READINESS-TESTING-CHECKLIST.md`.
> Branch: `feature/production-readiness-tests` (11 commits, **not yet pushed** — see Git section).
> Toolchain used: Temurin **JDK 21** (services require 21), Maven wrapper per service.
> Date executed: 2026-06-29.

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

Timesheet-service went from **1 → 4 test files (1 → 21 tests)** — the single biggest coverage
gap in the repo is now closed.

### Production code changed (3 safe fixes, per "tests + safe prod fixes")

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
| 13 | Finance/jaaropgaaf (F-1…F-9) | Existing + Gap | `PayrollFinanceServiceTest`, `JaaropgaafServiceTest` exist; add reconcile-to-cent ties (F-5) |
| 14 | Contracts (CT-1…CT-10) | Existing + Done-now | 17 contract tests incl. workflow/sign/PDF; PY-19 added; add signed-PDF immutability hash (CT-5) |
| 15 | Leave (LV-1…LV-6) | Gap | balance/approval/payroll-impact tests |
| 16 | CAO/Horeca/rates (CF-1…CF-6) | Gap | effective-dating (CF-3) + cost-vs-revenue rate (CF-4) — money-critical |
| 17 | Travel claims (TC-1…TC-3) | Gap | tax-free km limit + own-vs-all |
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

1. **Per-CAO loonheffing + WML (PY-8, PY-9):** extend the cent-exact golden masters (started in
   `PayslipCalculatorGoldenMasterTest`) with per-CAO scale scenarios and minimum-wage-by-age
   checks asserted against the Handboek Loonheffingen tables. Top remaining money-risk gap.
2. **Controller-layer 403 sweep (R-1):** `@WebMvcTest` per service proving each protected
   endpoint returns 403 without its permission (service-layer ownership/IDOR + contract
   cross-tenant now covered by `TimesheetPermissionTest` / `ContractServiceCompanyScopeTest`).
3. **Bean Validation provider for user-service (DV-1):** add `spring-boot-starter-validation` so the
   existing `@Valid`/`@NotBlank` annotations are actually enforced (currently silently inert), then
   regression-test the affected onboarding/CAO/message/leave flows.
4. **CAO effective-dating & rate side (CF-3, CF-4):** wrong-date or swapped cost/revenue rate.
5. **Contract signed-PDF immutability (CT-5):** stored hash + tamper detection.

---

## 5. Git — push & open the PR from your machine

The four commits are local on `feature/production-readiness-tests`. From `E:\Code\ParadePaard`:

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
