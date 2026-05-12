# Contract-Owned Payroll And Onboarding Design

Date: 2026-05-12

## Purpose

ParadePaard should treat the signed employment contract as the source of truth for payroll timing and contract-based pay rules. A payslip should be generated from the active signed contract, worked timesheets, approved allowances, employee payroll details, and company deduction templates.

This design also expands onboarding into a review workflow. An employee should not become fully payroll-active just because they filled in a form. Their profile details, contract, signature, and final management approval should all be visible workflow steps.

## Current Context

The project already has the core services and frontend areas needed for this direction:

- The contract service stores contract fields, including function, wage, dates, contract type, payment frequency, holiday allowance, leave entitlement, travel allowance, and generated PDF data.
- The payroll service already asks the contract service for contract data when generating payslips.
- The payroll scheduler currently uses a user-level `payslipFrequencyMinutes` value with a weekly default.
- The frontend already has employee onboarding, account employment details, management user details, company payroll settings, payslips, and payslip review.

The main problem is ownership. Payroll timing currently behaves like a user setting, but it should be a contract term. The onboarding flow also needs richer review states so managers can approve profile details, send comments back, send contracts, review signatures, and finalize contracts before payroll relies on them.

## Product Decision

The recommended model is contract-owned payroll.

Each signed active contract controls the payroll cycle through a `paymentFrequency` value. Normal production options are:

- `DAILY`
- `WEEKLY`
- `BIWEEKLY`
- `MONTHLY`

The `EVERY_5_MINUTES` option is allowed only for local development and scheduler testing. It should not appear in normal contract forms, normal contract PDFs, or production role flows.

Payroll generation must use the active signed contract covering the pay period. It should not use `user.payslipFrequencyMinutes` as the real payroll rule.

## Onboarding And Contract Workflow

The employee lifecycle should use these steps:

1. A user with onboarding permission invites the employee.
2. The employee receives an email and opens the onboarding flow.
3. The employee completes their profile, payroll details, emergency contact, and documents.
4. A user with onboarding-review permission reviews the submitted profile.
5. The reviewer either requests changes with a comment or approves the profile.
6. After profile approval, a user with contract-management permission generates and sends the contract.
7. The employee reads and signs the contract.
8. A user with contract-review permission reviews the signed contract.
9. The reviewer either rejects it with a comment or finalizes it.
10. A finalized signed contract becomes active for payroll.

This makes onboarding a tracked process instead of a single form submission.

## Employee Onboarding Experience

The employee-facing onboarding flow should be practical and not overly fancy. It should support seasonal, festival, and event staff who need to complete required employment details quickly.

The employee should complete these sections:

- Profile picture, optional.
- Legal name, preferred name, date of birth, and gender.
- Email and mobile phone.
- Address.
- IBAN.
- BSN, only for payroll and tax use.
- Loonheffingskorting choice.
- Employee tax profile flags that payroll needs.
- Emergency contact name, relationship, phone, and optional email.
- ID verification or ID upload step.
- Resume or CV upload, optional.
- Basic availability or work preference notes, optional.

The employee should also have a review-status screen that explains what is happening next. If onboarding is sent back, the employee should see the manager comment and update only the relevant sections.

## Manager Onboarding Experience

The management onboarding area should become a review queue instead of only an invite form.

The queue should show employees by workflow status:

- Invited
- Profile incomplete
- Waiting for profile review
- Changes requested
- Profile approved
- Contract sent
- Waiting for employee signature
- Signed contract waiting for review
- Contract rejected
- Contract finalized
- Active

The profile review page should group information into clear sections:

- Personal details
- Contact details
- Address
- Payroll details
- Emergency contact
- Documents
- Notes and reviewer comments
- Contract proposal

Review actions should be:

- Request changes with a required comment.
- Approve profile.
- Generate or send contract when the profile is approved.

## Contract Access And Contract Statuses

Every employee should be able to view their own contracts from the Account area. This should include current, pending, rejected, expired, and historical contracts.

Useful user-facing statuses are:

- Needs info
- Waiting for profile review
- Changes requested
- Profile approved
- Waiting for contract
- Waiting for signature
- Waiting for management contract approval
- Active
- Rejected
- Expired

The Account Employment area should show the current contract and a contract history list. A pending contract should have a clear sign action when the employee is allowed to sign it. A finalized active contract should have a download PDF action.

