# Disable Own-Company Platform Management Entry

## Goal

Prevent a platform administrator from opening company management through the
Platform company directory when the selected company is already the company
attached to their authenticated employee account.

## Behavior

- The company detail page loads the authenticated user with the existing
  `UserServices.getMe()` call.
- The selected company ID is compared with the authenticated user's
  `companyId`.
- When the IDs match, the "Open company management" button is disabled and
  visually greyed out.
- The action remains disabled while the authenticated user's company is still
  loading, preventing an immediate-click bypass.
- Hovering the disabled action exposes this explanation:
  "You are already managing this company through your current account."
- When the IDs differ, the action keeps its current behavior and switches the
  platform company scope before navigating to `/management`.
- The rule is generic. It applies to any future platform administrator whose
  employee account belongs to a company shown in the platform directory.

## UI Design

The existing button remains in the same position to keep the company detail
layout stable. A wrapper carries the native `title` tooltip because disabled
buttons do not consistently emit pointer events. The button receives the
native `disabled` attribute and an explicit disabled style.

## Data And Error Handling

The current-user lookup runs alongside the existing company-detail loading.
While that lookup is pending, the action is disabled without the own-company
tooltip. If the lookup fails, the page keeps the action enabled rather than
blocking access based on unknown identity data. Existing company loading and
company-scope errors continue to use the page error message.

## Testing

- Verify the management action is disabled and includes the tooltip when the
  authenticated user's company ID matches the selected company.
- Verify the action remains enabled for a different company.
- Verify the action is disabled while current-company identity is loading.
- Keep the existing acting-company mapping test.

## Scope

This change is frontend-only. It does not change platform permissions,
authentication claims, company membership, or backend company-scope APIs.
