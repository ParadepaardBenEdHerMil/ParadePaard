# Payroll & Finance — session handoff

Read this first in a new Cowork session to continue the payroll/finance work. It captures the
current (recovered + verified) state, the real environment root-cause that corrupted the tree,
the verify loop that now works, and the remaining Phase 2 plan.

## STATUS (2026-06-24): working tree recovered and verified

A prior session's edits had been silently **truncated on disk** (see root cause below). That
corruption has been repaired and the build verified end-to-end:

- **Backend** (Temurin JDK 21): `contract-service`, `payroll-service`, `planning-service`,
  `user-service` all compile (`./mvnw test-compile`). Unit tests pass: `PayslipCalculatorTest`
  4/4, `BillingRateServiceTest` 4/4.
- **Frontend**: `tsc --noEmit -p tsconfig.app.json` is clean (0 errors). The full `vite` bundle
  was not run in-sandbox only because `node_modules` holds the Windows rollup native binary, not
  Linux (platform mismatch, not a code issue) — it builds locally.

### Action items still needed on the Windows host
1. **Delete `.git/index.lock`** — a stale lock from the prior session's crash. All git writes
   (commit/checkout) are blocked until it is removed.
2. **Delete stray junk files** (the sandbox mount cannot unlink, so they remain):
   `.git/index.lock2`, `.git/_writetest_2`,
   `Program/microservice/_bash_sync_probe.txt`, `Program/microservice/_rwtest.txt`,
   `Program/microservice/contract-service/src/main/proto/_sentinel_check.txt`,
   `Program/microservice/payroll-service/src/main/java/com/pm/payrollservice/service/_bigtest.txt`,
   and the pre-existing `_tmp_probe_dir`, `a_probe`, `git` (0-byte).
3. Healed files were rewritten with **LF** line endings; `autocrlf` normalizes them on commit.
   Review `git diff` before committing — the recovery touched many files.

## Root cause of the corruption (important — supersedes old "trust the Read tool" advice)

The bash mount has two hard limits, discovered this session:
- **It cannot delete/unlink files** ("Operation not permitted"). This is why protoc's
  `target/protoc-dependencies` cleanup fails in-tree, and why the stale `.git/index.lock`
  can't be cleared here.
- **Writes are dropped for a file whose harness-cached content has diverged from disk.** The
  file tools (Write/Edit) report success and update the cache, but **nothing reaches disk**. The
  Read tool then serves the cached (complete) content, masking the truncated on-disk file. That
  is exactly how the prior session corrupted ~77 files without noticing.

### What IS reliable here
- `bash` reads/writes to disk are accurate (verified by round-trip + git `hash-object`).
- `git show HEAD:<path>` returns correct committed content.
- Overwrite via bash (`git show HEAD:f > f`, or `cat > f <<'EOF'`) persists; **append/overwrite,
  never rely on Write/Edit for a file the harness already cached differently.**
- After a bash overwrite, the harness reconciles its cache to disk on the next Read.

### How the tree was healed (method, for reference)
- Truncated files that equalled HEAD (pure committed code) → `git show HEAD:f > f`.
- Files with genuine uncommitted edits → recovered the complete intended content from the harness
  Read cache and written to disk via bash heredoc (e.g. `PayrollFinance.tsx`, `Management.tsx`,
  `App.tsx`, `Navbar.tsx` link, `permissionPolicy.ts` finance exports, `PayslipRepository`'s
  `findByCompanyIdAndDateOfIssueBetween` query). Intact files were left untouched.

## How to compile / run / verify (works now)

- The sandbox has Java 11 by default; install Temurin **JDK 21** (network egress required):
  `curl -sSL -o /tmp/jdk21.tar.gz "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse?project=jdk" && mkdir -p /tmp/jdk21 && tar -xzf /tmp/jdk21.tar.gz -C /tmp/jdk21 --strip-components=1`
  then `export JAVA_HOME=/tmp/jdk21 PATH=/tmp/jdk21/bin:$PATH`.
- **Build OUTSIDE the mount.** protoc's plugin must delete temp files, which the mount forbids,
  so copy each service to `/tmp` first: `rsync -a --exclude=target <svc> /tmp/b/` then
  `cd /tmp/b/<svc> && ./mvnw -B test-compile` (and `-Dtest=<Test>` to run a unit test).
  `planning-service` has no `mvnw`; copy one from another service (`contract-service/mvnw` + `.mvn`).
