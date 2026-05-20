# My Planning: Scheduled Shift Response Cards (Design)

## Goal

Update the **My Planning** page so the “Scheduled shifts” section and its empty state text are removed. Scheduled shifts that need a response should appear as **one card per shift** above the accepted shifts list, with **Accept** and **Decline** actions on the right.

## Current Behavior (Baseline)

On **My Planning**, the page renders two sections inside the main card:

- **Scheduled shifts** (status `ASSIGNED`) with:
  - A title, description, and a count badge
  - An empty state message when there are zero scheduled shifts
  - A list of request cards with Decline/Accept actions when scheduled shifts exist
- **Accepted shifts** (status `CONFIRMED`) with:
  - A title, description, and a count badge
  - A list of accepted shift rows (clickable) or an empty state message

## Desired Behavior (Approved: Approach A)

### 1) Scheduled shifts section is removed

Remove the entire “Scheduled shifts” section (title, description, badge, and empty state). The user should not see:

- “Scheduled shifts”
- “Accept a scheduled shift and it moves into your accepted list.”
- “0”
- “No scheduled shifts waiting for a response.”

### 2) Scheduled shifts that need a response show as cards above Accepted shifts

When there are scheduled shifts waiting for a response (status `ASSIGNED`):

- Render **one card per scheduled shift**.
- Place these cards **above** the Accepted shifts section/list (inside the same main page card).
- Each card shows shift context (event name, date/time, role/location, etc.) consistent with the existing scheduled-shift cards.
- Each card has actions on the right:
  - **Decline**
  - **Accept**

### 3) When there are no scheduled shifts, nothing extra is shown

If there are no scheduled shifts needing a response:

- Do not render any scheduled-shift header/section.
- Do not render an empty state message.
- The page should immediately show the Accepted shifts section/list.

## Page Layout

Inside the main My Planning card:

1. (Conditional) **Scheduled response cards** (only if there are scheduled shifts needing response)
2. **Accepted shifts** section/list (always present as it is today)

## Interaction Rules

- **Accept**: confirms the shift and moves it into the Accepted list on reload.
- **Decline**: cancels the scheduled assignment on reload.
- Buttons are disabled while a response action is in flight (same behavior as current).
- Past/Upcoming tab filtering continues to apply to both scheduled and accepted items.

## Out of Scope

- Any backend changes to shift status logic
- Changing accepted shift row styling
- Aggregating multiple scheduled shifts into a single combined card

