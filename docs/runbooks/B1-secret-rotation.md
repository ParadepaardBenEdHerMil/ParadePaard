# Runbook — B1: rotate secrets & purge them from git history

Two independent jobs, both required:

1. **Rotate** — every secret that has ever been in the repo is compromised; generate brand-new
   values and install them only into the environment (never commit them).
2. **Purge** — remove the old values from the current tree *and* git history so they can't leak
   again.

> **Rotation ≠ purge.** Purging history without rotating leaves working (compromised) secrets;
> rotating without purging leaves the old ones discoverable in history. Do both.

Not needed for the throwaway **showcase** deployment — do this before any real/production data.

---

## 1. Inventory (what to rotate)

| Secret | Env var | How to generate / rotate |
|---|---|---|
| JWT signing key (shared by auth + gateway) | `JWT_SECRET` | `openssl rand -base64 48` (base64, decodes to 48 B ≥ HS256's 32 B min) |
| Password-reset HMAC key | `PASSWORD_RESET_HMAC_SECRET` | `openssl rand -base64 32` |
| Internal service token | `INTERNAL_SERVICE_TOKEN` | `openssl rand -hex 32` |
| Postgres password(s) | `MANAGED_DB_PASSWORD` (prod) | Reset in the DigitalOcean DB console (DO generates it); the old per-service `*_SERVICE_DB_PASSWORD` values become unused |
| SES SMTP credentials | `SES_SMTP_USERNAME` / `SES_SMTP_PASSWORD` | AWS IAM → create **new** SES SMTP credentials, install, then delete the old IAM user/credential |

First-admin password (`BOOTSTRAP_ADMIN_PASSWORD`) isn't a stored secret — it's set once at bootstrap
and changed on first login.

## 2. Generate + install (never commit)
```sh
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 32   # PASSWORD_RESET_HMAC_SECRET
openssl rand -hex 32      # INTERNAL_SERVICE_TOKEN
```
Put the values **only** in the Droplet's `.env` (root-only: `chmod 600 .env`) or a secret manager.
Update `.env.example` with **placeholder names only**, no values. Rotate the DB password in the DO
console and the SES creds in AWS IAM, and paste those in too.

## 3. Redact the current tree (before touching history)
Old values are still written into committed docs — remove them there too:
- `docs/PRODUCTION-READINESS-REVIEW-2026-07-02.md` mentions the old JWT prefix (`cc028f2d…`), the
  Postgres password (`password`), and the old admin `super.admin` / `sanne.admin` / `ParadeAdmin123!`.
- Replace each with a placeholder like `<redacted>`.
- Scan for anything missed:
  ```sh
  git grep -nE 'ParadeAdmin|cc028f2d|BEGIN (RSA|EC) PRIVATE KEY|AKIA[0-9A-Z]{16}'
  ```
  (Consider a dedicated scanner: `gitleaks detect` or `trufflehog`.)
Commit the redactions.

## 4. Purge history (STOP-THE-WORLD — coordinate first)
This rewrites every commit SHA and force-pushes. Do it only when: everyone has pushed their work,
the team is told to stop and will re-clone afterwards, and branch protection on `main` /
`feature/*` is temporarily lifted.

Preferred tool — **git-filter-repo**:
```sh
pip install git-filter-repo

# List the exact OLD secret strings to scrub, one per line:
cat > replace.txt <<'EOF'
literal:ParadeAdmin123!==>***REMOVED***
literal:cc028f2d<...the full old JWT secret...>8741ad==>***REMOVED***
literal:<old SES SMTP password>==>***REMOVED***
EOF
# (Avoid over-broad entries like the word "password" — target the real values only.)

git clone --mirror git@github.com:moodhood/ParadePaard.git pp-mirror
cd pp-mirror
git filter-repo --replace-text ../replace.txt
git push --force
```

Alternative — **BFG**:
```sh
bfg --replace-text replace.txt pp-mirror.git
cd pp-mirror.git && git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```

## 5. Verify
```sh
git log -S 'ParadeAdmin123!' --all      # -> no results
git log -S '<old JWT value>'  --all     # -> no results
git grep -nE 'ParadeAdmin|cc028f2d'     # -> no results in the tree
```
Then: everyone deletes their local clone and re-clones. Any existing fork/old clone still has the old
values — which is exactly why step 1 (rotation) is what actually protects you.

## 6. Restart with the new secrets
Redeploy so services pick up the new `.env`.
- Rotating `JWT_SECRET` invalidates every existing access/refresh token — all users are logged out
  once. That's expected; they just log in again.
- Confirm the stack is healthy and login works with the rotated secrets.

**Done when:** no secret values exist in the repo or its history, every service boots from the
rotated env values, and the old SES/DB credentials have been deleted at the source.
