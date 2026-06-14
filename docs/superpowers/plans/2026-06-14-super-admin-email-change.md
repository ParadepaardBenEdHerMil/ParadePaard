# Super Admin Email Change Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the seeded and running super administrator email to `pardepaardtestemail1@gmail.com` without changing the account identity, credentials, company, roles, permissions, or profile.

**Architecture:** The auth-service seed remains authoritative for login identity, while the user-service seed holds the matching profile identity. Tests assert the new value and reject the old value before both PostgreSQL rows are updated by their shared fixed UUID.

**Tech Stack:** Java 21, JUnit 5, AssertJ, TypeScript, Vitest, PostgreSQL, Docker Compose, Git.

---

### Task 1: Add Seed Regression Assertions

**Files:**
- Modify: `Program/microservice/auth-service/src/test/java/com/pm/authservice/AuthSeedPermissionsTest.java`
- Modify: `Program/frontend/src/utils/seedDataCleanSlate.test.ts`

- [ ] **Step 1: Change auth seed assertions**

Replace the old email assertion with:

```java
assertThat(sql).contains("pardepaardtestemail1@gmail.com");
assertThat(sql).doesNotContain("super.admin@example.com");
```

- [ ] **Step 2: Change frontend clean-slate assertions**

For both auth-service and user-service seed checks, assert:

```typescript
expect(sql).toContain("pardepaardtestemail1@gmail.com");
expect(sql).not.toContain("super.admin@example.com");
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```powershell
.\mvnw.cmd -Dtest=AuthSeedPermissionsTest test
```

Working directory: `Program/microservice/auth-service`

Run:

```powershell
npm test -- --run src/utils/seedDataCleanSlate.test.ts
```

Working directory: `Program/frontend`

Expected: both suites fail because the seed files still contain `super.admin@example.com`.

### Task 2: Update Authoritative Seed Data

**Files:**
- Modify: `Program/microservice/auth-service/src/main/resources/data.sql`
- Modify: `Program/microservice/user-service/src/main/resources/data.sql`

- [ ] **Step 1: Update auth-service seed**

For user ID `8f3e44c2-0fb6-4f12-9d5b-8c1a0c72b001`, replace:

```sql
'super.admin@example.com',
```

with:

```sql
'pardepaardtestemail1@gmail.com',
```

- [ ] **Step 2: Update user-service seed and duplicate predicate**

Replace both occurrences of `super.admin@example.com` in the fixed super-admin insert and its `WHERE NOT EXISTS` predicate with `pardepaardtestemail1@gmail.com`.

- [ ] **Step 3: Run focused tests and verify GREEN**

Repeat both commands from Task 1.

Expected: both suites pass.

- [ ] **Step 4: Commit seed changes**

```powershell
git add -- Program/microservice/auth-service/src/main/resources/data.sql Program/microservice/auth-service/src/test/java/com/pm/authservice/AuthSeedPermissionsTest.java Program/microservice/user-service/src/main/resources/data.sql Program/frontend/src/utils/seedDataCleanSlate.test.ts
git commit -m "Change super admin email"
```

### Task 3: Update Running Databases

**Files:**
- No tracked files.

- [ ] **Step 1: Start database containers**

```powershell
docker compose up -d auth-service-db user-service-db
```

Working directory: `Program/microservice`

- [ ] **Step 2: Update auth database transactionally**

Execute against `auth-service-db`:

```sql
BEGIN;
UPDATE users
SET email = 'pardepaardtestemail1@gmail.com'
WHERE id = '8f3e44c2-0fb6-4f12-9d5b-8c1a0c72b001'
  AND username = 'super.admin';
COMMIT;
```

Require exactly one affected row.

- [ ] **Step 3: Update user database transactionally**

Execute against `user-service-db`:

```sql
BEGIN;
UPDATE users
SET email = 'pardepaardtestemail1@gmail.com'
WHERE user_id = '8f3e44c2-0fb6-4f12-9d5b-8c1a0c72b001';
COMMIT;
```

Require exactly one affected row.

- [ ] **Step 4: Verify both database records**

Query only the fixed UUID, username where available, email, and company ID. Confirm both rows use `pardepaardtestemail1@gmail.com` and no row with that UUID uses `super.admin@example.com`.

### Task 4: Full Verification

**Files:**
- Verify all files modified in Tasks 1-2.

- [ ] **Step 1: Run auth-service tests**

```powershell
.\mvnw.cmd test
```

Working directory: `Program/microservice/auth-service`

- [ ] **Step 2: Run frontend clean-slate test**

```powershell
npm test -- --run src/utils/seedDataCleanSlate.test.ts
```

Working directory: `Program/frontend`

- [ ] **Step 3: Verify source and Git state**

```powershell
rg -n "super\.admin@example\.com|pardepaardtestemail1@gmail\.com" Program
git diff --check
git status --short
```

Expected: the old email remains only in explicit negative test assertions; the new email is present in both seed files; no uncommitted implementation files remain.
