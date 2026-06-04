# Navbar Mixed Search Design

Date: 2026-06-05

## Goal

Extend the existing navbar search so it can search both users and directly navigable pages.

The search should:
- show mixed results in one dropdown
- label each result clearly as either `Page` or `User`
- only include pages the current user is allowed to access
- exclude deep detail routes and non-direct destinations
- support mouse click selection
- support keyboard navigation with arrow keys and `Enter`
- do nothing on `Enter` when no result is highlighted

## Scope

In scope:
- the existing navbar search field
- permission-aware page search results
- mixed page and user result rendering
- keyboard navigation and highlighted selection
- refined empty/loading/error states for the mixed dropdown
- tests for the page catalog, mixed results, and keyboard behavior

Out of scope:
- a command palette overlay
- global full-text app search
- deep links to detail pages such as user details, shift details, or payslip details
- pages the user cannot directly navigate to today

## Recommended Approach

Keep the existing navbar search and evolve it into a mixed typeahead.

This is preferred over a separate overlay or a large grouped search experience because it preserves the current navigation pattern, keeps the change local to the navbar, and adds page navigation without introducing a second search surface.

## User Experience

When the user types into the navbar search:
- matching direct pages appear in the dropdown
- matching users appear in the same dropdown
- each row shows a small type label such as `Page` or `User`

Example:
- `Travel claims` with a `Page` label
- `Tracy Adams` with a `User` label

If the user types `onboarding`, the page result can appear and be selected, but the user must either:
- click it manually
- move to it with arrow keys and press `Enter`

The search should never auto-open the first result on plain `Enter`.

## Result Rules

### Allowed page sources

Page results come only from direct navigable destinations already represented in the main user nav, management nav, or similarly direct first-level destinations.

This includes routes such as:
- Dashboard
- Management
- allowed management destinations from the permission-aware management catalog
- Payslips when allowed
- Contracts
- My planning
- Work history
- Messages
- Account
- Company settings when allowed

It excludes:
- deep detail pages
- edit/detail modals or task-specific drill-down routes
- pages hidden by missing permissions

### Permission filtering

Page candidates must be derived from current permissions before matching.

If a user lacks permission for `Onboarding`, `Travel claims`, or another management area, that page must not appear as a result and must not occupy dropdown space.

### Ordering

The mixed list should favor pages before users.

Within pages:
- prefix matches rank above substring matches
- stronger exactness ranks above weaker matches

Within users:
- name prefix matches rank above substring matches
- name matches rank above email-only matches

This keeps intent-driven navigation queries like `onboarding` or `travel` fast and predictable.

## Component Design

### Navbar

`Navbar.tsx` remains the primary integration point.

It will:
- keep the existing input
- load user results as it already does
- load or derive allowed page results from a helper
- merge page and user matches into one visible result list
- track a highlighted result index for keyboard navigation
- navigate based on the selected result type

### Page catalog helper

Add a dedicated utility helper for searchable direct pages instead of hardcoding page search entries inside the navbar component.

Responsibilities:
- build the allowed direct page catalog from permissions
- expose stable page metadata such as label, route, optional section hint, and search text
- keep permission logic centralized and testable

This helper should reuse existing permission utilities and management nav configuration where possible so the page search stays aligned with the visible application navigation.

### Result model

Use one normalized result shape in the navbar, for example:
- `type`: `page` or `user`
- `label`
- `secondaryLabel`
- `to` or `userId`
- `matchStrength`

This keeps rendering and keyboard navigation uniform.

## Interaction Design

Keyboard behavior:
- `ArrowDown` moves to the next visible result
- `ArrowUp` moves to the previous visible result
- `Enter` opens only the currently highlighted result
- `Escape` closes the dropdown

Mouse behavior:
- clicking a result opens it
- hovering a result may update the highlighted state so keyboard and mouse interaction stay visually aligned

Focus behavior:
- opening the input opens the dropdown
- closing the dropdown clears the highlighted selection
- typing a new term resets highlight state unless there is a deliberate first-item selection rule added later

## Visual Design

The mixed dropdown should stay visually close to the current navbar search style, but become more informative.

Recommended presentation for each result row:
- primary title
- secondary line where useful
- compact type pill on the row, for example `Page` or `User`

Page rows:
- title: page name
- secondary text: optional section hint such as `Management`

User rows:
- title: display name
- secondary text: email

The highlighted row should have a clear selected state that differs from plain hover.

The type label should look intentional and lightweight, not like debug metadata.

## Data Flow

1. User types into navbar search.
2. Navbar computes filtered page results from the permission-aware page catalog.
3. Navbar computes filtered user results from the loaded user list.
4. Navbar merges and sorts them into one result list.
5. Dropdown renders mixed results with type labels.
6. Keyboard or mouse selection triggers navigation:
   - page results navigate to their route
   - user results navigate to the existing management user detail route

## Empty, Loading, and Error States

Loading:
- preserve the existing user-loading behavior
- page results should still be available immediately because they are local and permission-derived

Empty:
- if there is no search term, show `Start typing to search.`
- if there is a term but no results at all, show `No matches found.`

Error:
- if user loading fails, keep page search working
- the dropdown should not fully fail just because user data failed to load
- error messaging should stay calm and compact

This means page results remain usable even when user lookup has a network issue.

## Testing Plan

Add focused tests for:
- permission-aware page catalog generation
- mixed dropdown showing both `Page` and `User` results for overlapping terms
- restricted pages staying hidden for users without permission
- keyboard navigation with highlight movement
- `Enter` opening only a highlighted result
- `Enter` doing nothing when no result is highlighted
- result labels showing clear type distinctions

Prefer narrow component and utility tests over broad page tests.

## Risks and Mitigations

### Risk: duplicated route logic

If the navbar builds its own page list independently, it can drift from the real nav.

Mitigation:
- derive searchable pages from existing permission/nav helpers where possible
- centralize page search metadata in one utility

### Risk: noisy mixed dropdown

If page and user rows look too similar, the user may not know what they are selecting.

Mitigation:
- add a compact but clearly visible type label
- keep row structure consistent but distinct by secondary text

### Risk: incorrect keyboard behavior

If `Enter` opens a result without explicit selection, the search will feel unsafe.

Mitigation:
- require a highlighted result before `Enter` navigates
- test arrow-key and `Enter` behavior directly

## Implementation Notes

The implementation should stay incremental:
- first add the page catalog helper and tests
- then update navbar search state and result merging
- then add mixed result UI and keyboard highlighting
- then refine styles and run final verification

This keeps the change localized and reduces the risk of breaking unrelated navigation behavior.
