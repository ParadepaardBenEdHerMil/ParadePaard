# Audit & Reconciliation — Finance Overview & Jaaropgaaf

**Purpose:** audit the already-built finance + jaaropgaaf code, then lock every decision and produce
the consolidated gap list, so implementation of the remaining work (Phase 2 revenue & margin + fixes)
can start cleanly.

**Method & caveat:** static code review of the **working tree** (includes uncommitted WIP — we agreed
to build on it). **No build/test was run** — this sandbox has Java 11 and the project needs JDK 21
(`jakarta.*`, Spring Boot 3). Anything below marked *(verify on build)* needs a real JDK-21 compile/test
pass before sign-off. Reviewed June 2026.

---

## Part 1 — What is already built (and looks correct)

**Jaaropgaaf / verzamelloonstaat (Part B) — effectively complete.**
`Jaaropgaaf` entity (companyId, userId, year, fiscalWage, loonheffing, totalNet, snapshotJson, pdfData,
finalizedAt, status), `JaaropgaafService`, `JaaropgaafRepository`, `JaaropgaafDTO`, `VerzamelloonstaatDTO`,
PDF via the FlyingSaucer payslip stack, and frontend `MyFinance*` pages.
- Sums an employee's finalized (RELEASED/APPROVED) payslips for the year; PROVISIONAL until the employer
  finalizes, then snapshotted + PDF stored + FINAL (locked); `finalizeYear` is idempotent (correction re-publish).
- Mandatory Belastingdienst fields present: year, employee name+address, BSN (masked unless permitted),
  fiscaal loon, ingehouden loonheffing, verrekende arbeidskorting, ingehouden bijdrage Zvw, werkgeversheffing
  Zvw, premies werknemersverzekeringen, loonheffingskorting (+ from-date), plus net/gross/hours/travel.
- BSN handling is sound: stored full-BSN PDF only returned to permitted viewers; otherwise re-rendered masked.

**Cost-side finance (Part A, cost half) — built.**
`PayrollFinanceService.overview/breakdown` + `FinanceController` at `/payroll/finance`, company-scoped from JWT,
RELEASED/APPROVED only, breakdown by EMPLOYEE / FUNCTION / MONTH.

**Tax engine — built and wired.**
`LoonheffingCalculator` + `DutchPayrollTaxRates` (2026, Handboek Bijlage 1) wired into `PayslipCalculator`:
period-capped loonheffing, arbeidskorting tiers, employee/employer Zvw, employer werknemersverzekeringen.

---

## Part 2 — Audit findings (prioritised)

### P1 — correctness / compliance
1. **Jaaropgaaf employer *address* is missing.** `renderJaaropgaafHtml` prints `employerStreet/postalCode/city`,
   but `buildFromPayslips` only sets `employerName`, and `CompanySettingsDTO` carries **no address** (only
   `companyId`, `name`, `payrollTaxTemplates`). The jaaropgaaf legally requires employer **name + address**.
   → Add address to the company settings source and populate it.
2. **Year attribution uses `weekBasedYear`, conflicting with the locked date model.** `JaaropgaafService`
   queries `...ByWeekBasedYear...` and its doc says *"year = ISO week-based year."* Per Decision 1 the
   jaaropgaaf and annual totals must key off **`fiscalYear`** (derived from `paymentDate`/genietingsmoment).
   A week-1 spanning Dec/Jan (or a week-53 year) mis-attributes wages between tax years.
   → Introduce `paymentDate` + `fiscalYear` on `Payslip` and switch the annual queries to `fiscalYear`.
3. **`DutchPayrollTaxRates.forYear(int)` returns 2026 for *every* year.** A 2024/2025 jaaropgaaf (or any
   historical recompute) is computed with 2026 rates. → Add per-year branches (Decision 4 = national + multi-year).

### P2 — accuracy / hygiene
4. **`totalEmployerCost` is understated.** `PayrollFinanceService` uses `gross + employerZvw + premiums` and
   **omits holiday allowance (8%), employer pension, and reserves**. This distorts "what are the costs" now and
   margin later. → Define employer cost to include holiday + employer pension (+ optional reserves) consistently
   with `payrollFinance.ts`.
5. **Employee Zvw inhouding excluded from `totalToBelastingdienst`.** `loonheffing + employerZvw + premiums`
   omits the employee Zvw withheld, which is also remitted. Confirm intended; likely a small understatement.
6. **Legacy field name `wageTaxWithheldTest`** still holds the loonheffing amount (used by both finance and
   jaaropgaaf). → Rename/clean.
7. **`fiscalWage` falls back to `totalGrossAmount`** when null (old payslips) — historical jaaropgaven may show
   gross instead of true fiscaal loon. → Backfill `fiscalWage`, or flag affected years.
