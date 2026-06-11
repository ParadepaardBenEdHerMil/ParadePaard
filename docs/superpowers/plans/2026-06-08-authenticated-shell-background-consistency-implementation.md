# Authenticated Shell Background Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make authenticated shell pages use the same outer background as the dashboard, navbar, and sidebar without changing card or panel styling.

**Architecture:** Keep `--app-shell-background` as the single source of truth for the authenticated shell. Update only page-root selectors that currently paint their own canvas, and verify the shared shell token through narrow stylesheet tests plus manual page inspection.

**Tech Stack:** React, TypeScript, Vite, CSS stylesheets, Vitest

---

## File Structure

### Existing files to modify

- `Program/frontend/src/stylesheets/pageSurface.test.ts`
  - Shared stylesheet regression test that already verifies the shell token on navbar/sidebar/dashboard-related stylesheets.
- `Program/frontend/src/stylesheets/AdminAuditLog.css`
  - Owns the audit log page canvas and currently overrides the outer shell background with a gradient.
- `Program/frontend/src/stylesheets/Messages.css`
  - Owns the messages page canvas and currently uses a standalone gray background.
- `Program/frontend/src/stylesheets/PayrollFinance.css`
  - Owns the payroll finance page canvas and currently uses a standalone gray background.
- `Program/frontend/src/stylesheets/HorecaPayrollRules.css`
  - Owns the horeca rules page canvas and currently uses a standalone gray background.

### Existing files to review during verification

- `Program/frontend/src/stylesheets/Navbar.css`
- `Program/frontend/src/stylesheets/PrimaryNav.css`
- `Program/frontend/src/stylesheets/AdminDashboard.css`
- `Program/frontend/src/stylesheets/PageShell.css`

These should remain the reference for the shared shell background and should not require code changes during implementation.

## Task 1: Lock the shared shell rule in tests

**Files:**
- Modify: `Program/frontend/src/stylesheets/pageSurface.test.ts`
- Test: `Program/frontend/src/stylesheets/pageSurface.test.ts`

- [ ] **Step 1: Write the failing test**