- Frontend type-check runs in-place (no emit, no delete): `cd Program/frontend &&
  node_modules/.bin/tsc --noEmit -p tsconfig.app.json`. Do **not** `npm install` into the mount —
  it would overwrite the Windows-native `node_modules` and break local dev.
- Maven downloads its wrapper + deps on first run (each `./mvnw` step can exceed the 45s shell
  cap); run with `nohup ... > log 2>&1 &` and poll the log.

## What's already built (this work stream)

All in `Program/` (Spring Boot microservices + React/Vite frontend), now verified:

1. **Dutch loonheffing tax engine** (`payroll-service`): `DutchPayrollTaxRates`, `LoonheffingCalculator`,
   `PayslipCalculator` (2026 brackets, heffingskortingen, employee/employer Zvw, employer premies,
   AOW check). Verified against the repo table anchors and `PayslipCalculatorTest` (4/4).
2. **Contract-driven deductions** — tax terms on `Contract` (contract-service), resolved from the
   Horeca rule version, flow over gRPC, drive the payslip. (Committed in HEAD.)
3. **Jaaropgaaf + verzamelloonstaat** + finalize/lock (`payroll-service`) — `JaaropgaafService`,
   `Jaaropgaaf` entity/snapshot, PDFs via FlyingSaucer, endpoints under `/payroll/jaaropgaaf/...`,
   BSN masked unless caller has `CAN_VIEW_EMPLOYEE_IDENTIFICATION`.
4. **Employee "My finance" page** (`/my-finance`) — tabbed: Overview, Payslips, Work history,
   Contract, Documents. `pages/MyFinance*.tsx`.
5. **Employer Finance hub** (`/management/finance`) — permission-gated tiles; dashboard collapses
   the payroll tiles into one "Finance" card (`FINANCE_NAV_LABELS` / `FINANCE_HUB_PERMISSIONS`).
6. **Payroll-cost finance overview (Phase 1)** — `/management/payroll-finance`: `PayrollFinanceService`
   + `FinanceController` aggregate company payslips by date range (gross, net, loonheffing, employer
   Zvw, premies, pension, to-Belastingdienst, employer cost, hours) + breakdown by
   employee/function/month. `pages/PayrollFinance.tsx` with KPIs, date filter, breakdown toggle.

## Git state

- Branch `main`, HEAD `da1a05f`. All payroll/finance work above the committed baseline is
  **uncommitted working-tree changes** (now healed: 27 backend + 50 frontend modified, 21 new
  untracked files). Nothing has been committed this session — git writes are blocked by the stale
  `.git/index.lock` (remove it on Windows first).
- User preference: large work on a `feature/` branch (NOT `claude/`), push after functions, open a PR.

## Phase 2 — revenue & margin (NOT yet built)

Goal: `margin = revenue − cost` per shift, broken down by client/project/employee/function/month.
revenue = `worked hours × resolved billing rate` (rate depends on client + project + function),
which today's interfaces don't expose to payroll. Recommended (payroll assembles, since it owns the
cost/tax engine + timesheet & contract gRPC clients):

1. **timesheet-service**: new gRPC returning worked timesheets for a company + date range incl.
   `sourceProjectId / sourceShiftId / sourceScheduleEntryId`, userId, functionName, hours, travel.
2. **planning-service**: a billing-rate **resolve** endpoint (company + projectId/clientId/employeeId/
   function/date → resolved rate + names), reusing most-specific-first `BillingRateService`.
3. **payroll-service**: per-shift finance assembly — revenue = hours × rate; cost = gross + employer
   Zvw + premies (+ pension); margin = revenue − cost; missing rate → €0 + flagged. Extend
   `/payroll/finance` with revenue/margin + By-client/By-project breakdowns + drill-down + CSV/XLSX.
   (`frontend/src/utils/payrollFinance.ts` already has the per-shift formulas to mirror.)
4. **frontend**: revenue/margin KPIs, By-client / By-project tabs, drill-down, export, on
   `/management/payroll-finance`.

Build each step so it compiles independently; verify per the loop above between steps.

## Known data caveats

- Finance/jaaropgaaf company-scoping relies on `payslip.companyId` (added mid-stream) — only payslips
  created after that change carry it; older ones won't be included.
- The `Company` entity has no address fields, so the jaaropgaaf employer block shows name only.
- Employer-premies aggregate (11.28%) assumes low AWf/Aof + Whk sector 33 Horeca; adjust in
  `DutchPayrollTaxRates` if needed.
- Historical payslips won't have the new tax components until recalculated (re-saved).
