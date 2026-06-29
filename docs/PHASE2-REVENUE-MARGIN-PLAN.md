# Phase 2 — Revenue & Margin: implementation plan (for review)

Goal: show, per shift, `margin = revenue − cost`, rolled up by client / project / employee /
function / month, where `revenue = worked hours × resolved billing rate`. Phase 1 (already shipped)
covers the **cost** side only, at the payslip (employee × period) grain. Phase 2 adds **revenue and
margin**, which only exist at the **shift** grain — so the whole feature works off **timesheets**,
not payslips.

This plan is grounded in the current code (signatures verified June 2026). Nothing below is built
yet; it is for your review before any code is written.

## Why timesheets, not payslips
- `Payslip` has the cost components (`totalGrossAmount`, `wageTaxWithheldTest`, `employerZvwLevy`,
  `employerInsurancePremiums`, pension lines, `companyId`) but **no project/client/shift** — it is
  per employee per period. Phase 1's `PayrollFinanceService` aggregates those.
- `Timesheet` (timesheet-service) already carries the shift dimensions we need:
  `sourceProjectId`, `sourceShiftId`, `sourceScheduleEntryId`, `function`, `hoursWorked`,
  `travelExpenses`, `projectName`, `shiftName`, `shiftDate`, `userId`. **It has no `companyId`.**

## Canonical formulas (already in `frontend/src/utils/payrollFinance.ts` — mirror these)
The frontend already defines the exact model and math; Phase 2 feeds it real data and moves the
calc server-side. Key reference functions to mirror in Java:
- `resolveBillingRate(...)` — precedence: employee-shift → override → custom-shift → job-preset
  default → client default → `null` (missing). The backend equivalent is the 4-tier DB resolution
  (see Step 2).
- `calculateShiftFinanceRecord(...)` — per shift:
  - `grossWage = round2(workedHours × hourlyWage)`
  - employer oncosts as % of gross: AWf low, Aof low, Whk (sector 33 Horeca), Wko, employer Zvw;
    optional employer pension, holiday allowance, vacation reservation, sickness/insurance reserves,
    admin cost/hour (all gated by `FinanceSettings`).
  - `totalEmployerCost = gross + holiday + vacation + employerContribTotal + employerPension + otherEmployerCosts`
  - `clientRevenue = rate == null ? 0 : round2(workedHours × rate)`
  - `marginBeforeOverhead = rate == null ? 0 : clientRevenue − totalEmployerCost`
  - `marginPercentage = clientRevenue > 0 ? margin/clientRevenue × 100 : 0`
- `getMarginStatus(...)` → `missing_rate` | `negative_margin` | `low_margin` | `healthy`.
- `calculateFinanceSummary(...)` — sums + `missingBillingRateCount`, `negativeMarginCount`,
  `averageMarginPercentage`.
The backend should produce records/summaries shaped like `ShiftFinanceRecord` / `FinanceSummary`
so the existing types are reused with minimal churn.

---

## Step 1 — timesheet-service: company + date-range read gRPC
New RPC returning worked timesheets for a company over a date range, including the source IDs/names.

- **Proto** (`timesheet_service.proto`): add
  ```
  rpc RequestCompanyTimesheets (CompanyTimesheetsRequest) returns (CompanyTimesheetsResponse);
  message CompanyTimesheetsRequest { string companyId = 1; string fromDate = 2; string toDate = 3; }
  message CompanyTimesheetsResponse { repeated Timesheet timesheets = 1; }   // reuse existing Timesheet
  ```
- **companyId gap** — `Timesheet` has no company. Two options:
  - **(A, recommended) Pass user IDs**: request carries `repeated string userId` + range; payroll
    already resolves a company's employees when it builds payslips, so it supplies the list. No
    schema/migration in timesheet-service. Repo: `findByUserIdInAndDateOfIssueBetween(...)`.
  - **(B) Add `companyId` to the read-model**: populate at `ImportPlannedTimesheets` via a
    user→company lookup; query `findByCompanyIdAndDateOfIssueBetween`. Cleaner queries but needs a
    column + backfill (older rows lack it — same caveat that bit `payslip.companyId`).
- **Service impl**: `TimesheetServiceGrpcService` maps `Timesheet` → proto (mapper already exists
  for the per-week path; extend it).
- **Files**: `proto`, `grpc/TimesheetServiceGrpcService.java`, `repository/TimesheetRepository.java`,
  a mapper. **Verify**: `cd /tmp/b/timesheet-service && ./mvnw test-compile`.

## Step 2 — planning-service: per-shift billing-rate resolve
Add resolution (today `BillingRateService` only lists/saves/deletes). Reuse the four
`findFirst…` repo methods, most-specific-first:
1. `EmployeeProjectFunctionBillingRate.findFirstByCompanyIdAndProjectIdAndUserIdAndFunctionNameIgnoreCaseAndActiveTrue`
2. `EmployeeClientFunctionBillingRate.findFirstByCompanyIdAndClientCompanyIdAndUserIdAndFunctionNameIgnoreCaseAndActiveTrue`
3. `ProjectFunctionBillingRate.findFirstByCompanyIdAndProjectIdAndFunctionNameIgnoreCase`
4. `ClientFunctionBillingRate.findFirstByCompanyIdAndClientCompanyIdAndFunctionNameIgnoreCaseAndActiveTrue`
- `clientCompanyId` is derived from `projectId` via `Project.clientCompanyId`; project/client names
  come along for labels.
- **Service**: `BillingRateService.resolveRate(companyId, projectId, userId, function, date)` →
  `{ ratePerHour, source, clientCompanyId, clientName, projectName }` or missing. Add a **batch**
  variant `resolveRates(companyId, List<ResolveItem>)` to avoid N round-trips.
