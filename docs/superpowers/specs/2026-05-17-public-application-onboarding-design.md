# Public Application And Two-Stage Onboarding Design

Date: 2026-05-17

## Purpose

ParadePaard should separate job application review from employment onboarding.

The first step should be a public application form that collects enough information to decide whether ParadePaard wants to continue with the applicant. Sensitive employment, payroll, bank, and identity details should be collected only after the application is accepted.

This keeps the applicant experience shorter at the start and avoids storing highly sensitive details for people who are denied.

## Current Context

The project already has several parts of the later onboarding and contract flow:

- The employee onboarding page currently collects address and IBAN after a new user logs in.
- The management onboarding page lets an authorized user create an employee and first contract details.
- The onboarding review page shows users who are waiting for profile review or contract review.
- The management user detail page already shows employee profile data, tax profile data, contract status, contract send actions, employer signing, rejection, and finalization.
- The employee contract signing page already handles the user signature flow.

The missing piece is the true application stage before a person becomes an invited employee.

## Product Direction

Use a two-stage flow:

1. Public application.
2. Protected application review.
3. Accepted applicant onboarding.
4. Contract setup and signing.
5. Employer review, employer signing, and locked final contract.

The public application form should not require login. Anyone with the application URL can submit an application.

The review queue and application detail screens must be permission-protected. Only people with application permissions can see applications or decide on them.

Sensitive details should be collected after acceptance, not on the public application form.

## Public Application Page

The public application page should live at a route such as `/apply`.

The page is for people who want to work for ParadePaard. It should be a practical form, not a marketing page.

The page should collect:

- Legal first names.
- Preferred name.
- Middle name prefix.
- Last name.
- Email address.
- Phone number.
- Date of birth.
- Gender.
- Nationality.
- City and country.
- Role or function interest.
- Contract preference, such as on-call, fixed hours, temporary event work, or no preference.
- Earliest available start date.
- Weekly availability or availability notes.
- Whether the applicant has worked for ParadePaard before.
- Relevant experience.
- Languages.
- Relevant certificates or licenses if useful.
- Optional CV upload.
- Optional motivation or notes.
- Consent that ParadePaard may contact the applicant.
- Confirmation that the submitted information is accurate.

The application should submit into an application status such as `APPLICATION_SUBMITTED`.

The applicant may receive a simple confirmation email after submission.

## Application Review

The management area should include an applications review page for users with application permissions.

The queue should show:

- Applicant name.
- Email address.
- Phone number.
- Preferred role or function.
- Contract preference.
- Submitted date.
- Application status.
- Review action.

Opening an application should show the full submitted form grouped into clear sections:

- Personal details.
- Contact details.
- Work interest.
- Availability.
- Experience.
- CV and documents.
- Applicant notes.
- Internal review notes.

Reviewers should be able to:

- Deny the application.
- Accept the application.
- Add an internal note.
- See whether the decision email was sent successfully.

When an application is denied, the application should move to `APPLICATION_DENIED` and the applicant should receive a polite rejection email.

When an application is accepted, the application should move to `APPLICATION_ACCEPTED` and the applicant should receive a follow-up email with the next onboarding step.

## Accepted Applicant Onboarding

After acceptance, the applicant should become an onboarding user and complete the private onboarding page after account activation or login.

This page should replace the current short address and IBAN flow with a fuller employment setup.

The accepted onboarding page should collect:

- Address: street, house number, suffix, postal code, city, and country.
- Bank details: IBAN and account holder name if needed.
- Payroll details: BSN, payroll tax reduction choice, pension participation flag if needed, and payroll notes where appropriate.
- ID verification: document type, document number, issue date, expiration date, issuing country, and ID image upload.
- Emergency contact: name, relationship, phone number, and optional email.
- Final confirmation that the details are complete and accurate.

After submission, the user should move to `PENDING_PROFILE_REVIEW`.

If a reviewer requests changes, the user should move to `CHANGES_REQUESTED`, see the reviewer comment, and be able to update the relevant sections.

## Contract Workflow

Contract setup should remain mostly in the existing management user detail and contract flow.

After the accepted applicant completes sensitive onboarding and the profile is reviewed, a permitted manager finishes contract terms:

- Role or function.
- Contract type.
- Gross hourly wage.
- Payment frequency.
- Start date.
- End date if applicable.
- Travel allowance.
- Other contract terms already supported by the contract flow.

The contract is then sent to the user.

The user reviews and signs the contract on the existing contract signing page.

A user with employer signing permission reviews the employee-signed contract, signs for ParadePaard, and finalizes it.

The finalized contract PDF is locked and the employee becomes active.

## Statuses

The frontend should use readable labels for the workflow states.

Recommended statuses:

- `APPLICATION_SUBMITTED`: public application is waiting for review.
- `APPLICATION_DENIED`: reviewer denied the application.
- `APPLICATION_ACCEPTED`: reviewer accepted the application.
- `PENDING_SETUP`: accepted applicant has an account but still needs private onboarding.
- `PENDING_PROFILE_REVIEW`: applicant submitted private onboarding and waits for review.
- `CHANGES_REQUESTED`: reviewer sent private onboarding back for corrections.
- `PENDING_CONTRACT_SIGNATURE`: contract was sent and waits for employee signature.
- `PENDING_CONTRACT_REVIEW`: employee signed and management must review and sign.
- `ACTIVE`: employer signed and locked the contract.

## Permissions

Application work should be separate from general user management and contract management.

Recommended permissions:

- `CAN_VIEW_APPLICATIONS`: see the applications queue and application details.
- `CAN_REVIEW_APPLICATIONS`: accept or deny applications.

Existing onboarding and contract permissions should continue to control private onboarding review, contract creation, contract sending, employer signing, and finalization.

## Emails

Emails should be attached to visible workflow actions:

- Application submitted: optional confirmation email.
- Application denied: polite rejection email.
- Application accepted: follow-up email with account activation or onboarding link.
- Onboarding changes requested: email telling the accepted applicant to update information.
- Contract sent: email with the signing link.
- Contract finalized: optional confirmation that employment setup is complete.

Each review action should show whether the email was sent successfully. The UI should not show a false success message when delivery fails.

## First Implementation Boundary

The first implementation should include:

- Public application submission with optional CV upload.
- Protected application review queue.
- Protected application detail page.
- Accept and deny actions with email result feedback.
- Accepted applicant path into account activation or private onboarding.
- Expanded accepted onboarding page for sensitive employment details.
- Required route guards and permission-aware navigation.
- Rundown updates that describe the changed frontend behavior.

The first implementation should not include:

- Advanced applicant scoring.
- Interview scheduling.
- Automated reminder campaigns.
- A full document-verification engine.
- Automatic ID validation.

ID upload can be stored and shown as submitted evidence. Manual review is enough for the first version.

## Testing

Testing should cover:

- Public users can open and submit the application page.
- Application submission validates required fields.
- CV upload is optional.
- Users without application permissions cannot see the application queue.
- Users with view permission can see submitted applications.
- Users with review permission can accept or deny applications.
- Denying an application changes the status and shows email result feedback.
- Accepting an application changes the status and creates or starts the onboarding path.
- Accepted onboarding validates required sensitive fields.
- Submitted accepted onboarding moves to profile review.
- Existing contract signing and employer finalization still work.

## Out Of Scope

This design does not decide final backend storage details. It defines the product workflow, frontend screens, data split, permissions, and first implementation boundary.

This design also does not replace the existing contract signing workflow. It extends the onboarding path that leads into that workflow.
