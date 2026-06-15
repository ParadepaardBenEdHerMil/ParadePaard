# Disable Own-Company Platform Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disable the platform company-management entry action when the selected company is the authenticated user's own company.

**Architecture:** Keep the rule inside `PlatformAdminCompanyDetails`, where both the selected company and the action already live. Load the authenticated user through the existing `UserServices.getMe()` API, compare company IDs, and use a wrapper title for hover help around the native disabled button.

**Tech Stack:** React 19, TypeScript, React Router, Vitest, server-side static rendering tests, CSS.

---

### Task 1: Own-company action state

**Files:**
- Create: `Program/frontend/src/components/platform/CompanyManagementAction.tsx`
- Create: `Program/frontend/src/utils/platformCompany.ts`
- Modify: `Program/frontend/src/pages/PlatformAdminCompanyDetails.test.tsx`
- Modify: `Program/frontend/src/pages/PlatformAdminCompanyDetails.tsx`
- Modify: `Program/frontend/src/stylesheets/PlatformAdmin.css`

- [ ] **Step 1: Write the failing test**

Add tests for an exported `CompanyManagementAction` component. Render it with
matching selected/current company IDs and assert:

```tsx
expect(html).toContain('disabled=""');
expect(html).toContain('title="You are already managing this company through your current account."');
```

Render it again with different company IDs and assert that it does not contain
the disabled tooltip or disabled attribute. This keeps the test compatible
with the existing server-side static-rendering setup, where effects do not run.
Render it once more with an undefined current-user company ID and assert that
the action remains disabled without showing the own-company tooltip.

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```powershell
npm test -- PlatformAdminCompanyDetails.test.tsx
```

Expected: FAIL because the current page does not load the authenticated user or disable the action.

- [ ] **Step 3: Implement the minimal behavior**

Create `CompanyManagementAction.tsx` with the focused action component:

```tsx
export default function CompanyManagementAction({
    selectedCompanyId,
    currentUserCompanyId,
    onOpen,
}: {
    selectedCompanyId: string;
    currentUserCompanyId: string | null | undefined;
    onOpen: () => void;
}) {
    const isOwnCompany = currentUserCompanyId === selectedCompanyId;
    const isDisabled = currentUserCompanyId === undefined || isOwnCompany;

    return (
        <span
            className="companyManagementAction"
            title={isOwnCompany ? OWN_COMPANY_TOOLTIP : undefined}
        >
            <button type="button" className="button" disabled={isDisabled} onClick={onOpen}>
                Open company management
            </button>
        </span>
    );
}
```

Then import the action and load the current user in
`PlatformAdminCompanyDetails.tsx`:

```tsx
const OWN_COMPANY_TOOLTIP = "You are already managing this company through your current account.";
const [currentUserCompanyId, setCurrentUserCompanyId] = useState<string | null | undefined>(undefined);

useEffect(() => {
    let cancelled = false;

    const loadCurrentUser = async () => {
        try {
            const currentUser = await UserServices.getMe();
            if (!cancelled) setCurrentUserCompanyId(currentUser.companyId ?? null);
        } catch {
            if (!cancelled) setCurrentUserCompanyId(null);
        }
    };

    void loadCurrentUser();
    return () => {
        cancelled = true;
    };
}, []);

```

Guard `handleGoToManagement` while identity is loading and when the company
IDs match. Render the focused component:

```tsx
<CompanyManagementAction
    selectedCompanyId={company.companyId}
    currentUserCompanyId={currentUserCompanyId}
    onOpen={() => void handleGoToManagement()}
/>
```

In `PlatformAdmin.css`, add:

```css
.companyManagementAction {
    display: inline-flex;
}

.companyManagementAction .button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    filter: grayscale(0.35);
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```powershell
npm test -- PlatformAdminCompanyDetails.test.tsx
```

Expected: all `PlatformAdminCompanyDetails` tests PASS.

- [ ] **Step 5: Run frontend verification**

Run:

```powershell
npm test
npm run build
```

Expected: all frontend tests pass and the TypeScript/Vite build exits successfully.

- [ ] **Step 6: Commit and push**

```powershell
git add -- Program/frontend/src/components/platform/CompanyManagementAction.tsx Program/frontend/src/utils/platformCompany.ts Program/frontend/src/pages/PlatformAdminCompanyDetails.test.tsx Program/frontend/src/pages/PlatformAdminCompanyDetails.tsx Program/frontend/src/stylesheets/PlatformAdmin.css
git add -f -- docs/superpowers/plans/2026-06-15-disable-own-company-management.md
git commit -m "Disable own-company platform management entry"
git -c http.sslBackend=schannel push origin main
```