The Management User Detail page should show the employee's contract timeline and current contract status. Managers with the right permissions should be able to open profile review, contract review, and contract PDF actions from there.

## Contract PDF

The contract PDF should include the payroll-relevant terms because those terms drive payslip generation.

Important contract PDF fields include:

- Employer and employee details.
- Function or role.
- Contract type.
- Start date and optional end date.
- Work location or location rule.
- Agreed hours or on-call status.
- Gross hourly wage or salary terms.
- Payment frequency.
- Holiday allowance.
- Leave entitlement.
- Travel allowance.
- Probation period if applicable.
- Notice period.
- CAO or collective agreement if applicable.
- Pension scheme if applicable.
- Sickness and absence policy summary.
- Confidentiality clause if applicable.
- Employee and employer signature areas.

Payment frequency must be shown because it is part of the agreement that payroll will later use.

## Payslip Generation

Payroll should generate payslips from the signed active contract, not from user settings.

For each employee and pay period, payroll should gather:

- Contract snapshot: function, wage, agreed hours, contract type, payment frequency, start date, end date, holiday allowance, and travel allowance.
- Timesheets: worked hours in the pay period.
- Approved travel claims and payable allowances.
- Employee payroll details: tax profile, BSN availability, loonheffingskorting choice, and relevant profile flags.
- Company deduction templates: loonheffing, pension, PAWW, HOP, Zvw-style lines, or other configured deductions.
- Payroll review status and release status.

The generated payslip should store the contract values used at generation time. Old payslips must remain historically correct if a contract changes later.

## Pay Period Rules

The scheduler should resolve the active contract and calculate the pay period from `paymentFrequency`.

- `DAILY`: one payroll period per worked day.
- `WEEKLY`: one payroll period per ISO week.
- `BIWEEKLY`: one payroll period for two ISO weeks.
- `MONTHLY`: one payroll period per calendar month.
- `EVERY_5_MINUTES`: local development and testing only.

The scheduler may still tick frequently, but each tick should ask whether a contract-owned pay period is due. The tick interval is not the same thing as the employee's pay frequency.

## Zero-Hour Period Rules

Payroll should not automatically generate a normal released payslip for a period with zero payable value.

The rules should be:

- Zero-hours or on-call contract, no worked or called shifts, and no allowances or corrections: skip the user-facing payslip and store an internal payroll-cycle note saying there were no payable hours for the period.
- Fixed-hours or salary-style contract with zero timesheet hours: create a payroll review item because the employee may still be owed agreed wages.
- On-call employee was called, cancelled late, sick during a call, or has minimum-call pay: do not skip; create a review or pay calculation.
- Travel, holiday pay, correction, bonus, or deduction exists even with zero worked hours: generate or review a payslip because money is still moving.
- Development five-minute schedule: never generate repeated empty zero payslips.

This follows the practical Dutch payroll distinction between payslips for wage/payment changes and internal payroll/tax administration such as a zero declaration when no wages were paid.

## Missing Data And Review Behavior

Payroll should not silently release a payslip when required data is missing. It should create a review item or mark the generated payslip as needing attention.

Review reasons include:

- Missing signed contract.
- Contract does not cover the pay period.
- Contract is signed by employee but not finalized by management.
- Missing timesheet data for a fixed-hours contract.
- Missing employee payroll tax profile.
- Missing BSN or missing ID verification.
- Travel claim still pending review.
- Company deduction templates could not be loaded.
- Contract frequency is invalid for production.

The payroll review screen should show these reasons in plain language so payroll users can decide whether to correct data, send the contract back, or release a corrected payslip.

## Permissions

The new flow needs action-level permissions so onboarding, contract, and payroll work can be split between roles.

Recommended permissions:

- `CAN_VIEW_OWN_CONTRACTS`: employee can see and download their own contracts.
- `CAN_SIGN_OWN_CONTRACTS`: employee can sign contracts sent to them.
- `CAN_VIEW_ONBOARDING_QUEUE`: manager can see onboarding submissions.
- `CAN_REVIEW_ONBOARDING`: manager can approve onboarding or send it back with comments.
- `CAN_MANAGE_CONTRACTS`: manager can create, edit, generate, and send contracts.
- `CAN_REVIEW_CONTRACTS`: manager can review signed contracts.
- `CAN_FINALIZE_CONTRACT`: manager can approve a signed contract so it becomes payroll-active.
- `CAN_VIEW_ALL_CONTRACTS`: manager can see contracts across employees.
- `CAN_VIEW_ALL_PAYSLIPS`: payroll user can see company payslips.
- `CAN_REVIEW_PAYSLIPS`: payroll user can handle generated payslip issues.
- `CAN_MANAGE_PAYSLIPS`: payroll user can edit, approve, and release payslips.

