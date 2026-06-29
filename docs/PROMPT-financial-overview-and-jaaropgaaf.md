# Implementation Prompt — Financial Overview + Dutch Jaaropgaaf

> This is a **specification / prompt** to drive implementation. It is split into two
> deliverables: **(A)** a real, drill-down financial overview, and **(B)** the Dutch
> year-end **jaaropgaaf** (annual employee statement) plus the supporting
> **verzamelloonstaat**. Read the whole thing before writing code.

---

## 0. Context you must know first (current state of the codebase)

ParadePaard is a multi-tenant (company-scoped) event-staffing & payroll platform.
Backend is Spring Boot microservices (gRPC between services, REST via api-gateway);
frontend is React + TypeScript (Vite). Money flows like this:

```
ClientCompany ──> Project ──> Shift (functionName, peopleNeeded, start/end, break)
                                 └─> ScheduleEntry (a user assigned to a shift)
                                        │ (on finalize) exports to ↓
                                        ▼
                                   Timesheet (hoursWorked, travelKm, travelRate, projectName, shiftDate, …)
                                        │ (payroll run) feeds ↓
                                        ▼
                                   Payslip (gross, deductions, net, loonheffing, holidayAllowance%, …)
```

### Revenue side (already modelled, planning-service)
- `ClientCompany`, `Project` (has `clientCompanyId`, `companyId`, dates, status, `finalized`).
- Billing-rate hierarchy with effective-dating, resolved most-specific-first:
  - `EmployeeProjectFunctionBillingRate` (most specific)
  - `EmployeeClientFunctionBillingRate`
  - `ProjectFunctionBillingRate`
  - `ClientFunctionBillingRate` (client default, least specific)
  - Exposed via `BillingRateController` (`/planning/billing-rates/...`) and `BillingRateDTO.scope`.
- `ratePerHour` is the price charged to the client per worked hour for a function.

### Cost side
- `Contract` (contract-service): `grossHourlyWage`, `holidayAllowancePercentage` (default 8.00),
  `travelAllowance`, `weeklyHours`, `contractType`, `paymentFrequency`.
- `Timesheet` (timesheet-service): `hoursWorked`, `travelExpenses`, `travelKilometers`,
  `travelRate`, `sourceProjectId/ShiftId/ScheduleEntryId`, `weekNumber`, `weekBasedYear`.
- `Payslip` (payroll-service): `totalGrossAmount`, `totalEmployeeDeductions`,
  `totalNetAmount`, `wageTaxWithheldTest`, `travelExpenses`, `holidayAllowancePercentage`,
  `deductionLinesJson` (lines typed by `PayrollTaxTemplateDTO`: code/category/calculationType
  `PERCENT_OF_GROSS`|fixed/configuredValue), `weekBasedYear`, `weekNumber`, `payPeriodStart/End`,
  full employee identity snapshot (name, address, dateOfBirth) — **but no BSN and no companyId**.
- Employer premiums + CAO variables exist in **two** places that must be reconciled: the frontend
  `frontend/src/data/horecaPayrollRules.ts` and the backend `DutchPayrollTaxRates` (2026, from the
  Handboek). See A4.
- `Project/Tax/handboek-loonheffingen-lh0221t61fd.pdf` — the official Belastingdienst
  payroll-tax handbook is in the repo. **Use it as the source of truth for calculations.**

### What already exists for "finance" (and why it's not enough)
- Page `frontend/src/pages/PayrollFinance.tsx`, routed at `/management/payroll-finance`.
- Calculation engine `frontend/src/utils/payrollFinance.ts` is **complete and good**:
  it already models `ShiftFinanceRecord`, employer premiums, `totalPayableToBelastingdienst`,
  `totalPayableToPensionFund`, `clientRevenue`, `marginBeforeOverhead`, `marginPercentage`,
  `marginStatus`, billing-rate resolution, and `calculateFinanceSummary`.
- **The problem:** it is fed `const financeRecords: ShiftFinanceRecord[] = []` — a hardcoded
  empty array. There is **no backend** producing finance records, no breakdowns, no filters,
  no drill-down, no persistence. The page always shows €0,00.

### Current backend state for tax/finance (verified — supersedes earlier drafts)
- **Real loonheffing already exists.** `LoonheffingCalculator` + year-aware
  `DutchPayrollTaxRates.forYear(int)` (2026, from Handboek Loonheffingen 2026, Bijlage 1) are
  wired into `PayslipCalculator`: period payroll tax, arbeidskorting tiers, employee/employer
  Zvw and employer insurance premiums, all capped at `annualMaxContributionWage`.
  **Do not rebuild this for Part B.**
