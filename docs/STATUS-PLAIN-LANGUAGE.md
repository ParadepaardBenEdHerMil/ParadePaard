# ParadePaard — Where We Are, In Plain Words

_Last updated: 2026-07-01. Branch: `feature/production-readiness-tests` (pushed, ~53 commits ahead of main)._

This is the simple version. No jargon. Two lists: **what's finished** and **what's left**.
Everything in the "finished" list has been built AND test-run on Java 21 — it passes.

---

## ✅ WHAT'S ALREADY DONE (built + tested + passing)

### Money & pay (the most important stuff)
- **Pay is calculated correctly to the exact cent** — hours × rate, plus night/weekend extras, checked against official reference numbers, not just against itself.
- **Tax (loonheffing) and social premiums** are worked out using the Dutch tax tables.
- **Net pay = gross minus deductions** — the number that actually lands in the bank is correct.
- **Travel money is added to take-home pay but NOT taxed as wage** (as the law wants). Travel paid above the tax-free rate now gets split into a taxable part.
- **Minimum wage (WML) is enforced** — nobody can be paid below the legal Dutch minimum. The 2024 and 2025 rate tables are loaded.
- **Pay periods are correct for every cycle** — weekly, every-two-weeks, monthly, daily — including tricky cases like year-end and leap-year February.
- **The scheduled payroll run can't pay someone twice** — if it runs again by accident, nothing double-happens.
- **The dangerous "pay every 5/10 minutes" test setting is blocked in production** — it can only exist in development.
- **Zero-hours-but-has-travel** and **blank birth date** cases are handled.
- **Yearly income statement (jaaropgaaf) adds up exactly** to the sum of that year's payslips, and never mixes two companies together.
- **Profit/margin uses the right rates** — the client's rate for income, the employee's rate for cost. They can't get swapped.

### Who's allowed to do what (security & access)
- **Every single web endpoint is now locked down on the server** — not just hidden in the screen. If you're not logged in you get "unauthorized"; if you lack the permission you get "forbidden." This was checked for **every controller in all 7 services**.
- **You can't read another person's or another company's data by guessing IDs** — payslips, timesheets, contracts, leave requests are all blocked across users and across companies.
- **Company data is walled off** — Company A can never see Company B's people, pay, or contracts.

### People & onboarding
- **BSN (Dutch social number) is validated** with the official 11-check, and **IBAN (bank account) is validated** with its checksum — bad numbers are rejected before they can reach payroll.
- **Form validation is actually switched on** in the user service (it was silently doing nothing before).

### Contracts
- **A signed contract can't be secretly changed** — its fingerprint (hash) is stored and checked, so tampering is detectable.
- Contract creation, signing, PDF generation and the minimum-wage check all work and are tested.

### Leave (verlof)
- **A decided leave request can't be flipped again** — you can only approve/reject one that's still "pending."
- **Leave decisions are company-scoped** — a manager can't act on another company's request.

### Timesheets (this used to be the weakest, most-untested area)
- Went from **almost no tests to a full set**: hours calculation, rounding, validation, "only see your own," and duplicate-import protection all covered.

### Housekeeping
- The dead placeholder integration test was replaced with a real end-to-end simulation.
- Everything above was **run on Java 21 and passes** (user 157 tests, planning 83, timesheet 38, plus payroll, contract and auth all green).

---

## 🔧 WHAT STILL NEEDS TO BE DONE

### A) Tests still to write (the code mostly exists — it just isn't proven yet)
- **Per-industry pay scales (CAO):** we now enforce minimum wage, but the detailed CAO pay-scale tables and their exact-cent tests still need to be added.
- **Timesheet approvals & history:** manager edit/approve/reject with audit trail, the work-history screen accuracy, saved view preferences, and proving hours match across planning → timesheet → payroll.
- **Finance corrections:** proving a corrected or cancelled payslip still reconciles for any date range.
- **Planning edge cases:** overnight shifts, daylight-saving days, double-booking the same person, and locking a project once it's finalized.
- **Client & location management:** create/edit/delete with proper checks, and what happens when you delete something still in use.
- **Job application form:** more spam/abuse protection tests (partly done).
- **Audit log:** proving it can't be tampered with.
- **Error handling:** clean error messages that never leak internal stack traces.
- **Service-to-service messaging (gRPC/Kafka):** contract tests so services keep agreeing with each other.
- **Notifications:** proving no sensitive personal data leaks into messages.

### B) Features still to build (functionality is genuinely missing, not just untested)
- **Leave balances & accrual:** right now leave is just create/read/update/delete. It does NOT yet track how many days you have, subtract them, block clashing shifts, or feed pay. This needs building.
- **4-weekly (vierwekelijks) pay cycle:** a common Dutch cycle that isn't in the system yet — needs a yes/no decision, then building if wanted.
- **CAO pay-scale data in code:** needed before the CAO tests above can exist.

### C) Manual / infrastructure work (people and servers, not code tests)
- **Clean startup:** prove the whole system boots from scratch with `docker compose up`.
- **Secrets:** make sure no passwords/keys are hard-coded; use real rotated secrets in production.
- **Database safety:** turn off auto-schema-changes in production; use proper versioned migrations.
- **Health checks & logging:** each service reports healthy/unhealthy; every request is traceable end-to-end.
- **Time zone / daylight saving:** confirm all date math uses Amsterdam time.
- **Backups:** actually do a backup-and-restore drill for all databases.
- **Security audit:** penetration test, vulnerability scan, TLS/encryption check.
- **Performance:** load and soak testing on production-like hardware.
- **Accessibility & browsers:** check the screens work for everyone, on all major browsers.
- **GDPR:** data-retention vs "delete my data" rules, and handling data requests.
- **Go-live setup:** automated build pipeline (CI), disaster recovery, user acceptance testing, monitoring dashboards.
- **Browser click-through tests:** there's currently no automated "pretend to be a user clicking through the site" test layer — this needs to be created.

---

## One thing blocking me right now
There's a stuck lock file in the repo (`.git\index.lock`) held by a program on your machine, so I can't save (commit) these updates to git. Close your editor/Git tool, or delete that file, and I'll commit and push.
