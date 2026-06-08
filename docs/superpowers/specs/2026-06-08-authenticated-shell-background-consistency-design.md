# Authenticated Shell Background Consistency Design

**Date:** 2026-06-08

## Goal

Make authenticated app pages visually consistent with the dashboard by ensuring the navbar, sidebar, and page canvas all use the same shell background.

The requested outcome is narrow:

- only authenticated pages are in scope
- only the outer page background should be normalized
- cards and other inner surfaces should keep their current styling

## Scope

This design covers:

- authenticated routes rendered inside the shared app shell
- page root selectors that currently paint their own outer canvas
- visual consistency between dashboard, navbar, sidebar, and page background
- targeted verification of the affected authenticated screens

This design does **not** cover:

- login, forgot-password, reset-password, application, or onboarding public-style screens
- changing card, panel, table, badge, modal, or status-surface styling
- redesigning page layouts, typography, or component hierarchy beyond what is needed for shell consistency

## Problem Summary

The shared shell already has a consistent background token:

- [Navbar.css](C:\Saved%20Files\Code\ParadePaard\Program\frontend\src\stylesheets\Navbar.css) uses `var(--app-shell-background, #f2f2f2)`
- [PrimaryNav.css](C:\Saved%20Files\Code\ParadePaard\Program\frontend\src\stylesheets\PrimaryNav.css) uses the same token
- dashboard pages already match that shell background

Some authenticated pages still override their page canvas with their own gradients or tinted root backgrounds. The audit log page is the clearest example:

- [AdminAuditLog.css](C:\Saved%20Files\Code\ParadePaard\Program\frontend\src\stylesheets\AdminAuditLog.css) paints the page root with a custom gradient instead of the shell token

That makes the full screen feel inconsistent even when the cards themselves are acceptable.

## Options Considered

### 1. Page-by-page cosmetic fixes

Update each mismatched stylesheet independently until the obvious pages look closer to dashboard.

Pros:

- quick to start
- low coordination cost for one or two pages

Cons:

- easy to miss pages
- no shared rule for future pages
- drift is likely to return

### 2. Shared authenticated-shell page-root rule

Standardize authenticated page root backgrounds to `var(--app-shell-background, #f2f2f2)` while leaving inner surfaces untouched.

Pros:

- matches the current shell architecture
- minimal implementation risk
- preserves existing cards and page content styling
- gives future work a clear rule: page root matches shell

Cons:

- still requires touching multiple page stylesheets where roots are custom-painted

### 3. Global parent-level forced background

Move all background ownership to a single authenticated layout wrapper and force descendants to inherit it.

Pros:

- least repetition once fully implemented

Cons:

- riskier because pages may depend on their own root containers for spacing or height behavior
- can create unintended overrides on pages that were not meant to change yet

## Recommended Approach

Use option 2: standardize authenticated page root backgrounds to the shared shell token.

This matches the user request exactly. It keeps the navbar and sidebar unchanged, makes the page canvas line up with dashboard, and avoids collateral changes to cards and feature-specific content surfaces.

## Design Rules

### Root canvas rule

For authenticated shell pages, the outermost page background should use:

- `var(--app-shell-background, #f2f2f2)`

This applies to selectors that own the page canvas, such as page root wrappers and top-level workspace containers.

### Inner surface rule

Do not change the following unless a page becomes visibly broken after the root-canvas update:

- cards
- filter panels
- tables
- forms
- empty states
- error banners
- badges
- status highlights

This keeps the visual change narrow and aligned with the explicit request.

### Public page rule

Do not apply this shell-background normalization to non-shell pages such as:

- login
- forgot password
- reset password
- application flow
- onboarding

Those pages can keep their separate presentation language for now.

## Affected Areas

Implementation should inspect authenticated pages that currently use custom root backgrounds instead of the shell token. Examples already identified include:

- audit log
- messages
- payroll finance
- horeca payroll rules
- selected management and planning pages

Dashboard, navbar, sidebar, and other pages already on the shell token should be used as the reference state rather than redesigned.

## Implementation Strategy

1. Identify authenticated page stylesheets whose root selectors own the page canvas.
2. Replace only the root background declarations that diverge from the shared shell token.
3. Preserve min-height, width, padding, and layout structure unless a background fix exposes a layout edge case.
4. Recheck the full visible page for each touched screen so the shell reads as one continuous surface.

This is intentionally not a broad theme refactor. It is a controlled normalization of background ownership.

## UI Review Expectations

Because this is a frontend change, implementation must review the whole visible screen on touched authenticated pages, not only the CSS line that changed.

Checks should include:

- navbar-to-page continuity
- sidebar-to-page continuity
- page edge contrast after gradients are removed
- whether cards still sit cleanly on the flatter shared background
- desktop and mobile behavior for the touched pages
- nearby management pages so one page does not remain visually out of family

## Testing And Verification

Add or update lightweight styling tests that confirm key authenticated page roots use the shell token. This should cover at least:

- navbar
- sidebar
- dashboard reference page
- audit log
- any additional authenticated page stylesheet changed during implementation

Manual verification should inspect the main authenticated experiences after the CSS changes, especially:

- dashboard
- audit log
- messages
- payroll finance
- work history
- account/company settings
- planning management pages that were touched

The acceptance criterion is simple: the navbar, sidebar, and page canvas should read as one background family, with cards still visually distinct on top.

## Risks And Mitigations

### Risk: changing more than the user asked for

If implementation starts normalizing cards and panels too, the scope will expand and visual regressions become more likely.

Mitigation:

- change only page-root background owners
- leave inner surfaces alone unless a clear break appears

### Risk: missing authenticated pages with custom roots

If only the audit log is fixed, other shell pages may still feel inconsistent.

Mitigation:

- search stylesheets for authenticated page-root backgrounds that diverge from dashboard
- verify the main management and account flows after edits

### Risk: page roots carrying both layout and background responsibilities

Some pages may mix min-height, padding, and background in a single selector.

Mitigation:

- preserve layout properties
- swap only the background ownership unless a small companion adjustment is required

## Implementation Direction

The implementation should be a targeted authenticated-shell consistency pass:

- keep the shared shell token as the source of truth
- update mismatched authenticated page roots to use it
- keep cards as they are
- leave public-style pages untouched
- verify the full screen on each affected page before claiming completion
