# Horeca Rule Versioning And Forward Contract Replacement

## Scope

This design covers the first subproject only:

- move horeca rule management from frontend constants and local storage to backend-owned persisted data
- make horeca rules effective-dated and historically queryable
- replace local job preset storage with backend persistence
- create forward-only replacement contract drafts when a new rule version becomes effective and affects active employees
- make payroll resolve horeca rule values by period date

This design does not implement the app-wide audit logging system yet. That is a separate follow-up subproject.

## Problem

The current horeca rules page is mostly a frontend-managed configuration surface. Rule values such as holiday allowance, vacation buildup, pension percentages, tax examples, travel allowance rate, and job presets are defined in frontend files and job presets are saved in browser local storage. That causes several problems:

- changes are not shared across users or environments
- there is no authoritative backend history for rule values
- there is no effective-date model for CAO or legal changes
- contracts cannot be regenerated forward in a controlled way when source rules change
- payroll calculations are coupled to static frontend values instead of persisted date-based rule versions

The product requirement is:

- old signed contracts remain historical records and are never overwritten
- new CAO or law-driven rule versions become effective on a date
- the system checks active employees affected by that date
- if employee-facing contract terms are affected, the system creates a new draft contract effective from that date
- payroll uses the correct lawful rule version for the payroll period date

## Goals

- preserve historical signed contracts unchanged
- support backend editing of horeca job presets and rule sections
- support field-level source metadata including document and page
- support effective-dated history for every rule item
- support simple mental model: rule change creates a new forward-going contract draft
- keep payroll calculations date-correct

## Non-Goals

- no addendum/amendment model in this phase
- no multi-sector generic rule engine in this phase
- no cross-app audit logging in this phase
- no automatic legal reasoning engine that decides if a change is lawful
- no retroactive payroll recalculation workflow in this phase

## Current State

Frontend horeca rule data lives in:

- `Program/frontend/src/data/horecaPayrollRules.ts`
- `Program/frontend/src/utils/horecaPayrollRules.ts`
- `Program/frontend/src/pages/HorecaPayrollRules.tsx`

Job presets currently save through browser local storage with `loadHorecaJobPresets`, `saveHorecaJobPresets`, and `resetHorecaJobPresets`.

Contracts already behave partly like snapshots:

- contract fields such as wage, hours, holiday allowance, payment frequency, pension text, and PDF data are persisted in contract-service
- finalized PDFs are stored and historical contracts are not meant to be rewritten

This is a good base for forward replacement instead of historical mutation.

## Recommended Approach

Implement a backend-owned horeca configuration domain with effective-dated versions. When a new version becomes effective:

1. persist the new rule version and close the prior active version for future use
2. identify active contracts overlapping the new effective date
3. determine whether the changed rule fields affect employee-facing contract terms
4. for affected active employees, create a new draft contract effective from the rule date
5. leave prior finalized contracts untouched as historical records
6. resolve payroll rule values by period date

This keeps the history intact and makes the system understandable:

- before date X: old contract and old rules
- on or after date X: new rule version and a new contract draft to move forward

## Domain Model

### Horeca Rule Set

Create a horeca-specific backend model instead of a generic all-sector engine in this phase.

Suggested root entities:

- `horeca_rule_version`
- `horeca_rule_item`
- `horeca_job_preset_version`
- `horeca_rule_change_run`

### Rule Version

`horeca_rule_version`

- `id`
- `version_label`
- `effective_from`
- `effective_to` nullable
- `status` such as `DRAFT`, `PUBLISHED`, `SUPERSEDED`
- `reason`
- `source_summary`
- `created_by_user_id`
- `created_at`
- `published_by_user_id`
- `published_at`

This represents one publishable horeca rules snapshot for a period.

### Rule Item

`horeca_rule_item`

- `id`
- `rule_version_id`
- `section_key`
- `item_key`
- `name`
- `value_text`
- `value_number` nullable
- `value_boolean` nullable
- `value_type`
- `unit`
- `calculation_rule`
- `document_name`
- `document_url`
- `page_reference`
- `source_note`
- `used_in_contract`
- `used_in_payroll`
- `sort_order`

The UI sections map directly to `section_key` values:

- `WAGE_RULES`
- `TAX_AND_PAYROLL_RULES`
- `PENSION_RULES`
- `HOLIDAY_AND_TRAVEL_RULES`

