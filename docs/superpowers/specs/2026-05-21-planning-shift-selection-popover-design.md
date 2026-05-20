# Management Planning: Shift Selection + Popover Actions (Design)

## Goal

Improve `/management/planning` in **Shifts** mode so shift cells feel like a professional scheduling tool:

- Shift cells are selectable (single + multi-select).
- Clicking a shift cell opens a compact popover menu anchored near the cell.
- The popover supports actions for single or multi-selection.
- Default entry view is **Shifts** mode (not Events).
- UI remains mostly the same layout; focus is interaction upgrades.

The popover style and behavior should be inspired by the provided reference image: compact menu, clear actions, visually connected to the selected shift, and dismissible by clicking outside.

## Scope

### In scope
- Shifts mode only (Events mode remains unchanged for now).
- Selection via:
  1) Top-left check icon
  2) Shift + left click
- Selected visual state persists after popover closes.
- Popover actions:
  - Single selection: **Plan someone in**, **View shift details**
  - Multi selection: **Plan someone in**, **View selected shifts**
- “Plan someone in” opens an inline planning panel (inside the popover) that can plan **multiple people** to **multiple shifts** at once.
- Clicking outside popover closes it.

### Out of scope (for now)
- Drag-and-drop planning.
- Events mode selection.
- Keyboard-only navigation and advanced selection (e.g. Ctrl/Cmd-click).

## Current UI Baseline

In Shifts mode, each shift is currently rendered as a clickable compact card. Clicking navigates to the event detail page with `?shift=<shiftId>`.

## Desired Behavior

### 1) Default to Shifts mode

When navigating to `/management/planning`, the default mode should be **Shifts** (not Events).

### 2) Selecting shift cells

Each shift cell (shift entry card) supports selection.

**Selection methods**

1) **Check icon (top-left)**
- Add a small check icon in the **top-left corner** of each shift cell.
- Clicking the check icon toggles selection for that cell.
- Clicking the check icon must **not** open the popover.

2) **Shift + left click**
- Holding **Shift** and clicking another shift cell adds it to the current selection without clearing existing selection.

**Main-body click rules**

- Clicking the main body of a shift cell opens the popover anchored near that cell.
- If Shift is held while clicking the main body:
  - Add that cell to the selection (do not clear previous selection)
  - Open the popover for the updated selection
- If Shift is not held while clicking:
  - If the clicked cell is not selected, replace selection with just that cell
  - If the clicked cell is already selected, keep the current selection
  - Open the popover

**Selection persistence**
- Selection remains visible even when the popover closes.
- A future enhancement may add “click empty space clears selection”, but this is not required for this iteration.

### 3) Visual selected state

Selected shift cells should be clearly visible, using one or more of:
- Stronger border
- Light background highlight
- Checked icon state

This should feel consistent with the existing planning card styling.

### 4) Popover menu (context-like)

When a shift cell is clicked (main body), show a small popover near the cell.

**Positioning**
- Popover is anchored to the clicked cell (nearby, not fixed to screen center).
- It should remain within the viewport when possible.

**Dismissal**
- Clicking outside the popover closes it.
- Closing the popover does not clear selection.

**Menu content**

If exactly **1** shift is selected:
- Plan someone in
- View shift details

If **multiple** shifts are selected:
- Plan someone in
- View selected shifts

All menu labels must be English.

### 5) Plan someone in (bulk planning panel)

Selecting “Plan someone in” replaces the menu contents with a compact planning panel inside the same popover.

**Panel contents**
- Title: `Plan people to 1 shift` or `Plan people to N shifts`
- Search input
- Scrollable list of users (Active users only)
- Checkboxes to select multiple users
- Primary action button:
  - `Plan selected (X)` where X = number of selected users

**Behavior**
- Pressing `Plan selected` schedules each selected user onto **each selected shift** (status `ASSIGNED`).
- The UI updates without a full page refresh:
  - Re-fetch planning overview data
  - Selected state remains
  - Popover shows success or error message

**Duplicate handling**
- If a user is already scheduled on a selected shift, skip creating a duplicate assignment.
- After planning, show a compact success summary like:
  - `Planned 6 assignments (2 already existed)`

### 6) View shift details / View selected shifts

**Single selection: View shift details**
- Navigate to the existing event detail view using the same target as current shift mode cards:
  - `/management/planning/events/<eventId>?shift=<shiftId>`

**Multi selection: View selected shifts**
- Open a small modal listing selected shifts with basic context:
  - Event name
  - Shift title
  - Day + time
- Provide a per-row “View” action (navigates to the shift detail target above).

## Data Requirements

To support bulk planning, the planning overview load must include enough data to:
- Identify `shiftId` and its parent `eventId`
- Determine current allocations (for duplicate skipping)

If allocation details are not currently present in the overview payload, the overview request should set `includeAllocationDetails=true` for Shifts mode.

## Non-Goals / Guardrails

- Keep the existing planning layout (week/month columns, shift cards).
- Keep Events mode behavior unchanged.
- Keep popover small and fast; no heavy UI transitions.

