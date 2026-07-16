# Tools menu — Export & Mail  ✅ DONE (branch: feature/tools-menu)

One **Tools** button replaced the per-page Email + Document-preview buttons. Clicking it opens a
menu: **Export** (page data → CSV, always) and **Mail** (preset email, only where the page can
mail). Document preview was dropped for now (per decision).

## Built
- `utils/csvExport.ts` — `toCsv` (RFC-4180 + UTF-8 BOM), `downloadCsv`, `documentModelToCsv`
  (flattens an existing DocumentModel to CSV). Unit-tested (`csvExport.test.ts`, 7 cases).
- `utils/pageExports.ts` — `buildProjectCsv`, `buildShiftCsv`, `buildPlanningOverviewCsv`
  (denormalised person-per-shift rows).
- `components/common/PageToolsMenu.tsx` (+ `PageToolsMenu.css`) — the button + dropdown
  (outside-click / Esc close, Export always, Mail conditional).
- `components/common/PresetSendModal.tsx` (+ `PresetSendModal.css`) — the mail flow (template
  picker + live email preview + send) extracted from the old PresetSendControl, opened by the menu.
- Removed `PresetSendControl.tsx` / `.css` (fully replaced). Kept `DocumentPreviewModal` + the
  `documentPreview.ts` model builders (models reused for CSV; preview easy to re-add later).

## Pages wired (9)
| Page | Export | Mail |
|---|---|---|
| Account (`/management/users/:id`) | account CSV (DocumentModel) | ✓ USERS |
| Project (`/management/planning/projects/:id`) | project + shifts + people | ✓ PROJECTS |
| Shift (expanded on the project page) | shift + people | ✓ SHIFTS |
| Application (`/management/applications/:id`) | application CSV | — |
| Onboarding review (`/management/onboarding-review/:id`) | profile CSV | — |
| Users list (`/management/users`) | visible table | — |
| Applications list (`/management/applications`) | visible table | — |
| Planning overview (`/management/planning`) | all projects/shifts/people | — |
| Horeca payroll rules (`/management/horeca-payroll-rules`) | statutory wage schedule | — |

## Verified
`tsc -b` clean · vitest **314 passing** (7 new) · eslint clean on new files.

## Follow-ups (same pattern, ~10 min each — not in this cut)
- **Clients list** (`/management/clients`) — export the client table.
- **Payslip review** (`/management/payslip-review`) — export the payslip rows.
- **Dedicated shift page** (`/management/planning/projects/:id/shifts/:id`) — add the Tools menu
  (Export via `buildShiftCsv` + Mail SHIFTS); the project page's expanded shift already covers this.
- Re-add **Document preview** as a menu option when wanted (`DocumentPreviewModal` is still present).
