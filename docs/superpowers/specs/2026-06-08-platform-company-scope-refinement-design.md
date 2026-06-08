# Platform Company Scope Refinement Design

**Date:** 2026-06-08

## Goal

Refine the platform super-admin model so it stays simple and safe:

- super admins remain normal users in their own company
- platform company entry opens a selected company's management workspace only
- no hidden dummy accounts
- no full impersonation session
- first company admins are created by the platform and then complete a stricter admin onboarding flow
- development seed data starts from a near-empty platform state

This document supersedes the parts of the 2026-06-07 platform design that introduced a visible acting-company banner across the product shell.

## Scope

This refinement covers:

- platform company onboarding fields and flow
- first company admin lifecycle
- management-only company scope for super admins
- route and navigation behavior while scoped into another company
- button copy and exit behavior
- seed-data cleanup

This refinement does **not** cover:

- hidden impersonation
- support-session accounts
- dual audit identities
- cross-company access to personal employee pages
- broader multi-tenant redesign across every service

## Product Model

### Super admin identity

The super admin is a real user in a real home company. That home company remains the source of:

- their own payslips
- their own personal messages
- their own planning
- their own work history
- their own account data

The platform workspace is an extra capability unlocked by `CAN_MANAGE_PLATFORM`, not a separate user type that replaces normal employee behavior.

### Platform mode vs company scope

The user model stays split into two modes:

- `Platform mode`
  - browse companies
  - onboard companies
  - inspect company details
- `Scoped company management mode`
  - entered explicitly from a platform company detail page
  - applies only to management routes and management APIs
  - uses the real super admin identity
  - does not expose personal pages for the target company

This keeps the architecture auditable and avoids fake in-company users.

## Company Onboarding Flow

### Platform onboarding form

The platform onboarding screen should collect only:

- company name
- admin first names
- admin suffix
- admin last name
- admin email

The `Temporary password` field should be removed from the frontend form. The backend should generate a temporary password server-side.

### Provisioning behavior

The platform onboarding API should:

1. create the company
2. create the first admin auth account
3. create the matching user-service user
4. assign the company-admin permissions immediately
5. generate a temporary password server-side
6. send the onboarding email with:
   - login email
   - temporary password
   - password-reset instructions and link

The company admin should not need a separate approval or acceptance step before existing as a privileged user. The account is provisioned immediately, but the user must still complete onboarding before they can use the app normally.

## First Company Admin Lifecycle

### Status model

The first company admin should use the existing onboarding-gated status model rather than becoming fully active on day one with incomplete data.

Recommended behavior:

- account is created immediately
- login is allowed immediately
- first login routes into onboarding
- normal app usage stays blocked until required onboarding is completed

This aligns with the current `RequireActiveUser` and `RequireOnboarding` route guards instead of bypassing them.

### Admin onboarding path

The company admin should complete the full employee onboarding data set, with optional extras still skippable. The system should avoid inventing a second lightweight data standard for privileged admins.

Required completion should continue to cover the fields already treated as core onboarding data, including:

- legal/personal identity fields
- address
- bank details
- tax/payroll setup fields
- existing required ID-related onboarding fields

Optional profile enrichment, such as profile picture, can remain skippable.

### UX framing

The onboarding experience should be framed as account setup for a new company admin, not as employee acceptance. Reuse the existing onboarding implementation where possible, but adjust the wording for this path:

- `Complete your account setup`
- `Finish your company admin profile`

The admin does not need an onboarding-review approval queue before being allowed to manage employees. Once they complete required onboarding, they become a normal active company admin.

## Scoped Company Management Model

### Core rule

Entering another company from the platform should **not** behave like a hidden login as that company's admin. It should behave like a scoped management context for the real super admin.

That means:

- the auth/session identity remains the super admin
- audit/history continues to reflect the super admin as the actor
- backend company scope changes are used only to target management data for the selected company

### Allowed areas in scoped mode