The default employee role should include:

- `CAN_VIEW_OWN_CONTRACTS`
- `CAN_SIGN_OWN_CONTRACTS`
- `CAN_VIEW_PAYSLIPS`
- `CAN_REPORT_PAYSLIP_ERRORS`

Manager roles should receive only the actions they need. A user who reviews onboarding does not automatically need permission to edit payroll tax templates or release payslips.

## Frontend Impact

The frontend should show the workflow as visible statuses and action queues.

Employee-facing areas:

- Onboarding becomes a multi-section profile completion flow.
- Onboarding shows comments when a manager requests changes.
- Account Employment shows current contract, contract status, contract history, payment frequency, PDF download, and signing action when applicable.
- Payslips remain visible to employees only when released or approved.

Management-facing areas:

- Management Onboarding gets a queue view and profile review detail.
- Management User Detail shows onboarding status, contract timeline, and payroll readiness.
- Contract review queue shows signed contracts waiting for management decision.
- Payslip review explains missing contract or payroll-readiness issues.
- Company settings keeps tax templates and payroll workflow controls, but employee-specific payment frequency is no longer edited there.

## Backend And Data Impact

The backend should move payroll frequency ownership from user-level data to contract-level data.

Important backend changes:

- Keep `paymentFrequency` on contracts and expose it consistently in REST and gRPC contract responses.
- Add contract workflow statuses for profile approval, contract sent, employee signed, rejected, finalized, active, and expired.
- Store signatures and manager review decisions separately from the generated PDF bytes.
- Make payroll scheduler resolve active signed contracts before generating payslips.
- Store a contract snapshot on each generated payslip.
- Add internal payroll-cycle notes for skipped zero-pay periods.
- Deprecate `payslipFrequencyMinutes` as a production payroll rule.

## Testing

The implementation should include focused tests for:

- Contract frequency mapping to pay periods.
- Scheduler does not use user-level `payslipFrequencyMinutes` for production pay rules.
- Missing signed contract creates a payroll review item.
- Zero-hour on-call period with no payable value skips user-facing payslip generation.
- Fixed-hours contract with zero timesheet hours creates a review item.
- Contract snapshot values remain stable after contract edits.
- Employee can see own contracts but not other employees' contracts.
- Onboarding reviewer can request changes without contract-management permission.
- Contract finalizer can finalize a signed contract without broad payroll-management permission.
- Payslip reviewer sees missing-contract and missing-profile reasons.

## External Guidance Used

This design is aligned with public Dutch employment and payroll guidance:

- Rijksoverheid guidance that employment contracts normally include work, salary, hours, holidays, notice period, pension, and applicable collective agreement details: https://www.rijksoverheid.nl/vraag-en-antwoord/arbeidsovereenkomst-en-cao/wat-staat-er-in-een-arbeidsovereenkomst
- Rijksoverheid guidance that employers must verify employee identity and keep the required ID copy for payroll/employment administration: https://www.rijksoverheid.nl/onderwerpen/identificatieplicht/vraag-en-antwoord/wat-moet-ik-als-werkgever-doen-om-te-voldoen-aan-de-identificatieplicht
- Autoriteit Persoonsgegevens guidance that BSN should be used only where legally required, such as payroll/tax administration: https://autoriteitpersoonsgegevens.nl/en/themes/identification/citizen-service-number-bsn/bsn-at-work
- Business.gov.nl guidance that Dutch payslips relate to salary payments and include contract and pay-period information: https://business.gov.nl/staff/personnel-costs-and-salary/salary-and-payslip/
- Business.gov.nl guidance on zero-hours and on-call contract expectations: https://business.gov.nl/staff/employing-staff/hiring-on-call-employees-with-a-zero-hours-contract/

## Out Of Scope

This design does not implement a full Dutch tax calculation engine. The existing company deduction-template approach can continue as the first version, with clear review states when payroll information is incomplete.

This design also does not require a fancy onboarding experience. The intended UI is practical, section-based, and optimized for event and festival staff completing required employment details quickly.