- **`Payslip` already carries the jaaropgaaf data fields:** `bsn`, `companyId`, `fiscalWage`,
  `applyLoonheffingskorting`, `arbeidskortingApplied`, `employeeZvwWithheld`, `employerZvwLevy`,
  `employerInsurancePremiums` (plus gross/net/deductions). The per-employee annual figures can be
  **summed from these existing fields** — they do not need to be re-derived.
- **Still open:** the legacy field name `wageTaxWithheldTest` ("TODO test tax") holds the
  loonheffing amount and should be renamed/cleaned. `DutchPayrollTaxRates` is 2026-only and not
  company-scoped, and it duplicates the frontend `horecaPayrollRules.ts` — reconcile the two (A4).
- **`Timesheet` is not company-scoped:** the entity/proto carry no `companyId` and the proto
  response carries no `userId` — both block the finance read-model (see A2.1).

---

# PART A — Better financial overview

## A1. Goal
Give admins a single, company-scoped financial overview that answers, for any period:
**where did the money come from, on which projects, who worked, on what shift, and what did
it cost** — with totals at the top and full drill-down underneath.

It must answer these questions explicitly:
- **Income:** total client revenue, broken down by client, by project, by function, by period.
- **Work:** which employees worked, which shifts, how many hours, on which project/client.
- **Costs:** gross wages, holiday allowance, vacation reservation, employer premiums
  (AWf/Aof/Whk/Wko/Zvw), pension, travel, administration/overhead, and total loonheffing.
- **Result:** margin (revenue − total employer cost) in € and %, per shift / project / client /
  employee, plus margin health (healthy / low / negative / missing-rate).
- **Exceptions:** shifts missing a billing rate, negative-margin shifts, unbilled (UNPAID) revenue.

## A2. Backend — build a Finance read-model + endpoints
Create a finance aggregation capability. **Recommended:** a small `finance` module/service (or a
`finance` package inside payroll-service, since it already gRPC-talks to timesheet, contract and
user services) that assembles a **per-shift-per-employee finance record** by joining:

| Field source | From |
|---|---|
| hours worked, project, shift, date, travel km/rate | `Timesheet` (timesheet-service) |
| employee gross hourly wage, holiday %, travel allowance, contract type | `Contract` (contract-service) |
| gross / deductions / net / loonheffing / deduction lines | `Payslip` (payroll-service) |
| client billing rate (resolved most-specific-first) | `BillingRateController` (planning-service) |
| client + project names, `companyId`, finalized status | `Project` / `ClientCompany` (planning-service) |
| employer premium %, pension %, CAO variables | new backend config (see A4) |

### A2.1 Company scoping — timesheet is the scoped source (DECIDED: Option B)
Margin lives at shift grain, so scope the read-model on the **timesheet**, not on a user-service
"list employees" call — no such RPC exists (`user_service.proto` has only `RequestUserData(userId)`).
Add company scope to the timesheet **end to end** (a proto field alone is not enough — the DB/read
model must be queryable by it):
- add `companyId` to the `Timesheet` **entity** + DB migration;
- set `companyId` in the **import/finalize flow** (`ImportPlannedTimesheets`) from the project's company;
- add a **repository query** by `companyId` + date range (+ filters);
- add `companyId` **and** `userId` to the `Timesheet` **proto message/response** (today it has neither);
- **backfill / re-import** existing rows: derive `companyId`/`userId` from the source project /
  schedule entry, or re-run the planning→timesheet export for past periods.

With this, payroll calls user/contract services only to **enrich** records (name, BSN, wage),
never to **discover** which employees exist.

### A2.2 Date-effective billing rates (MIGRATION DECISION REQUIRED)
Resolution must be **as-of `shiftDate`**, not "current active". State today:
- `ClientFunctionBillingRate` and the employee overrides **already have** `effectiveFrom` /
  `effectiveTo` / `active` — switch their finders from `...ActiveTrue` to
  `effectiveFrom <= shiftDate AND (effectiveTo IS NULL OR shiftDate < effectiveTo)`.
