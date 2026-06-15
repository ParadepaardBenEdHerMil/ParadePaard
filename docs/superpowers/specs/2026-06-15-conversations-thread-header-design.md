# Conversations Thread Header Design

## Scope

Update only the admin shared inbox conversation UI. Do not change message fetching, SSE updates, sending, sorting, unread logic, or inbox behavior except where the thread header needs user navigation, avatar data, and viewer-local timestamp grouping.

## Goals

- Show the selected user's avatar to the left of their name in the conversation detail view.
- Replace `Back to inbox` with the same visual pattern as the account-page back control: back arrow plus `Back`.
- Align the left edge of that back control with the left edge of the avatar below it.
- Make only the selected user's name feel clickable and route to `/management/users/:userId`.
- Add the same avatar treatment to conversation rows in the inbox list.
- Remove the selected user's email from the thread header.
- Show message times in the viewer's local browser timezone using time-only labels.
- Group thread messages by day with WhatsApp-style date separators.

## UI Design

### Inbox list

Each conversation row keeps the existing name, email, unread badge, and last-message preview, but gains a leading avatar on the left. The avatar uses the existing user profile image when available. If the image is missing or fails to load, the row shows the same default initial-style avatar treatment used elsewhere in the app.

### Selected thread header

The chat detail header remains a compact stacked layout:

1. A `Back` button using the same visual styling as the account-page back control.
2. A normal user identity row directly underneath.

The identity row contains:

- Avatar on the left
- User name as the only visible text line

The row itself should not look like a card or clickable box. Only the user name is interactive. On hover it gets a subtle emphasis treatment, uses a pointer cursor, and still feels visually consistent with the rest of the admin UI.

### Message timeline

The thread message list changes from per-message sender/date headers to a WhatsApp-style grouped timeline.

- Messages are grouped by the viewer's local calendar day in the browser.
- A centered separator appears before the first message of each day group.
- Group labels follow these rules:
  - `Yesterday` for messages from the previous local day
  - weekday name such as `Wednesday` for recent prior days
  - localized numeric date such as `6/4/2026` for older messages
- Individual messages do not show sender labels.
- Individual messages only show a local time label such as `14:32`.

## Data and State

Both the full-page inbox and the drawer load participant avatars by `userId` and cache them in local state keyed by user id. The selected thread and inbox rows read from the same cache shape. If an avatar request fails, the cache stores `null` so the UI falls back to initials without repeated failing requests.

Message grouping is derived client-side from the existing `createdAt` timestamps. No backend data shape changes are required.

## Navigation

- Thread header name click target: `/management/users/:userId`
- Back button behavior: keep existing inbox return behavior by calling the current `onBackToInbox` callback

No other routing changes are required.

## Error Handling

- Missing avatar blob: render fallback avatar
- Avatar request failure: render fallback avatar
- Missing `userId`: not expected for this feature, so the UI can assume a valid route target in the selected thread and inbox rows
- Invalid or missing message timestamp: omit the time label and group it under a stable fallback date bucket

## Testing

Add frontend regression coverage for:

- Selected thread shows `Back` instead of `Back to inbox`
- Selected thread renders avatar area beside the selected user name
- Selected thread does not render the user email in the header
- Selected thread renders a clickable user name pointing to `/management/users/:userId`
- Inbox rows render avatar treatment beside participant names
- Thread messages show time-only labels instead of sender plus full date
- Thread messages render centered date separators for grouped days

## Implementation Notes

- Reuse the shared admin inbox panel for both page and drawer so the UI stays identical in both places.
- Prefer the existing `PageBack` component for the `Back` control so its styling stays in sync with the account page.
- Keep CSS changes local to the shared inbox stylesheet unless a small shared helper is clearly cleaner.
- Use the viewer's browser locale/timezone for all day grouping and message-time labels in the admin thread.
