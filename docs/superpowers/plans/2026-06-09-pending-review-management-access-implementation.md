# Pending Review Management Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let pending-review accounts with management access use the onboarding waiting-state CTA to open `/management` without being trapped by narrower local permission checks.

**Architecture:** Reuse the shared `canAccessManagement` permission policy in both the onboarding waiting-state CTA and the active-user guard. Keep the UI intact, update the regression tests first, then make the smallest production edits needed to satisfy them.

**Tech Stack:** React 19, TypeScript, React Router, Vitest

---

### Task 1: Add the failing regression tests

**Files:**
- Modify: `C:\Saved Files\Code\ParadePaard\Program\frontend\src\pages\Onboarding.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("shows the waiting-state management CTA and reuses management-access policy", () => {
    const onboardingPage = readFileSync(new URL("./Onboarding.tsx", import.meta.url), "utf8");
    const activeGuard = readFileSync(new URL("../components/RequireActiveUser.tsx", import.meta.url), "utf8");

    expect(onboardingPage).toContain('navigate("/management")');
    expect(onboardingPage).toContain("canAccessManagement(permissions)");
    expect(activeGuard).toContain("canAccessManagement(permissions)");
    expect(activeGuard).not.toContain("SELF_APPROVAL_PERMISSIONS");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/Onboarding.test.ts`

Expected: FAIL because `Onboarding.tsx` and `RequireActiveUser.tsx` still use the old local self-approval permission logic.

- [ ] **Step 3: Write the minimal implementation**

Do not implement yet. This task ends after the failing test is confirmed.

- [ ] **Step 4: Run test to verify it still fails for the expected reason**

Run: `npm test -- src/pages/Onboarding.test.ts`

Expected: FAIL with missing `canAccessManagement(permissions)` assertions, not with a syntax or path error.

- [ ] **Step 5: Commit**

```bash
git add Program/frontend/src/pages/Onboarding.test.ts
git commit -m "test: cover pending-review management access"
```

Do not commit yet if the test is still red and production code is not written.

### Task 2: Reuse shared management access in the waiting state and route guard

**Files:**
- Modify: `C:\Saved Files\Code\ParadePaard\Program\frontend\src\pages\Onboarding.tsx`
- Modify: `C:\Saved Files\Code\ParadePaard\Program\frontend\src\components\RequireActiveUser.tsx`
- Test: `C:\Saved Files\Code\ParadePaard\Program\frontend\src\pages\Onboarding.test.ts`

- [ ] **Step 1: Write the minimal implementation**

```ts
import { canAccessManagement } from "../utils/permissionPolicy";

const canOpenManagement = canAccessManagement(permissions);
```

and:

```ts
if (
    !canAccessManagement(permissions) &&
    (status === "PENDING_SETUP" ||
        (status === "PENDING_PROFILE_REVIEW" && !isContractSigningRoute) ||
        status === "CHANGES_REQUESTED" ||
        status === "PENDING_CONTRACT_REVIEW")
) {
    return <Navigate to="/onboarding" replace />;
}
```

Use the shared helper in both files and remove the duplicated `SELF_APPROVAL_PERMISSIONS` arrays.

- [ ] **Step 2: Run the regression test to verify it passes**

Run: `npm test -- src/pages/Onboarding.test.ts`

Expected: PASS

- [ ] **Step 3: Run adjacent permission-policy verification**

Run: `npm test -- src/utils/permissionPolicy.test.ts`

Expected: PASS, confirming management access semantics still match existing policy.

- [ ] **Step 4: Run the focused onboarding render test**

Run: `npm test -- src/pages/Onboarding.test.tsx`

Expected: PASS, confirming the onboarding page still renders its account-setup entry state.

- [ ] **Step 5: Commit**

```bash
git add Program/frontend/src/pages/Onboarding.tsx Program/frontend/src/components/RequireActiveUser.tsx Program/frontend/src/pages/Onboarding.test.ts
git commit -m "fix: allow pending-review managers into management"
```