- `ProjectFunctionBillingRate` has **none of those** (only `copiedAt`). Choose explicitly:
  - **(Recommended) add `effectiveFrom` / `effectiveTo` / `active`** to project rates + migration —
    required if historical margin must stay correct after a rate change; **or**
  - treat project rates as point-in-time snapshots valid **from `copiedAt` onward**, and document
    that margin before a re-copy is not reconstructable.

### A2.3 Cost model — estimated vs actual (EXACT SWITCH RULE)
Produce both, and make the authoritative overview reconcile to payroll:
- **ESTIMATED** (default): per-shift employer cost from rate percentages — fast, for live
  planning/quoting. This will **not** tie out to payslips because real payroll caps premiums at
  `annualMaxContributionWage` and computes tax on a period/cumulative basis.
- **ACTUAL**: a shift flips to `ACTUAL` **once a released/approved payslip exists for that employee
  covering the shift's pay period (week/period)**. Then allocate that payslip's **actual** period
  employer costs (`employerZvwLevy`, `employerInsurancePremiums`, loonheffing, holiday/pension)
  across the period's shifts **pro-rata by gross wage, with hours as fallback**.
- Tag every record `ESTIMATED` / `ACTUAL`; ACTUAL totals must reconcile to the payslips (and
  therefore to the jaaropgaaf and loonaangifte). Backend `DutchPayrollTaxRates` / payslip values
  are the source of truth; `payrollFinance.ts` is the UI **estimate** only.

