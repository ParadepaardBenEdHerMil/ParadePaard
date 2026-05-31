# Onboarding Review Auto-Save and Employer Pre-Sign Auto-Finalize Design

Date: 2026-05-31

## Summary

Update the onboarding review workflow so that the `Create and send contract` action automatically saves the onboarding review first, captures the employer signature package inside onboarding review, sends the contract to the employee with the employer signature already visible, and automatically finalizes the contract after the employee signs.

This removes the normal need for a second employer signing step later in admin contract management.

## Goals

- Make `Create and send contract` automatically save the review state before sending.
- Add employer signing inputs to the onboarding review final section.
- Let management pre-sign the contract during onboarding review.
- Show the employer signature and employer name to the employee before employee signing.
- Automatically finalize the contract after the employee signs when employer pre-sign data already exists.
- Keep the current manual finalize flow available as a fallback for older contracts or contracts created outside onboarding review.

## Non-goals

- Removing the existing manual finalize tools from admin contract management.
- Replacing the entire contract workflow for all contract creation paths.
- Redesigning the employee contract signing page beyond what is needed to show the employer signature earlier.

## Current behavior

- The onboarding review page can save review state manually.
- The onboarding review page can create or update a contract draft.
- The onboarding review page can create and send a contract.
- `Create and send contract` sends the contract and then separately updates onboarding status.
- Employer signing currently happens later in the admin user details contract area.
- Contract finalization currently requires the employee to sign first and then requires a manager to finalize the contract manually.

## Target behavior

### Management onboarding review flow

The final review section on `/management/onboarding-review/:userId` will include an employer signing block with:

- employer agreement checkbox
- employer typed full legal name
- optional drawn employer signature
- clear signature action
- short explanation that this signature will be shown to the employee and used to auto-finalize the contract after the employee signs

When management clicks `Create and send contract`, the flow will:

1. Validate all review sections and contract setup requirements.
2. Validate the employer pre-sign requirements.
3. Save the onboarding review automatically.
4. Create or update the contract draft.
5. Store the employer pre-sign data on the contract.
6. Send the contract email.
7. Update the employee onboarding status to the waiting-for-signature state.

If any step fails, later steps do not run.

### Employee contract signing flow

When the employee opens the contract:

- the contract preview already shows the employer name and employer signature details
- the employee completes the normal employee signature flow

After the employee signs:

- the backend saves the employee signature
- if valid employer pre-sign data already exists, the backend immediately finalizes the contract
- the final PDF is regenerated with both signatures
- the normal finalized-contract downstream effects still run

This means management does not need to return later to finalize the contract manually in the normal onboarding-review-created case.

### Fallback behavior

Existing manual finalize controls remain available for:

- older contracts
- contracts created outside onboarding review
- contracts that do not contain valid employer pre-sign data

## Data model changes

Add support for stored employer pre-sign data on a contract before employee signing is complete.

Required stored fields:

- employer typed signature name
- employer drawn signature image
- employer agreement checkbox text
- employer contract version
- employer document hash
- employer signed manager user id
- employer browser user agent
- employer IP address if currently supported in the same audit shape
- explicit timestamp for pre-sign capture, recommended name: `employerPreparedAt`

The system already stores several employer-side signature audit fields for manual finalization. This design should reuse those fields where possible and only add the minimum extra field needed to distinguish early employer signature capture from later finalization.

## Backend design

### Contract service

Add a backend path that supports storing employer pre-sign data before employee signing without marking the contract as finalized.

Recommended approach:

- add a dedicated contract-service action for storing or updating employer pre-sign data on an existing draft or sent contract
- keep finalization rules honest: pre-sign storage does not set `FINALIZED`
- update employee signing so it auto-finalizes when pre-sign data is already present

### Contract status handling

Statuses remain conceptually correct:

- before employee sign: `SENT_TO_EMPLOYEE`
- after employee sign without employer pre-sign data: existing path can remain `SIGNED` or equivalent employee-signed waiting state
- after employee sign with employer pre-sign data: immediately transition to `FINALIZED`