- **Endpoint**: `POST /planning/billing-rates/resolve` (body: companyId implied by auth + list of
  `{ projectId, userId, function, date }`) → list of resolved rows. (REST is simplest; a gRPC
  variant is possible if we prefer payroll→planning over gRPC like the other clients.)
- **Files**: `service/BillingRateService.java`, `controller/BillingRateController.java`, request/response
  DTOs, `service/BillingRateServiceTest.java` (extend — the resolution order is the key test).
  **Verify**: `./mvnw test -Dtest=BillingRateServiceTest`.

## Step 3 — payroll-service: per-shift finance assembly (the core)
Payroll assembles because it already owns the cost/tax engine (`DutchPayrollTaxRates`,
`LoonheffingCalculator`) and the timesheet + contract gRPC clients.
- **Inputs per shift**: timesheet (Step 1) → userId, projectId, function, hours, date, names;
  resolved rate (Step 2, batched); employee hourly wage + pension applicability + tax (from the
  contract gRPC / the period payslip).
- **Compute** mirroring `calculateShiftFinanceRecord` using `DutchPayrollTaxRates` percentages:
  `gross = hours × wage`; employer Zvw + premies (+ optional pension/holiday) → `totalEmployerCost`;
  `revenue = hours × rate` (missing rate → 0 + `missing_rate` flag); `margin = revenue − cost`;
  `marginStatus` via thresholds.
- **New gRPC client** in payroll → planning resolve (or REST call) — mirror existing
  `TimesheetServiceGrpcClient` / `ContractServiceGrpcClient` style.
- **API**: extend `FinanceController` (`/payroll/finance`):
  - `GET /payroll/finance/margin/overview?from&to` → revenue, cost, margin, margin %, missing-rate
    and negative-margin counts (a `FinanceSummary`-shaped DTO).
  - `GET /payroll/finance/margin/breakdown?from&to&dimension=CLIENT|PROJECT|EMPLOYEE|FUNCTION|MONTH`.
  - `GET /payroll/finance/margin/shifts?from&to[&...filters]` → per-shift drill-down rows.
  - `GET /payroll/finance/margin/export?from&to&format=csv|xlsx`.
- **New DTOs**: `ShiftFinanceRowDTO` (shaped like `ShiftFinanceRecord`), `MarginOverviewDTO`,
  `MarginBreakdownRowDTO`.
- **Persistence decision**: compute-on-read first (simplest, matches Phase 1). A `ShiftFinanceRecord`
  table is only needed later for rate overrides + lock-after-payroll (the frontend types anticipate
  this); defer unless you want overrides now.
- **Files**: `service/PayrollMarginService.java`, extend `controller/FinanceController.java`, DTOs,
  `grpc/PlanningServiceGrpcClient.java` (or REST client), `service/PayrollMarginServiceTest.java`.
  **Verify**: `./mvnw test` (add a unit test asserting a known shift's revenue/cost/margin against the
  frontend formula).

## Step 4 — frontend: revenue & margin UI
Wire `/management/payroll-finance` to the new endpoints (Phase 1 left it cost-only with a "later
phase" notice).
- Reuse `payrollFinance.ts` types (`ShiftFinanceRecord`, `FinanceSummary`, `MarginStatus`).
- Add revenue/margin KPIs, **By-client** / **By-project** tabs (alongside existing employee/function/
  month), a per-shift drill-down table with `marginStatus` chips + warnings, and CSV/XLSX export.
- `services/user-service/PayrollFinanceApi.ts`: add `getMarginOverview/Breakdown/Shifts/export`.
- Remove the "revenue & margin coming later" notice once live.
- **Verify**: `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`.

---

## Open decisions (need your call)
1. **company→timesheets**: Option A (pass userIds, no migration) vs B (`companyId` on timesheet).
   Recommend A to start.
2. **FinanceSettings source**: the frontend model has overhead/sickness/insurance/admin/rounding +
   include-toggles. Pull these from the Horeca payroll rules we already have, or introduce a per-company
   finance-settings entity? Recommend: start from Horeca rules + sane defaults; settings entity later.
3. **Granular premiums**: frontend splits employer cost into AWf/Aof/Whk/Wko/Zvw; backend
   `DutchPayrollTaxRates` currently aggregates premies (~11.28%). Mirror the split (more faithful) or
   report aggregate employer-premies + Zvw (simpler)? Recommend split, since the Horeca rule data has
   the individual percentages.
4. **Per-shift wage**: take the employee's contract gross hourly wage at the shift date (contract gRPC)
   — confirm that's the intended basis vs the payslip's effective wage.
5. **Missing rate**: revenue = €0 and flag `missing_rate` (matches frontend). Confirm.
6. **Persistence**: compute-on-read now; defer the `ShiftFinanceRecord` table (needed only for rate
   overrides + lock-after-payroll). Confirm.

## Suggested build order & verification
Build in the order above; each step compiles/tests independently. Per the recovered handoff, the
sandbox builds in `/tmp` (the mount can't delete protoc temp files) with Temurin JDK 21, frontend via
`tsc --noEmit`. I can implement + verify each step here; **you commit/push each step** (git's `.git`
does not sync back from the sandbox — only working-tree files do). Recommended commits:
`feature/payroll-revenue-margin`, one commit per step, PR at the end (or per your push-after-each pref).

## Risk notes
- Older timesheets/payslips created before this work won't carry every field (same backfill caveat as
  `payslip.companyId`); margin for historical shifts may be partial until re-imported/recalculated.
- Rate resolution depends on `Project.clientCompanyId` being set; shifts on projects without a client
  or without any matching rate tier surface as `missing_rate` (by design).
- gRPC proto changes require a rebuild of both sides (stubs auto-regenerate).