8. **`loonheffingskortingFrom` is approximated** by the earliest payslip issue-date where korting applied, not
   the employee's actual election date. Acceptable; document it.

### Verification gap
9. **No build/test executed** (Java 11 vs JDK 21). Before implementation sign-off: run a JDK-21
   `./mvnw test` on payroll/planning/timesheet and `tsc --noEmit` on the frontend, and **cross-check the 2026
   figures in `DutchPayrollTaxRates` against the repo's `Project/Tax/handboek-loonheffingen-*.pdf`** (tax numbers
   must not be taken on trust).

---

## Part 3 — Decisions locked (the five)

1. **Date/period model — distinct fields, each used for its stated purpose:**
   `shiftDate`/`workDate` → planning, margin, accrual; `weekBasedYear`+`weekNumber` → payslip uniqueness only;
   `payPeriodStart`/`payPeriodEnd` → payslip display & payroll calc; `paymentDate`/genietingsmoment → loonheffing,
   loonaangifte, jaaropgaaf; `aangifteYear`+`aangiftePeriod` → Belastingdienst reconciliation; **`fiscalYear`** →
   jaaropgaaf + annual totals. *(Drives fixes P1-2.)*
2. **Date-effective project rates:** add `effectiveFrom`/`effectiveTo`/`active` to `ProjectFunctionBillingRate`
   (+ migration), matching client/employee rates — historical margin must survive rate changes.
3. **Finance records:** materialised/snapshotted with lock-after-payroll-approval (pragmatic path: compute-on-read
   for ESTIMATED first, persist on payslip release for ACTUAL+lock).
4. **`DutchPayrollTaxRates`:** keep statutory rates national, but multi-year from the start (add `forYear`
   branches); isolate sector/CAO-variable premiums so per-company override is a later additive change.
5. **Margin model:** ESTIMATED by default (rate %), flips to ACTUAL once a released/approved payslip covers the
   shift's pay period, then allocate the payslip's actual period employer costs across that period's shifts
   pro-rata by gross wage (hours fallback); tag each record; ACTUAL must reconcile to payslips/jaaropgaaf.

## Part 4 — Phase 2 plan's open decisions, resolved (with overrides)

The existing `docs/PHASE2-REVENUE-MARGIN-PLAN.md` listed 6 open decisions. Resolved here:

1. **company → timesheets:** **Option B** (`companyId` *and* `userId` on the timesheet, end-to-end). **Overrides**
   the plan's "Option A to start" — per Decision 1/locked company-scoping; payroll should enrich, not discover.
2. **FinanceSettings source:** start from the Horeca payroll rules + sane defaults; per-company settings entity later. *(accepted)*
3. **Granular premiums:** show the AWf/Aof/Whk/Wko/Zvw split for the **ESTIMATED** view (Horeca % data has them),
   but ACTUAL must equal the payslip's aggregate employer premies. *(accepted, with the estimated/actual split)*
4. **Per-shift wage basis:** contract gross hourly wage effective at `shiftDate` (contract gRPC). *(accepted)*
5. **Missing rate:** revenue = €0 and flag `missing_rate`. *(accepted)*
6. **Persistence:** **materialised with lock** (Decision 3) — **overrides** the plan's "compute-on-read only";
   compute-on-read is allowed only as the first ESTIMATED step before the `ShiftFinanceRecord` table lands.

## Part 5 — Consolidated gap list to implement (later, in order)

1. **Fixes first (small, unblock correctness):** employer address on jaaropgaaf (P1-1); `forYear` multi-year
   branches + cross-check vs Handboek (P1-3, #9); employer-cost composition + employee-Zvw in finance totals
   (P2-4/5); rename `wageTaxWithheldTest` (P2-6).
2. **Date model:** add `paymentDate` + `fiscalYear` to `Payslip`; switch jaaropgaaf + annual/period queries to
   `fiscalYear`; backfill (P1-2, P2-7).
3. **Phase 1 foundations for revenue:** `companyId`+`userId` on timesheet (entity/import/repo/proto/backfill);
   date-effective `ProjectFunctionBillingRate`.
4. **Phase 2 revenue/margin** (per PHASE2 plan Steps 1-4): timesheet company read, billing-rate resolve,
   payroll margin assembly (ESTIMATED→ACTUAL), payroll→planning client, finance margin endpoints, frontend
   revenue/margin UI (by client/project + drill-down + export).
5. **Persistence:** `ShiftFinanceRecord` table + lock-after-approval once ACTUAL allocation is in.
6. **Verification:** JDK-21 `./mvnw test` across services + `tsc --noEmit`; reconciliation tests
   (records == summary == breakdown; ACTUAL == payslips; jaaropgaaf == sum of periods).

---

*Next step per agreement: this is the "everything in place" artifact. Implementation begins after sign-off,
building on the current working tree, on a `feature/` branch with a push per implemented unit + PR.*