Endpoints (all **company-scoped** via the caller's JWT, behind a finance-view permission):

```
GET /finance/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
      → FinanceSummary (the 10 KPI cards) for the period

GET /finance/records?from&to&clientId?&projectId?&employeeId?&functionName?&marginStatus?&page&size
      → paged ShiftFinanceRecord rows (the drill-down table)

GET /finance/breakdown?dimension=CLIENT|PROJECT|EMPLOYEE|FUNCTION|MONTH&from&to&filters…
      → grouped rows: revenue, cost, margin, margin%, hours, shiftCount per group

GET /finance/export?format=CSV|XLSX&from&to&filters…
      → flat export of records for accounting
```

Add the supporting query: aggregate payslips/timesheets by `companyId` + date range
(today `PayslipRepository` only queries per user — add company- and period-scoped queries).

## A3. Frontend — turn the stub into a real overview
In `PayrollFinance.tsx` (and new child components):
- Replace the empty `financeRecords` with data fetched from `/finance/*`.
- **Top:** the existing KPI summary grid, now live.
- **Filters:** date range (default current year / current month toggle), client, project,
  employee, function, margin status, invoice status (PAID/UNPAID).
- **Breakdown tabs:** *By client*, *By project*, *By employee*, *By function*, *By month* —
  each a sortable table of revenue / cost / margin / margin% / hours / #shifts, with a
  totals row and a simple bar or stacked chart.
- **Drill-down table:** every shift-employee record (date, client, project, shift, employee,
  function, hours, wage, gross, employer cost, billing rate, revenue, margin, margin%, status,
  warnings). Row click → detail.
- **Exceptions panel:** missing-rate shifts and negative-margin shifts as actionable lists.
- **Export** button → CSV/XLSX.
- Keep the existing notice that billing rates & margin are internal and not employee-visible;
  gate the whole page behind the finance permission.

## A4. Unify the rates config (partly already done)
A backend year-aware source already exists: `DutchPayrollTaxRates.forYear(int)` (2026 only today,
from the Handboek), and it duplicates the frontend `horecaPayrollRules.ts`. Work:
- add further `forYear` branches as tax years change (today any non-2026 year silently falls back to 2026);
- decide whether rates must be **company-scoped** (multi-sector / multi-CAO) or stay national;
- make `DutchPayrollTaxRates` the single source of truth and have the frontend read it (keep the
  `HorecaPayrollRules` page as editor/inspector) so finance, payslips and jaaropgaaf never diverge.

## A5. Acceptance criteria (Part A)
- With real finalized projects + timesheets + payslips, the overview shows non-zero,
  reconcilable totals (sum of breakdown == summary == sum of records).
- Changing the date range / filters updates every panel consistently.
- A shift with no resolvable billing rate appears in "missing rate" and contributes €0 revenue
  (never a fake margin).
- CSV/XLSX export opens cleanly in Excel with nl-NL number formatting.
- All numbers are company-scoped; a user from company X never sees company Y data.

---

# PART B — Dutch jaaropgaaf (year-end employee statement)

## B1. Get the Dutch concepts right (important — avoid the common mix-up)
The user described "een jaaropgave die je aan de Belastingdienst geeft." In Dutch law these are
**three different things** — implement them as such:

1. **Jaaropgaaf / jaaropgave (per employee).** A legally required annual statement the **employer
   gives to each employee** (not directly to the Belastingdienst). The employee uses it for their
   **aangifte inkomstenbelasting**. It is **vormvrij** (free format) — your own/software-generated
   layout is allowed, including a cumulative final payslip as long as it's clearly marked as the
   official jaaropgaaf. Must be supplied **within a reasonable term after the calendar year
   (in practice Jan–Feb)**, also to employees who left mid-year, and **kept ≥ 7 years**. May be
   digital. *This is the primary deliverable.*

2. **Verzamelloonstaat (company-wide).** The annual roll-up of all employees' loonstaten — the
   document an accountant / the Belastingdienst actually works from. Build this as the
   company-level companion report. *Secondary deliverable.*

3. **Loonaangifte (periodic).** What the employer actually files **to** the Belastingdienst
   (monthly / 4-weekly), which sums to the year. *Out of scope for this prompt, but note it: the
   jaaropgaaf figures must reconcile with the sum of the periodic loonaangiften.*

> Spell this distinction out in the PR description so reviewers don't expect a "submit to
> Belastingdienst" button — there isn't one for the jaaropgaaf.

## B2. Mandatory fields on the jaaropgaaf (Belastingdienst model)
The statement **must** contain at least:

1. The **calendar year**.
2. **Name + address of the employer** (the ParadePaard tenant company).
3. **Name + address of the employee**.
4. The employee's **BSN** (burgerservicenummer).
5. **Fiscaal loon** (loon voor de loonheffing) — total fiscal wage over the year, before
   withholding of loonbelasting/premie volksverzekeringen.
6. **Total ingehouden loonbelasting / premie volksverzekeringen** (the loonheffing withheld).
7. **Total verrekende arbeidskorting** (labour tax credit settled in payroll).
8. **Ingehouden bijdrage Zvw** (employee Zvw contribution, where applicable).
9. **Werkgeversheffing Zvw** (employer Zvw levy).
10. **Total premies werknemersverzekeringen** (employee-insurance premiums).
11. Whether **loonheffingskorting** was applied (and from which date).

Optional but recommended (allowed): worked hours, holiday allowance paid/reserved, employer
pension, travel reimbursements. Base everything on the employee's **loonstaat** (rubrieken 1–4).

## B3. Gap analysis vs. current data (most of the hard part is already done)
Re-verified against the code — the earlier "these fields don't exist" assessment was stale:
- **Tax calculation exists — do not rebuild it.** Real period payroll tax and employer
  contribution calculation now lives in `LoonheffingCalculator` + `DutchPayrollTaxRates`, wired
  into `PayslipCalculator`. Part B must **consume** these figures, not recompute them. (This avoids
  overclaiming that *every* annual-statement requirement is done — the calc is done; the
  aggregation, statement, persistence and UI below are not.)
- **The jaaropgaaf data fields already exist on `Payslip`:** `bsn`, `companyId`, `fiscalWage`,
  `applyLoonheffingskorting`, `arbeidskortingApplied`, `employeeZvwWithheld`, `employerZvwLevy`,
  `employerInsurancePremiums`. The annual figures are the **sum of these per-period values** — sum
  the periods, never recompute annual tax from annual totals, so it stays equal to the loonaangifte.
- **Real remaining work:** rename the legacy `wageTaxWithheldTest` field to a proper loonheffing
  name (cleanup); confirm the employer name/address source for the employer block (tenant company
  record); respect the **ID-visibility permission** (`TODO/TODO.txt`) when rendering BSN; and decide
  the **year-attribution rule** (ISO `weekBasedYear` vs pay-period end date) and apply it
  consistently to the annual sum.

## B4. Implementation outline
**Data / backend (payroll-service or a `loonheffing` module):**
1. No new payslip tax columns needed — `bsn`, `companyId`, `fiscalWage`, `arbeidskortingApplied`,
   `employeeZvwWithheld`, `employerZvwLevy`, `employerInsurancePremiums`, `applyLoonheffingskorting`
   already exist. Just ensure they are populated for all in-scope payslips (backfill old rows).
2. Reuse the existing `LoonheffingCalculator` / `DutchPayrollTaxRates` (already covers white/green
   table, loonheffingskorting, arbeidskorting, Zvw employee + werkgeversheffing, werknemers-
   verzekeringen, and the zero-hours rule via `PayrollZeroHourRuleTest`). Do **not** duplicate it.
3. `JaaropgaafService.build(companyId, employeeId, year)` = sum of that employee's finalized
   payslips for the `weekBasedYear` (decide & document the year-attribution rule: ISO
   week-year vs. pay-period end date — be consistent with payroll).
4. Endpoints (company-scoped, permission-gated):
   ```
   GET  /payroll/jaaropgaaf/{employeeId}/{year}            → JaaropgaafDTO (all B2 fields)
   GET  /payroll/jaaropgaaf/{employeeId}/{year}/pdf        → official PDF
   POST /payroll/jaaropgaaf/{year}/generate                → batch-generate for all employees
   GET  /payroll/jaaropgaaf/me/{year}/pdf                  → employee self-download
   GET  /finance/verzamelloonstaat/{year}?format=PDF|XLSX  → company-wide roll-up
   ```
5. PDF generation: reuse the existing payslip PDF stack (`FlyingSaucerPayslipPdfService` /
   `PayslipToHtml`) to render a jaaropgaaf HTML template → PDF. Persist generated PDFs
   (like `PayslipDocument`) and **retain ≥ 7 years**.

**Frontend:**
- **Admin:** under Management/Payroll, a "Jaaropgaven" view per year: generate-all, status per
  employee, download/preview, plus the company **verzamelloonstaat** export.
- **Employee:** in `Payslips` / `Account`, a "Jaaropgaaf {year}" download once released
  (reuse the payslip `availableToUserAt` release pattern).
- Dutch labels throughout (Jaaropgaaf, Fiscaal loon, Loonheffing, Arbeidskorting,
  Bijdrage Zvw, Werkgeversheffing Zvw, Premies werknemersverzekeringen, Loonheffingskorting).

## B5. Acceptance criteria (Part B)
- For a test employee with a full year of finalized payslips, the jaaropgaaf shows all B2 fields,
  and **fiscaal loon / loonheffing / arbeidskorting / Zvw / werknemersverzekeringen equal the sum
  of the periodic payslips** (reconciles with what would be filed via loonaangifte).
- Mid-year leaver gets a correct partial-year jaaropgaaf.
- BSN only renders for users with ID-visibility permission; jaaropgaaf is strictly company-scoped.
- PDF is vormvrij-compliant, clearly labelled "Jaaropgaaf {year}", and persisted for retention.
- Verzamelloonstaat totals == sum of all employees' jaaropgaven for the year.

---

## Suggested phasing
1. **Foundations:** add `companyId` + `userId` to the timesheet (entity / import / repo / proto /
   backfill, A2.1); make billing resolution date-effective (A2.2); reconcile `DutchPayrollTaxRates`
   with the frontend rates (A4). *(unblocks both parts)*
2. **Part A backend** finance read-model + endpoints; ESTIMATED path first, then ACTUAL allocation
   from payslips (A2.3).
3. **Part A frontend** real overview with filters, breakdowns, drill-down, export.
4. **Part B** jaaropgaaf: `JaaropgaafService` summing existing payslip fields + PDF generation +
   verzamelloonstaat + admin/employee UI + 7-year retention. (Loonheffing calc is already done.)

## Engineering notes
- This is a large implementation → use a `feature/` branch (no `claude/` prefix).
- Push after each implemented function; open a PR for the feature branch.
- Add unit tests mirroring the existing payroll tests (calculator parity, company-scope,
  zero-hour rule, jaaropgaaf reconciliation). Verify totals reconcile end-to-end before merge.
- Keep money in `BigDecimal` server-side, `HALF_UP`, scale 2; format nl-NL on the client.
- Treat billing rates & margin as internal-only (never employee-visible); BSN behind permission.

## Open questions to confirm before coding
- Year attribution: ISO week-year (`weekBasedYear`) vs. pay-period end date — which is canonical?
  (Affects both the finance period filters and the jaaropgaaf annual sum.)
- Date-effective project rates: add `effectiveFrom`/`effectiveTo`/`active` (historical margin), or
  accept `copiedAt`-onward snapshots? (See A2.2.)
- Sector/year scope: should `DutchPayrollTaxRates` become company-scoped and multi-year now, or stay
  national 2026 with `forYear` branches added later? (See A4.)
- ~~Build vs ingest loonheffing~~ — **resolved:** computed in-house and already exists; reuse it.