The current service already supports finalizing only after employee signing. This rule remains true. The difference is that the employer signature package is captured earlier and consumed automatically after employee signing succeeds.

### Finalization trigger

Update employee contract signing logic so that:

- employee signature data is saved first
- the contract checks for valid employer pre-sign data
- if employer pre-sign data exists, the service applies finalization automatically in the same signing flow
- final PDF generation and finalized workflow events run exactly once in that path

### Manual finalize compatibility

Do not remove the current manager finalize endpoint.

Instead:

- keep it as fallback
- allow it to continue working for contracts without pre-sign data
- ensure it naturally becomes unnecessary for auto-finalized onboarding-review contracts

## Frontend design

### Onboarding review page

Extend the existing `Final review decision` card.

Add a new employer signing block below the review decision and note fields and above the final actions.

Fields:

- employer agreement checkbox
- employer typed full legal name
- employer signature canvas
- clear signature button
- explanatory helper text

Validation for `Create and send contract`:

- all existing checklist requirements still apply
- all current contract setup requirements still apply
- employer agreement checkbox must be checked
- employer typed full legal name is required
- drawn employer signature remains optional to match the current finalize behavior unless the business later decides otherwise

Persistence expectations:

- saved onboarding review state should also persist the employer pre-sign draft state or the contract-backed pre-sign state used by the form
- if the page reloads after saving, the reviewer should see the latest employer name and signature state restored

### Auto-save behavior

`Create and send contract` should no longer rely on a separate later save.

It should internally save:

- decision
- admin note
- checked sections
- contract setup draft

This internal save should behave like the explicit `Save review` action, but it runs automatically before send.

### Employee contract page

The contract preview page should render the employer signature and employer typed name before the employee signs when employer pre-sign data already exists.

The page does not need a larger redesign. It only needs to present the already-prepared employer signature information in the contract preview and final PDF output consistently.

## Error handling

If review auto-save fails:

- sending stops
- show a clear message that the review could not be saved

If contract draft creation or update fails:

- sending stops
- keep the saved review state
- show a clear contract error

If employer pre-sign storage fails:

- sending stops
- show a clear error

If contract email sending fails:

- keep earlier successful save operations
- show a clear send error
- do not falsely show the status as sent

If employee signing succeeds but automatic finalization fails:

- keep the employee signature
- surface the contract in a state that management can recover manually
- do not lose employer pre-sign data

## Testing strategy

### Frontend tests

- onboarding review `Create and send contract` auto-saves review before sending
- send action blocks when employer agreement is missing
- send action blocks when employer typed name is missing
- onboarding review reloads persisted employer pre-sign values
- employee-facing contract preview shows employer signature/name when pre-sign data exists

### Backend tests

- storing employer pre-sign data on draft or sent contract succeeds without finalizing
- employee sign auto-finalizes when valid employer pre-sign data exists
- employee sign does not auto-finalize when employer pre-sign data is absent
- final PDF generation includes both signatures after auto-finalize
- existing manual finalize path still works for older contracts

## Risks

- The current contract workflow mixes `SIGNED` and `EMPLOYEE_SIGNED` naming. The implementation must keep behavior consistent and avoid introducing another ambiguous state.
- PDF generation must correctly handle showing employer signature before finalization and in the final signed PDF.
- If onboarding review stores some data in review draft state and some directly on the contract, the restore behavior must be clearly defined to avoid conflicting sources of truth.

## Recommended implementation sequence

1. Add or extend backend contract support for employer pre-sign storage.
2. Update employee sign flow to auto-finalize when employer pre-sign data exists.
3. Extend onboarding review UI with employer signing inputs and validation.
4. Make `Create and send contract` auto-save review before send.
5. Update contract preview and PDF rendering for early employer signature visibility.
6. Keep manual finalize as fallback and add regression coverage.