The new holiday/travel section should include at minimum:

- holiday allowance percentage
- holiday allowance mode text if needed
- vacation buildup per paid hour
- travel allowance per kilometer

### Job Preset Version

`horeca_job_preset_version`

- `id`
- `rule_version_id`
- `preset_key`
- `preset_name`
- `job_title`
- `job_function`
- `function_group`
- `default_contract_type`
- `default_hourly_wage`
- `default_monthly_wage`
- `default_hours_per_week`
- `default_payroll_period`
- `pension_applicable`
- `holiday_allowance_mode`
- `vacation_build_up_applicable`
- `document_name`
- `document_url`
- `page_reference`
- `source_note`
- `is_active`
- `admin_notes`
- `sort_order`

Job presets become part of the versioned horeca rules model instead of browser-local state.

### Rule Change Run

`horeca_rule_change_run`

- `id`
- `rule_version_id`
- `started_at`
- `finished_at`
- `started_by_user_id`
- `contracts_scanned`
- `contracts_affected`
- `contracts_drafted`
- `status`
- `summary`

This tracks the batch that evaluates active contracts and creates new draft contracts.

## Contract Behavior

### Historical Contracts

Signed and finalized contracts remain immutable historical records. They are never rewritten due to later CAO or law updates.

### Forward Replacement Contract Drafts

When a published horeca rule version becomes effective on date `X`, the backend checks for contracts that are active on or after `X`.

For each active contract:

- if the rule changes do not affect employee-facing terms, do nothing to contracts
- if the rule changes affect employee-facing terms, create a new `DRAFT` contract effective from date `X`

The new draft contract should:

- copy the latest active or latest finalized contract as its base
- keep employee identity and unchanged employment terms
- apply only the new effective rule-backed values
- link back to the prior contract through a replacement reference

Suggested contract additions:

- `replaces_contract_id` nullable
- `derived_from_rule_version_id` nullable
- `rule_effective_from` nullable

This creates a readable chain:

- contract A finalized for the old period
- contract B drafted from new rule version effective from date X

### Contract Term Closure

If a new forward contract is created effective from date `X`, the previous contract should remain historical for the earlier period. The implementation should clearly define whether the old contract end date is explicitly set to `X - 1 day` during replacement finalization, or whether reporting resolves precedence by effective start date and status. The preferred implementation is:

- keep the previous finalized contract untouched at draft generation time
- when the new replacement contract is finalized, close the old contract end date to `X - 1 day` if needed to prevent overlapping active periods

This avoids mutating history too early while still keeping active-period logic clean once the replacement is finalized.

## Payroll Resolution

Payroll must stop relying on frontend constants for authoritative values.

For any payroll period:

- resolve the applicable horeca rule version using the payroll period date or period start date
- use rule items from that version for holiday allowance, vacation buildup, employer premiums, pension settings, and any other derived values
- use contract snapshot fields where payroll must respect employee-specific agreed terms

Resolution order should be:

1. employee contract snapshot fields effective on that date
2. published horeca rule version effective on that date
3. fail clearly if no published horeca rule version exists for that date

This ensures periods before and after a CAO change use the correct values without rewriting the past.

## UI Behavior

### Horeca Rules Page

Keep the existing page structure and visual language, but move data loading and saving to the backend.

Required UI changes:

- add top-right padded edit icon buttons to `Wage rules`, `Tax and payroll rules`, `Pension rules`, and the new `Holiday and travel rules` section
- each button opens a scrollable popup editor
- each popup shows a list of all rows in the section
- each row supports editing relevant fields including `name`, `value`, `unit/type` where applicable, `document`, `document URL`, `page`, `source note`, and usage flags if shown
- add backend-backed job preset loading and saving
- surface the effective date when publishing a new rule version

The new section should include:

- `Holiday allowance` with default seeded value `8.00% reserved`, source `Horeca cao 2025 2026`, page `32`
- `Vacation buildup` with default seeded value `0.0961 vacation hour per paid hour`, source `Horeca cao 2025 2026`, page `23`
- `Travel allowance rate` with default seeded value `EUR 0.23 per km`, marked as a temporary shared horeca onboarding and travel-claim estimate rule
- `Vacation day buildup` as the editable displayed vacation-hours-per-worked-hour value, seeded from the same documented vacation buildup rule for now

