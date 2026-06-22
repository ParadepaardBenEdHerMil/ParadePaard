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
- Employer premiums + CAO variables already exist **frontend-only** in
  `frontend/src/data/horecaPayrollRules.ts` (AWf, Aof, Whk sector 33, Wko, employer Zvw,
  pension employee/employer, holiday allowance %, vacation build-up).
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

### Known gaps to fix along the way
- `Payslip.wageTaxWithheldTest` is an explicit **placeholder** ("TODO test tax"); real
  *loonheffing* (loonbelasting + premie volksverzekeringen) is **not** computed.
- `Payslip` has **no `bsn`** and **no `companyId`** — both are required for jaaropgaaf and
  company-scoped finance. (Company scope is currently inferred via user-service gRPC;
  see `PayrollServiceCompanyScopeTest`.)
- Employer premium rates and CAO variables live only in the frontend; the backend cannot
  currently reproduce employer cost or the jaaropgaaf totals authoritatively.

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

Reuse the **exact formulas** already in `payrollFinance.ts` so backend and frontend agree
(port them to Java, or expose them and keep the frontend as a thin renderer — porting to the
backend is preferred so totals are authoritative and exportable).

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

## A4. Move premium/CAO config to the backend
Promote `horecaPayrollRules.ts` employer premiums + CAO variables to a backend, company- and
year-effective configuration (so 2025 vs 2026 rates differ correctly and finance/jaaropgaaf
compute from one source). Seed from the current frontend values; expose read API; keep the
frontend `HorecaPayrollRules` page as the editor.

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

## B3. Gap analysis vs. current data (what blocks a correct jaaropgaaf today)
- **No BSN on payslip/employee snapshot** → add `bsn` (sourced from user-service identity; respect
  the existing ID-visibility permission noted in `TODO/TODO.txt`).
- **No `companyId` on `Payslip`** → add it so jaaropgaaf is reliably company-scoped and the
  employer block (name/address) can be filled.
- **`wageTaxWithheldTest` is a placeholder** → you need a real loonheffing figure plus its split,
  and the separate components above (arbeidskorting, employee Zvw, werkgeversheffing Zvw,
  premies werknemersverzekeringen). These do not exist yet. Compute them per period from the
  **Handboek Loonheffingen** (`Project/Tax/…pdf`) and the year-effective config from A4, and
  store them on the payslip / a per-period loon-line so the annual sum is exact (do **not**
  recompute annual tax from annual totals — sum the periods, matching the loonaangifte).
- **Fiscaal loon ≠ gross wage** in general (e.g. pension deduction lowers it, some allowances
  raise it). Define `fiscalWage` explicitly on each payslip rather than reusing
  `totalGrossAmount`.

## B4. Implementation outline
**Data / backend (payroll-service or a `loonheffing` module):**
1. Migrations: add `bsn`, `companyId`, `fiscalWage`, and the loonheffing component columns to
   `Payslip` (or a new `PayslipTaxBreakdown` child); backfill where possible.
2. Per-period loonheffing calculation from the Handboek + year config (white/green table,
   loonheffingskorting on/off, arbeidskorting, Zvw employee + werkgeversheffing, werknemers-
   verzekeringen). Cover the existing zero-hours rule (`PayrollZeroHourRuleTest`).
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
1. **Foundations:** add `companyId`/`bsn`/`fiscalWage` + tax-breakdown columns; move premium/CAO
   config to backend (A4). *(unblocks both parts)*
2. **Part A backend** finance read-model + endpoints; reconcile against `payrollFinance.ts`.
3. **Part A frontend** real overview with filters, breakdowns, drill-down, export.
4. **Real loonheffing** calculation (B3) replacing `wageTaxWithheldTest`.
5. **Part B** jaaropgaaf + verzamelloonstaat generation, PDFs, admin + employee UI, retention.

## Engineering notes
- This is a large implementation → use a `feature/` branch (no `claude/` prefix).
- Push after each implemented function; open a PR for the feature branch.
- Add unit tests mirroring the existing payroll tests (calculator parity, company-scope,
  zero-hour rule, jaaropgaaf reconciliation). Verify totals reconcile end-to-end before merge.
- Keep money in `BigDecimal` server-side, `HALF_UP`, scale 2; format nl-NL on the client.
- Treat billing rates & margin as internal-only (never employee-visible); BSN behind permission.

## Open questions to confirm before coding
- Year attribution: ISO week-year (`weekBasedYear`) vs. pay-period end date — which is canonical?
- Is loonheffing computed in-house from the Handboek, or imported from an external payroll
  provider's output? (Affects whether B3 step 2 is build-vs-ingest.)
- Sector scope: Horeca only for now, or must premium/CAO config be multi-sector from day one?
