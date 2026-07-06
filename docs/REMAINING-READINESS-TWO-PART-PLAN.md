# Remaining production-readiness work — two non-disrupting parts

**Goal:** finish the open items on `PRODUCTION-READINESS-TODO.md` after the Stream A/B merge. The
in-repo engineering is largely done and green; what's left is **secrets, deployment enablement, and
validation** — mostly ops against a running stack, plus one history rewrite. Priority order (agreed):
**B1 → B7/S5 → V2/V3/V4/V5/S7.**

The work splits into **Part 1 (deployment hardening & secrets)** and **Part 2 (application
validation & first-admin)**. They own disjoint files AND disjoint runtime resources so they don't
disrupt each other. Read "Shared context" first.

---

## Shared context (both parts read this first)

- **Branch:** `feature/ops-readiness-config` (PR #22, draft), merged + green + pushed. Work in your
  own worktree; commit/push your own files.
- **Two operations are STOP-THE-WORLD — never run them concurrently with other work:**
  1. **B1 git-history purge** (BFG / git-filter-repo) rewrites every commit SHA and force-pushes.
     Run it **only as a coordinated finale**: both parts fully committed + pushed, then purge, then
     everyone re-clones/hard-resets. Anything uncommitted/unpushed at that moment can be lost. Until
     then, do the *non-rewriting* B1 work (generate fresh secrets, wire env, write the runbook).
  2. **C6 package rename** (~2k `com.pm` references across every service) — a separate mechanical
     change that conflicts with any concurrent edit. **Out of scope here; do it alone, later.**
- **Shared running stack = a mutable resource.** The default compose stack (project `microservice`,
  gateway `:4004`, DBs `:5000-5005`, kafka `:9092/9094`, TLS `:80/:443`) is single-instance. To run
  both parts at once without restart/port/volume collisions:
  - **Part 2 uses the existing default dev stack** (plain HTTP) for exercising flows.
  - **Part 1 brings up its own prod/TLS stack under a different compose project name and remapped
    host ports** (e.g. `docker compose -p pp-prod -f docker-compose.yml -f docker-compose.prod-ports.yml --profile tls up`).
    Part 1's `down -v` / restarts / restore-drills then never touch Part 2's stack.
- **Disjoint files.** Part 1 = infra/deploy/secrets/runbooks. Part 2 = validation scripts/docs. If a
  validation pass (Part 2) uncovers a **code** bug, file it and coordinate a small targeted fix in
  the owning service rather than both editing source.
- **Real target/staging environment is a prerequisite** for the "for-real" versions of B1
  (prod-secret provisioning), B7 (create the actual admin), S5 (real certs), S7 (restore against the
  prod DB), and V5 (prod dry-run). If no such environment exists yet, that gap blocks those and must
  be raised — local compose can only *rehearse* them.

---

## PART 1 — Deployment hardening & secrets  (B1, S5, S7, V5)

**Owns (only these):** `docker-compose*.yml` and any prod/override compose files, `.env` /
`.env.example`, `deploy/**` (nginx, `postgres-backup`, `OPERATIONS.md`), `api-gateway`
`application-prod.yml` + cookie/security config, `README.md` (secret/bootstrap docs), and new
runbooks under `docs/` (e.g. `docs/runbooks/B1-secret-rotation.md`). **Owns the prod/TLS stack
instance** (separate compose project + remapped ports).

1. **B1 — rotate secrets + purge history.** Two phases:
   - *Now (non-disruptive):* generate brand-new values for every in-repo-controlled secret
     (`JWT_SECRET`, `PASSWORD_RESET_HMAC_SECRET`, the six `*_SERVICE_DB_PASSWORD`s); confirm nothing
     reads a hardcoded secret (all from env); write `docs/runbooks/B1-secret-rotation.md` covering
     generation, the SES-SMTP + prod-DB rotation steps, and the purge procedure. **Note:** rotating
     SES SMTP creds and provisioning the prod secret store need AWS/infra access a coding agent may
     not have — deliver the runbook + repo-controlled secrets; a human executes the external
     rotations.
   - *Finale (coordinated, stop-the-world):* after BOTH parts are committed + pushed, purge the old
     secret values from git history (BFG/git-filter-repo), force-push, and have everyone re-sync.
   - **Done when:** no secret values anywhere in repo *or history*; all services boot from env; old
     secrets rotated.
2. **S5 — enable real TLS.** Supply real certs, activate the `tls` profile / prod TLS termination,
   confirm HTTP→HTTPS redirect + HSTS, and verify refresh/session cookies are `Secure` in prod.
   (Config already exists behind the profile; this is activation + real certs.)
3. **S7 — perform + document a real restore drill.** Run backup → wipe → restore against a
   throwaway instance of the prod/TLS stack; capture evidence in `OPERATIONS.md`. Scripts exist but
   no drill has been done.
4. **V5 — prod-profile deploy dry-run.** Start the full stack on the `prod` profile behind TLS,
   confirm every service passes its health probe (S6), and verify no secrets or DEBUG appear in
   logs. This is Part 1's capstone (depends on S5 + B5 + rotated B1 secrets).

---

## PART 2 — Application validation & first-admin  (B7, V2, V3-finish, V4)

**Owns (only these):** `docs/validation/**` (E2E checklist + V2/V3/V4 findings), black-box probe
scripts (scratchpad + committed under `docs/validation/` or a `validation/` dir), and any small
black-box test scripts. **Uses the default dev stack** (HTTP) for exercising flows. Does **not** edit
deploy/secret files.

1. **B7 — execute + validate the first-admin bootstrap.** The runner + onboarding already have unit
   tests (so this is *not* a "write tests" task — the gap is execution/validation). Set
   `BOOTSTRAP_ADMIN_USERNAME/EMAIL/PASSWORD`, boot, and confirm: exactly one `SUPER_ADMIN` created,
   `mustChangePassword=true` enforced on first login, idempotent on restart, and no-op when unset.
   The *real* prod admin creation happens against the target env after B1 rotation — coordinate that
   as a joint step; validate the flow now on dev.
2. **V2 — manual end-to-end pass** of every core flow (onboarding, login, RBAC, planning, payroll,
   contracts, payslips, leave, messaging, admin/company/employee setup). Deliver an executable
   checklist in `docs/validation/V2-e2e-checklist.md`; automate what's scriptable, clearly flag the
   steps that need a human.
3. **V3 finish — live-probe contracts + payslips cross-tenant.** Extend the leave/S1 probe: drive
   the contract→timesheet→payroll lifecycle to generate real data in two companies, then attempt
   cross-tenant reads of contracts and payslips (should be denied). This closes the "static only"
   gap for those modules.
4. **V4 — auth-abuse black-box pass.** Confirm end-to-end: repeated failed logins get
   throttled/locked (B8), a disabled user can no longer refresh (B2), and logout/disable/
   password-reset immediately kill outstanding tokens (B3, incl. the fixed logout cookie clearing).

---

## Non-collision guarantees & coordination points

- **Files:** Part 1 = infra/deploy/secrets/README/runbooks; Part 2 = validation docs/scripts. No
  shared source files.
- **Runtime:** Part 2 keeps the default dev stack; Part 1 runs its prod/TLS stack under a separate
  project name + remapped ports. Part 1's teardowns/restores never hit Part 2's stack.
- **Git history purge (B1) is the coordinated finale** — do it after both parts are committed +
  pushed, never during active work.
- **Sequencing dependency:** B1 secret rotation should land before the *for-real* B7 admin creation
  and V4/V5 in the target env. Part 2 validates the flows on dev now; the production executions of
  B7 + V5 are gated on B1 + a real target env — the one genuine hand-off between the parts.
- **Code bugs found during validation:** Part 2 files them; a targeted fix is coordinated with the
  owning service (not both editing source).

## Out of scope (defer, do alone)
- **C6** package rename (`com.pm` → real domain, ~2k refs) — stop-the-world mechanical change.
- **B1's external-credential rotation** (SES, prod DB provisioning) needs infra/human access.
- **V2 manual steps** are inherently human.