Replace the current test body with assertions that include the affected authenticated page stylesheets:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function stylesheetText(relativePath: string): string {
    return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("shared page surface styling", () => {
    it("uses the same shared background token for shell chrome and authenticated page roots", () => {
        const pageShellCss = stylesheetText("./PageShell.css");
        const primaryNavCss = stylesheetText("./PrimaryNav.css");
        const adminDashboardCss = stylesheetText("./AdminDashboard.css");
        const managementCss = stylesheetText("./Management.css");
        const adminAuditLogCss = stylesheetText("./AdminAuditLog.css");
        const messagesCss = stylesheetText("./Messages.css");
        const payrollFinanceCss = stylesheetText("./PayrollFinance.css");
        const horecaRulesCss = stylesheetText("./HorecaPayrollRules.css");

        expect(pageShellCss).toContain("--app-shell-background");
        expect(primaryNavCss).toContain("var(--app-shell-background");
        expect(adminDashboardCss).toContain("var(--app-shell-background");
        expect(managementCss).toContain("var(--app-shell-background");
        expect(adminAuditLogCss).toContain("var(--app-shell-background");
        expect(messagesCss).toContain("var(--app-shell-background");
        expect(payrollFinanceCss).toContain("var(--app-shell-background");
        expect(horecaRulesCss).toContain("var(--app-shell-background");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/stylesheets/pageSurface.test.ts
```

Expected: `FAIL` because the affected page stylesheets still use custom root backgrounds instead of `var(--app-shell-background, #f2f2f2)`.

- [ ] **Step 3: Commit**

```bash
git add Program/frontend/src/stylesheets/pageSurface.test.ts
git commit -m "test: cover authenticated shell page background token usage"
```

## Task 2: Normalize authenticated page-root backgrounds

**Files:**
- Modify: `Program/frontend/src/stylesheets/AdminAuditLog.css`
- Modify: `Program/frontend/src/stylesheets/Messages.css`
- Modify: `Program/frontend/src/stylesheets/PayrollFinance.css`
- Modify: `Program/frontend/src/stylesheets/HorecaPayrollRules.css`
- Test: `Program/frontend/src/stylesheets/pageSurface.test.ts`

- [ ] **Step 1: Write the minimal implementation**

Update only the page-root background declarations and keep card/panel styling untouched.

Apply these edits:

```css
/* Program/frontend/src/stylesheets/AdminAuditLog.css */
.auditLogPage {
    min-height: calc(100vh - 64px);
    padding: 0 0 56px;
    background: var(--app-shell-background, #f2f2f2);
}
```

```css
/* Program/frontend/src/stylesheets/Messages.css */
.messagesPage {
    min-height: 100vh;
    background: var(--app-shell-background, #f2f2f2);
}
```

```css
/* Program/frontend/src/stylesheets/PayrollFinance.css */
.payrollFinancePage {
    background: var(--app-shell-background, #f2f2f2);
}
```

```css
/* Program/frontend/src/stylesheets/HorecaPayrollRules.css */
.horecaRulesPage {
    background: var(--app-shell-background, #f2f2f2);
}
```

- [ ] **Step 2: Run test to verify it passes**

Run:

```bash
npm test -- src/stylesheets/pageSurface.test.ts
```

Expected: `PASS`

- [ ] **Step 3: Run adjacent frontend tests to catch shell regressions**

Run:

```bash
npm test -- src/components/Navbar.test.tsx src/components/PrimaryNav.test.tsx
```

Expected: `PASS`

- [ ] **Step 4: Commit**

```bash
git add Program/frontend/src/stylesheets/pageSurface.test.ts Program/frontend/src/stylesheets/AdminAuditLog.css Program/frontend/src/stylesheets/Messages.css Program/frontend/src/stylesheets/PayrollFinance.css Program/frontend/src/stylesheets/HorecaPayrollRules.css
git commit -m "style: align authenticated shell page backgrounds"
```

## Task 3: Verify the full authenticated experience

**Files:**
- Review: `Program/frontend/src/pages/AdminAuditLog.tsx`
- Review: `Program/frontend/src/pages/Messages.tsx`
- Review: `Program/frontend/src/pages/PayrollFinance.tsx`
- Review: `Program/frontend/src/pages/HorecaPayrollRules.tsx`
- Review: `Program/frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Start or reuse the frontend dev server**

Run:

```bash
npm run dev
```

Expected: Vite serves the app locally, typically at `http://localhost:5173`.

- [ ] **Step 2: Manually inspect authenticated shell pages in the browser**

Check these routes after logging in:

- `/dashboard`
- `/management/audit-log`
- `/messages`
- `/management/payroll-finance`
- `/management/horeca-payroll-rules`

Confirm:

- navbar background matches dashboard shell
- sidebar background matches dashboard shell
- page canvas matches dashboard shell
- cards and panels still retain their existing surfaces
- no odd seams appear at page edges on desktop and mobile widths

- [ ] **Step 3: Run a final quick test sweep for the touched area**

Run:

```bash
npm test -- src/stylesheets/pageSurface.test.ts src/components/Navbar.test.tsx src/components/PrimaryNav.test.tsx
```

Expected: all targeted tests `PASS`

- [ ] **Step 4: Commit**

```bash
git add Program/frontend/src/stylesheets/pageSurface.test.ts Program/frontend/src/stylesheets/AdminAuditLog.css Program/frontend/src/stylesheets/Messages.css Program/frontend/src/stylesheets/PayrollFinance.css Program/frontend/src/stylesheets/HorecaPayrollRules.css
git commit -m "chore: verify authenticated shell background consistency"
```

- [ ] **Step 5: Push**

```bash
git push
```

Expected: branch updates on GitHub without including unrelated files beyond the intended background-consistency work.

## Self-Review

### Spec coverage

- Authenticated pages only: covered by Task 2 target files and Task 3 route list.
- Background only, not cards: covered by Task 2 implementation snippets and Task 3 acceptance checks.
- Dashboard as reference: covered by Task 3 route list and shell-file review.
- Full-screen UI review: covered by Task 3 manual inspection checklist.

### Placeholder scan

No `TODO`, `TBD`, or “similar to previous task” shortcuts are left in the plan. All file paths, commands, and code targets are explicit.

### Type and name consistency

The plan consistently uses:

- `--app-shell-background`
- `.auditLogPage`
- `.messagesPage`
- `.payrollFinancePage`
- `.horecaRulesPage`

These match the current stylesheet selectors.
