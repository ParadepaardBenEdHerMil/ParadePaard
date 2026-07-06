# ParadePaard — DigitalOcean deployment checklist

Target: one Droplet running the `docker compose` stack + one Managed PostgreSQL, in **Amsterdam
(AMS3)**. Approach: stand up **staging with fake data** first, rehearse everything, then do the
secret rotation + go live for the first client (**The Dutch**, ~2,500 users).

Legend: **[you]** = decision/credential/infra access only you have · **[dev]** = code/config work ·
**[ops]** = run against the servers. Rough cost: **~€75–150/month**.

---

## First deployment = internet-facing showcase (decided 2026-07-06)

Goal: put the **current** product online so partners can click around instead of a local instance.
**Fake/throwaway data only — not the real 2,500 users, not final.** So the first deployment is
**Phases 0–3 only**; Phases 4–6 (B1 history purge, real secrets, real data, backups, HA) wait for the
real production launch later.

Locked decisions:
- **Domain:** `lambdamanager.com` (placeholder — easy to change later: new DNS record + fresh cert +
  a few env vars `FRONTEND_ORIGIN`, gateway CORS origin, `PASSWORD_RESET_FRONTEND_URL`,
  `CONTRACT_EMAIL_CONTRACT_URL`; no rebuild, cookies aren't domain-pinned).
- **Staging first:** yes.
- **First admin:** `Bevanrhee@gmail.com` + a simple password — goes in the Droplet `.env` only, never
  committed; forced password change on first login.
- **Email (SES):** stay in the **sandbox** for the demo; just **verify the demo recipient addresses**
  (your Gmail, a test address or two) so onboarding/reset emails work to them. Production access is a
  later step (likely approvable; Brevo/Resend/Postmark are drop-in SMTP fallbacks — env change only).
- **Secrets:** generate fresh secrets for this box (good hygiene), but **skip the git-history purge**
  (that's a real-prod step).
- **Skip for the demo:** backup/restore drill, data migration, HA standby node.
- **Size for demo:** Droplet **8 GB** (~$48 — the 7 services need the RAM regardless of data) +
  Managed PostgreSQL **1 GB** (~$15). ≈ **$60/mo**; DO bills hourly, so resize/destroy between demos.

---

## Phase 0 — Decisions & inputs (gather before starting)
- [ ] **[you]** Domain name to use (e.g. `app.paradepaard.nl`).
- [ ] **[you]** Confirm: staging-first (recommended) vs straight to production.
- [ ] **[you]** First admin identity (username + email; you set the password later, never committed).
- [ ] **[you]** SES: is it the prod mailer? Is the sender domain verified and **out of the SES
      sandbox**? (Approval has lead time — start this now.)
- [ ] **[you]** The Dutch's 2,500 users — fresh onboarding or **migrated from an existing system**?
      If migrated, scope a data-import task separately.
- [ ] **[you]** Budget sign-off (~€75–150/mo).

## Phase 1 — Provision DigitalOcean (safe, reversible)
- [ ] **[ops]** Create DO account/project; region **AMS3** for everything.
- [ ] **[ops]** Create a **VPC** (private network).
- [ ] **[ops]** Create the **Droplet**: Ubuntu LTS, **8 GB/4 vCPU** to start (resizable), on the VPC;
      add your **SSH key**; install Docker + Docker Compose.
- [ ] **[ops]** Create **Managed PostgreSQL 16**: 1 node, **2 GB**, on the same VPC.
- [ ] **[ops]** In the DB, create the 6 databases: `auth, user, contract, payroll, timesheet,
      planning`; note the **private** host + credentials.
- [ ] **[ops]** Create a **Spaces** bucket (object storage) for off-site backups.
- [ ] **[ops]** Assign a **Reserved IP** to the Droplet.
- [ ] **[ops]** **Cloud Firewall**: allow 80/443 from anywhere, SSH (22) from your IP only; restrict
      the DB to the Droplet/VPC.
- [ ] **[ops]** Turn on **Monitoring** + alerts (CPU/memory/disk) and an uptime check on the gateway
      health endpoint.

## Phase 2 — Prod config (code side)
- [ ] **[dev]** Write `docker-compose.prod.yml`: remove the 6 Postgres containers, point every
      service's `SPRING_DATASOURCE_URL` at the one Managed cluster (per-service DB name,
      `?sslmode=require`), keep Kafka as a container.
- [ ] **[dev]** Cap DB connections: `spring.datasource.hikari.maximum-pool-size` ≈ 5 per service
      (6×5 = 30 fits a 2 GB DB).
- [ ] **[dev]** Tune JVM heaps (e.g. `-Xmx384m` per service) so the stack fits the Droplet.
- [ ] **[dev]** Prod env flags: `SPRING_PROFILES_ACTIVE=prod` (gateway), `GATEWAY_REQUIRE_HTTPS=true`,
      `GATEWAY_HSTS_ENABLED=true`, `INTERNAL_SERVICE_TOKEN` set, INFO log levels, `FRONTEND_ORIGIN`
      set to the real domain.
- [ ] **[dev]** Confirm PR #22 work is merged to the intended deploy branch.

## Phase 3 — Staging dry-run (fake data — this is V5)
- [ ] **[ops]** Clone repo on the Droplet; create `.env` with **temporary** staging secrets.
- [ ] **[ops]** `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`.
- [ ] **[ops]** Verify Flyway migrations applied on the Managed DB and every service is **healthy**
      (S6 probes).
- [ ] **[ops]** Point DNS at the Reserved IP; get a **Let's Encrypt** cert via nginx; confirm
      HTTP→HTTPS redirect + HSTS and that cookies are `Secure` (S5).
- [ ] **[ops]** Bootstrap a **test admin** (set `BOOTSTRAP_ADMIN_*`, boot, confirm one SUPER_ADMIN +
      forced password change, then unset) — rehearses B7.
- [ ] **[ops]** Run a smoke pass: register a company, log in, view planning, submit a travel claim.
- [ ] **[ops]** Configure the **backup script → Spaces** on a schedule (S7).
- [ ] **[ops]** **Do a restore drill**: back up → wipe a throwaway DB → restore → confirm services
      healthy and representative data readable through the API.
- [ ] **[ops]** Check logs: **no secrets, no DEBUG** in output.

## Phase 4 — Pre-production (do after staging is clean)
- [ ] **[you/dev]** **B1 secrets:** generate brand-new prod values (JWT, HMAC, DB passwords);
      **[you]** rotate SES SMTP creds + provision the prod secret store; **never commit any value**.
- [ ] **[dev]** **B1 cleanup:** redact old secret/admin values from current docs (e.g.
      `PRODUCTION-READINESS-REVIEW-2026-07-02.md`); run a secret scan.
- [ ] **[you/ops]** **B1 history purge (stop-the-world):** everyone commits + pushes, then
      BFG/git-filter-repo removes old secrets from history, force-push, everyone re-clones.
- [ ] **[ops]** Put the **real prod secrets** into the Droplet `.env` (root-only permissions).

## Phase 5 — Go live (The Dutch)
- [ ] **[ops]** Deploy prod with rotated secrets; verify healthy + TLS + clean logs.
- [ ] **[ops/you]** Create the **real first admin** (B7): set `BOOTSTRAP_ADMIN_*`, boot, log in,
      change password, unset the env.
- [ ] **[you]** Onboard / import The Dutch's data (fresh onboarding or the migration task from Phase 0).
- [ ] **[ops]** Confirm first successful automated backup landed in Spaces.

## Phase 6 — After launch (ongoing)
- [ ] **[ops]** Confirm alerts fire (test one).
- [ ] **[ops]** Schedule a periodic restore test (quarterly).
- [ ] **[you]** Decide if/when to add the DB **standby node** (HA, ~+€60/mo) — e.g. around
      payroll-critical windows.
- [ ] **[dev]** **Bulk employee import (final product, not the demo):** documented CSV/spreadsheet
      import (names, hours, etc.) to onboard a client's whole workforce at once — needed for real
      launch (e.g. The Dutch's 2,500), so it can't be manual entry.
- [ ] **[dev]** Backlog: move file blobs (ID docs, payslips) from the DB to Spaces as data grows;
      C6 package rename (optional).

---

**Longest-pole items to start early:** SES production access (AWS approval lead time) and the B1
history purge (needs a coordinated window). Everything in Phases 1–3 can begin now.