While scoped into another company, the super admin may access management routes for that company, such as:

- management dashboard
- users
- onboarding
- onboarding review
- contracts
- planning
- work-history management
- travel-claim management
- payslip review and all-payslips
- company settings
- other management pages already controlled by permissions

### Disallowed areas in scoped mode

While scoped into another company, the super admin should **not** use personal routes as if they belonged to that company. This includes:

- `/dashboard`
- `/my-planning`
- `/messages`
- `/work-history`
- `/payslips`
- personal account pages unrelated to company management

These pages represent the super admin's own employee identity in their home company, not the selected target company.

## Navigation And Route Behavior

### Company-entry action

On the platform company detail page, replace `Go to management` with:

- `Open company management`

This label is explicit about both the destination and the scope.

### Entry behavior

When the super admin clicks `Open company management`:

1. store the selected company in platform scope context
2. switch the backend company scope using the existing company-scope endpoint
3. navigate to `/management`

### Exit behavior

When the super admin exits scoped company mode:

1. clear the platform scope context
2. clear the backend company scope
3. return to `/platform/companies/{companyId}`

The return target should always be the company detail page for the company they were viewing when they entered scope.

### Personal-nav treatment

To keep the UX unambiguous, personal-nav destinations should not remain available while the user is scoped into another company.

Recommended behavior:

- hide personal nav items in scoped company mode
- keep management nav items visible
- expose a compact `Exit company` or `Back to platform` control

The current large visible `Platform admin mode` banner should be removed. The UI should stay cleaner and closer to the existing management shell.

### Context visibility

The selected company should still be clear in a quieter way:

- show the selected company name in the existing company area of the navbar
- preserve a visible exit/back control

The app does not need to announce platform-admin presence to other users or present a large support banner to the acting user.

## Backend Rules

### Existing scope endpoint

Keep the current platform company-scope endpoint as the backbone of the feature:

- `POST /platform/company-scope` in auth-service

Do not replace it with impersonation or support-account login flows.

### Scope enforcement

The backend and frontend should both enforce that platform company scope is management-only.

If a platform admin in scoped company mode attempts to access a personal route or personal endpoint:

- frontend should redirect them back to `/management` or block the page with a clear message
- backend should avoid returning target-company personal data through employee-self-service endpoints

### Audit behavior

Audit remains simple:

- actor is the real super admin
- no hidden technical actor
- no dual-identity audit layer

This is the main safety advantage of this design.

## Seed Data

Development seed data should be reduced to the minimum platform baseline:

- one super admin company
- one super admin account

All other demo users, demo companies, and sample operational data should be removed unless explicitly required for a specific automated test.

This includes removing remaining seeded standard-admin startup accounts if they are only present for convenience rather than required coverage.

## UI Notes

This refinement changes visible frontend behavior. The implementation must review the full surrounding management and platform screens, not just the button text:

- page hierarchy after the banner is removed
- navbar/company-chip clarity
- placement and wording of `Open company management`
- placement and wording of `Exit company` or `Back to platform`
- nav consistency when personal items are hidden in scoped mode
- responsive behavior on desktop and mobile

The result should feel like a normal management workspace without introducing ambiguity about whose personal data is being shown.

## Testing

Add or update tests for:

- platform onboarding form no longer rendering a password field
- generated-password onboarding API behavior
- platform company detail action copy changing to `Open company management`
- scoped mode exposing management routes only
- personal nav items hidden or blocked during scoped mode
- exit flow returning to `/platform/companies/{companyId}`
- clean-slate seed tests covering only the super admin company and super admin account

## Implementation Direction

This work should be executed as a refinement of the current platform implementation, not a replacement:

- keep the existing platform pages
- keep the existing scope-switching infrastructure
- remove the visible platform banner
- tighten scope to management-only
- extend platform onboarding for suffix and generated password
- add the admin-onboarding wording and lifecycle adjustments

This preserves the current investment while aligning the product with the simpler and safer model chosen in this design session.
