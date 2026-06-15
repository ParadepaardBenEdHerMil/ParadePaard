# Conversations Thread Header Design

## Scope

Update only the admin shared inbox conversation UI. Do not change message fetching, SSE updates, sending, sorting, unread logic, or inbox behavior except where the thread header needs user navigation and avatar data.

## Goals

- Show the selected user's avatar to the left of their name in the conversation detail view.
- Replace `Back to inbox` with the same visual pattern as the account-page back control: back arrow plus `Back`.
- Align the left edge of that back control with the left edge of the avatar below it.
- Make the selected user header feel clickable and route to `/management/users/:userId`.
- Add the same avatar treatment to conversation rows in the inbox list.

## UI Design

### Inbox list

Each conversation row keeps the existing name, email, unread badge, and last-message preview, but gains a leading avatar on the left. The avatar uses the existing user profile image when available. If the image is missing or fails to load, the row shows the same default initial-style avatar treatment used elsewhere in the app.

### Selected thread header

The chat detail header becomes a compact stacked layout:

1. A `Back` button using the same visual styling as the account-page back control.
2. A clickable user identity row directly underneath.

The identity row contains:

- Avatar on the left
- User name as the primary line
- User email as the secondary line

The full row is clickable, uses a pointer cursor, and gets a subtle hover state without looking like a default text link.

## Data and State

Both the full-page inbox and the drawer load participant avatars by `userId` and cache them in local state keyed by user id. The selected thread and inbox rows read from the same cache shape. If an avatar request fails, the cache stores `null` so the UI falls back to initials without repeated failing requests.

## Navigation

- Thread header user click target: `/management/users/:userId`
- Back button behavior: keep existing inbox return behavior by calling the current `onBackToInbox` callback

No other routing changes are required.

## Error Handling

- Missing avatar blob: render fallback avatar
- Avatar request failure: render fallback avatar
- Missing `userId`: not expected for this feature, so the UI can assume a valid route target in the selected thread and inbox rows

## Testing

Add frontend regression coverage for:

- Selected thread shows `Back` instead of `Back to inbox`
- Selected thread renders avatar area beside the selected user name
- Selected thread renders a link or clickable user header pointing to `/management/users/:userId`
- Inbox rows render avatar treatment beside participant names

## Implementation Notes

- Reuse the shared admin inbox panel for both page and drawer so the UI stays identical in both places.
- Prefer the existing `PageBack` component for the `Back` control so its styling stays in sync with the account page.
- Keep CSS changes local to the shared inbox stylesheet unless a small shared helper is clearly cleaner.