The popup editor should remain consistent with the existing dark wizard/modal system already used for job presets.

### History Visibility

Each section should allow admins to inspect prior versions after this phase. The minimum viable first step is:

- show current active values in the page
- provide backend support for historical records
- optionally defer rich UI history browsing until the next slice if needed for scope control

## APIs

Suggested endpoints in the user-service management domain:

- `GET /api/admin/horeca-rules/current`
- `GET /api/admin/horeca-rules/versions`
- `GET /api/admin/horeca-rules/versions/{versionId}`
- `POST /api/admin/horeca-rules/versions`
- `POST /api/admin/horeca-rules/versions/{versionId}/publish`
- `GET /api/admin/horeca-rules/versions/{versionId}/job-presets`
- `PUT /api/admin/horeca-rules/versions/{versionId}/job-presets`
- `GET /api/admin/horeca-rules/versions/{versionId}/sections/{sectionKey}`
- `PUT /api/admin/horeca-rules/versions/{versionId}/sections/{sectionKey}`
- `POST /api/admin/horeca-rules/versions/{versionId}/simulate-impact`

Publishing should be explicit. Saving a popup should update a draft version, not silently replace the currently published version.

## Change Impact Rules

The first implementation should use explicit backend rules to decide whether a contract replacement draft is needed.

Changes that should trigger replacement draft creation include:

- holiday allowance percentage or mode
- vacation buildup values referenced in contract text or leave entitlement generation
- pension participation wording or pension scheme text
- travel allowance contract wording if the contract states the rule-based allowance
- wage table or preset-backed wage defaults when used to generate future contracts for active employees
- collective agreement reference text

Changes that may not require immediate contract replacement include:

- internal explanatory notes
- source note wording with no employee-facing effect
- source URL corrections only

The first release can use a fixed mapping from changed field keys to `requires_contract_replacement = true/false`.

## Processing Flow

### Publish Rule Version

1. admin creates or edits a draft horeca rule version
2. admin sets `effective_from`
3. backend validates completeness and source metadata
4. admin publishes version
5. backend closes prior published version for future use
6. backend runs impact detection for active contracts
7. backend creates replacement draft contracts for affected employees
8. backend stores a summary result

### Payroll Calculation

1. payroll requests contract and applicable horeca rule version for the payroll date
2. backend resolves effective contract snapshot
3. backend resolves effective horeca rule version
4. payroll computes using those persisted values

## Data Migration

Seed the first backend-published horeca rule version from the current frontend constants:

- `HORECA_PAYROLL_VARIABLES`
- `HORECA_WAGE_RULES`
- `HORECA_EMPLOYER_PREMIUM_RULES`
- `DEFAULT_HORECA_JOB_PRESETS`

This initial migration should produce:

- one published current horeca rule version
- seeded rule items for all current visible sections
- seeded job preset versions

Frontend constants can remain temporarily as fallback fixtures during transition, but the target state is backend as source of truth.

## Error Handling

- prevent publishing a rule version without required source document and page metadata for rows that are shown as source-backed
- prevent multiple published horeca rule versions overlapping on the same date
- return a clear error when payroll needs a rule version for a date and none exists
- return a batch summary when replacement draft creation partially fails
- make rule publish idempotent where possible

## Testing

### Backend

- version publish validation
- non-overlapping effective date rules
- impact detection for active contracts
- replacement draft creation from active finalized contract
- no historical mutation of finalized contracts
- payroll rule resolution by period date
- seeded migration correctness

### Frontend

- horeca rules page loads current backend values
- section edit buttons open scrollable popups
- popups render editable list rows with source document and page fields
- save flows call backend services
- job presets no longer use local storage

## Risks And Tradeoffs

- publishing rule versions and immediately generating many draft contracts can become a heavy batch operation
- contract overlap logic must be precise to avoid two active forward contracts for the same period
- payroll must be moved carefully from static constants to effective-dated backend values without regressions
- field-level history UI can expand scope quickly, so backend history should land first even if the first UI is minimal

## Follow-Up Subproject

After this subproject, implement app-wide audit logging as a separate cross-cutting system that records major actions such as create, edit, approve, delete, reject, send, sign, finalize, publish rules, and generated replacement contracts.
