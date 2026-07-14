// Shared, framework-free document model + renderer for the admin "document preview"
// feature. A DocumentModel is a plain, printable description of a record (job
// application, employee account, onboarding review). `documentToHtml` turns it into a
// single self-contained HTML string that is used three ways:
//   1. shown on screen inside an <iframe srcDoc> (the preview),
//   2. printed to PDF via the iframe's window.print(),
//   3. downloaded as a Word-openable .doc file (HTML is a format Word imports).
// Keeping the renderer here (not in a component) makes it easy to unit test and keeps
// the exported bytes identical to what the user previews.

import { formatDate, formatMaybeDateTime } from "./dateFormat";
import { userStatusLabel } from "./userStatus";
import type { JobApplicationResponseDTO, UserResponseDTO } from "../services/user-service/Types";
import type { ContractResponseDTO } from "../services/user-service/GetContracts";

export type DocRow = { label: string; value: string };

// A section is either a label/value grid or a free-text block (used for notes that
// may run long and contain line breaks).
export type DocSection =
    | { heading: string; rows: DocRow[] }
    | { heading: string; text: string };

export type DocumentModel = {
    /** Eyebrow/brand line above the title. Defaults to "ParadePaard". */
    brand?: string;
    /** Main document title, e.g. "Job application". */
    title: string;
    /** Optional subtitle, e.g. the person's name. */
    subtitle?: string;
    /** Small key facts shown under the title (status, key dates). */
    meta?: DocRow[];
    sections: DocSection[];
    /** Small print at the bottom of every page, e.g. a confidentiality note. */
    footerNote?: string;
};

const MISSING = "-";
const IDENTIFICATION_MASK = "•••••";

const moneyFormatter = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Normalises the loose value types the pages hold into display text, matching the
// "-" for empty / "Yes"-"No" for booleans convention used across the detail pages.
function text(value: string | number | boolean | null | undefined): string {
    if (value === null || value === undefined || value === "") return MISSING;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
}

function dateText(value?: string | null): string {
    return value ? formatDate(value) : MISSING;
}

function dateTimeText(value?: string | null): string {
    return value ? formatMaybeDateTime(value) : MISSING;
}

function moneyText(value?: number | null): string {
    return value == null || !Number.isFinite(value) ? MISSING : moneyFormatter.format(Number(value));
}

// Identification fields (BSN, ID document) are permission-gated. When the reviewer
// cannot see them we mask any present value but keep the "-" empty-state so the row
// still reads as "missing" rather than "hidden" when there is genuinely no value.
function maskText(value: string | null | undefined, canView: boolean): string {
    const resolved = text(value);
    if (canView) return resolved;
    return resolved === MISSING ? MISSING : IDENTIFICATION_MASK;
}

function personFullName(user: UserResponseDTO): string {
    const parts = [user.firstNames, user.middleNamePrefix, user.lastName]
        .map((part) => (part ?? "").trim())
        .filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    const preferred = (user.preferredName ?? "").trim();
    return preferred || user.email;
}

function applicationFullName(application: JobApplicationResponseDTO): string {
    const parts = [application.firstNames, application.middleNamePrefix, application.lastName]
        .map((part) => (part ?? "").trim())
        .filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : application.email;
}

// ---------------------------------------------------------------------------
// Model builders
// ---------------------------------------------------------------------------

export function buildApplicationDocument(application: JobApplicationResponseDTO): DocumentModel {
    const sections: DocSection[] = [
        {
            heading: "Personal details",
            rows: [
                { label: "First names", value: text(application.firstNames) },
                { label: "Preferred name", value: text(application.preferredName) },
                { label: "Prefix", value: text(application.middleNamePrefix) },
                { label: "Surname", value: text(application.lastName) },
                { label: "Date of birth", value: dateText(application.dateOfBirth) },
                { label: "Gender", value: text(application.gender) },
                { label: "Nationality", value: text(application.nationality) },
                { label: "Worked for us before", value: text(application.workedForUsBefore) },
            ],
        },
        {
            heading: "Contact details",
            rows: [
                { label: "Email address", value: text(application.email) },
                { label: "Phone number", value: text(application.phoneNumber) },
                { label: "City", value: text(application.city) },
                { label: "Country", value: text(application.country) },
            ],
        },
        {
            heading: "Work interest",
            rows: [
                { label: "Role interest", value: text(application.roleInterest) },
                { label: "Contract preference", value: text(application.contractPreference) },
                { label: "Available from", value: dateText(application.availableFrom) },
            ],
        },
        {
            heading: "Application files",
            rows: [
                { label: "CV file", value: text(application.cvFileName) },
                { label: "Profile picture file", value: text(application.profilePictureFileName) },
            ],
        },
        {
            heading: "Applicant confirmation",
            rows: [
                { label: "Consent to contact", value: text(application.contactConsent) },
                { label: "Information accurate", value: text(application.informationAccurate) },
            ],
        },
    ];

    if ((application.note ?? "").trim()) {
        sections.push({ heading: "Applicant note", text: application.note ?? "" });
    }

    sections.push({
        heading: "Internal review",
        rows: [
            { label: "Stored review note", value: text(application.reviewNote) },
            { label: "Reviewed at", value: dateTimeText(application.reviewedAt) },
            { label: "Accepted user id", value: text(application.acceptedUserId) },
        ],
    });

    return {
        title: "Job application",
        subtitle: applicationFullName(application),
        meta: [
            { label: "Status", value: text(application.status) },
            { label: "Submitted", value: dateTimeText(application.submittedAt) },
            {
                label: "Decision email",
                value:
                    application.decisionEmailSent === true
                        ? "Sent"
                        : application.decisionEmailSent === false
                          ? "Pending"
                          : MISSING,
            },
        ],
        sections,
        footerNote: "Confidential — applicant data. Generated from ParadePaard.",
    };
}

// The employee-profile sections are shared by the account document and the onboarding
// review document (both describe the same person). `canViewIdentification` masks the
// BSN and ID-document fields for reviewers who lack that permission.
export function buildEmployeeProfileSections(
    user: UserResponseDTO,
    options: { canViewIdentification: boolean }
): DocSection[] {
    const canView = options.canViewIdentification;
    return [
        {
            heading: "Personal information",
            rows: [
                { label: "Full name", value: personFullName(user) },
                { label: "Preferred name", value: text(user.preferredName) },
                { label: "First names", value: text(user.firstNames) },
                { label: "Prefix", value: text(user.middleNamePrefix) },
                { label: "Last name", value: text(user.lastName) },
                { label: "Gender", value: text(user.gender) },
                { label: "Date of birth", value: dateText(user.dateOfBirth) },
                { label: "Nationality", value: text(user.nationality) },
                { label: "Email", value: text(user.email) },
                { label: "Mobile", value: text(user.mobileNumber) },
            ],
        },
        {
            heading: "Address",
            rows: [
                { label: "Street", value: text(user.street) },
                { label: "House number", value: text(user.houseNumber) },
                { label: "House number suffix", value: text(user.houseNumberSuffix) },
                { label: "Postal code", value: text(user.postalCode) },
                { label: "City", value: text(user.city) },
                { label: "Country", value: text(user.country) },
            ],
        },
        {
            heading: "Identification",
            rows: [
                { label: "Document type", value: maskText(user.idDocumentType, canView) },
                { label: "Document number", value: maskText(user.idDocumentNumber, canView) },
                { label: "Issue date", value: canView ? dateText(user.idIssueDate) : maskText(user.idIssueDate, canView) },
                {
                    label: "Expiration date",
                    value: canView ? dateText(user.idExpirationDate) : maskText(user.idExpirationDate, canView),
                },
                { label: "Issuing country", value: maskText(user.idIssuingCountry, canView) },
            ],
        },
        {
            heading: "Bank details",
            rows: [
                { label: "IBAN", value: text(user.iban) },
                { label: "Account holder", value: text(user.bankAccountHolderName) },
            ],
        },
        {
            heading: "Emergency contact",
            rows: [
                { label: "Contact name", value: text(user.emergencyContactName) },
                { label: "Relationship", value: text(user.emergencyContactRelationship) },
                { label: "Phone", value: text(user.emergencyContactPhone) },
                { label: "Email", value: text(user.emergencyContactEmail) },
            ],
        },
        {
            heading: "Tax information",
            rows: [
                { label: "BSN", value: maskText(user.employeeTaxProfile?.bsn, canView) },
                { label: "Apply loonheffingskorting", value: text(user.employeeTaxProfile?.applyLoonheffingskorting) },
                { label: "Pension participant", value: text(user.employeeTaxProfile?.pensionParticipant) },
                { label: "Special Zvw contribution", value: text(user.employeeTaxProfile?.specialZvwContribution) },
                { label: "Payroll notes", value: text(user.employeeTaxProfile?.payrollNotes) },
            ],
        },
    ];
}

export function buildContractSection(contract: ContractResponseDTO | null): DocSection {
    if (!contract) {
        return { heading: "Contract", rows: [{ label: "Contract", value: "No contract on file" }] };
    }
    return {
        heading: "Contract",
        rows: [
            { label: "Position", value: text(contract.functionName) },
            { label: "Gross hourly wage", value: moneyText(contract.grossHourlyWage) },
            { label: "Contract type", value: text(contract.contractType) },
            { label: "Contract status", value: text(contract.status) },
            { label: "Payment frequency", value: text(contract.paymentFrequency) },
            { label: "Start date", value: dateText(contract.startDate) },
            { label: "End date", value: contract.endDate ? dateText(contract.endDate) : "Open-ended" },
            {
                label: "Holiday allowance",
                value: contract.holidayAllowancePercentage != null ? `${contract.holidayAllowancePercentage}%` : MISSING,
            },
            { label: "Weekly hours", value: text(contract.weeklyHours) },
            { label: "Sent to employee", value: dateTimeText(contract.sentToEmployeeAt) },
            { label: "Employee signed", value: dateTimeText(contract.employeeSignedAt) },
            { label: "Finalized", value: dateTimeText(contract.finalizedAt) },
            { label: "Employer signature", value: text(contract.employerTypedSignatureName) },
            { label: "Review comment", value: text(contract.reviewComment) },
        ],
    };
}

export function buildAccountDocument(input: {
    user: UserResponseDTO;
    contract: ContractResponseDTO | null;
    canViewIdentification: boolean;
    accountDisabled?: boolean | null;
    roles?: string[];
}): DocumentModel {
    const { user, contract, canViewIdentification, accountDisabled, roles } = input;
    const sections = buildEmployeeProfileSections(user, { canViewIdentification });
    sections.push(buildContractSection(contract));
    if (roles && roles.length > 0) {
        sections.push({ heading: "Roles", rows: [{ label: "Assigned roles", value: roles.join(", ") }] });
    }

    return {
        title: "Employee account",
        subtitle: personFullName(user),
        meta: [
            {
                label: "Status",
                value: userStatusLabel(user.status, accountDisabled == null ? undefined : { disabled: accountDisabled }),
            },
            { label: "Registered", value: dateTimeText(user.registeredDate) },
            { label: "Position", value: text(contract?.functionName ?? user.position) },
        ],
        sections,
        footerNote: "Confidential — employee data. Generated from ParadePaard.",
    };
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

function renderMeta(meta: DocRow[]): string {
    if (meta.length === 0) return "";
    const items = meta
        .map(
            (row) =>
                `<div class="doc-meta-item"><span class="doc-meta-label">${escapeHtml(
                    row.label
                )}</span><span class="doc-meta-value">${escapeHtml(row.value)}</span></div>`
        )
        .join("");
    return `<div class="doc-meta">${items}</div>`;
}

function renderSection(section: DocSection): string {
    const heading = `<h2 class="doc-section-title">${escapeHtml(section.heading)}</h2>`;
    if ("text" in section) {
        const body = escapeHtml(section.text).replace(/\r?\n/g, "<br />");
        return `<section class="doc-section doc-section--text">${heading}<p class="doc-text">${body}</p></section>`;
    }
    const rows = section.rows
        .map(
            (row) =>
                `<div class="doc-row"><div class="doc-label">${escapeHtml(
                    row.label
                )}</div><div class="doc-value">${escapeHtml(row.value)}</div></div>`
        )
        .join("");
    return `<section class="doc-section"><h2 class="doc-section-title">${escapeHtml(
        section.heading
    )}</h2><div class="doc-grid">${rows}</div></section>`;
}

const DOCUMENT_CSS = `
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0;
    background: #eef1f5;
    color: #1f2937;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.5;
  }
  .doc {
    max-width: 820px;
    margin: 24px auto;
    background: #ffffff;
    padding: 40px 44px;
    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.12);
  }
  .doc-header { border-bottom: 3px solid #2F6BFF; padding-bottom: 16px; margin-bottom: 20px; }
  .doc-brand {
    font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #2F6BFF;
  }
  .doc-title { font-size: 26px; font-weight: 700; margin: 6px 0 2px; color: #0f172a; }
  .doc-subtitle { font-size: 15px; color: #475569; margin: 0; }
  .doc-generated { font-size: 11px; color: #94a3b8; margin-top: 8px; }
  .doc-meta { display: flex; flex-wrap: wrap; gap: 10px 28px; margin-top: 14px; }
  .doc-meta-item { display: flex; flex-direction: column; }
  .doc-meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; }
  .doc-meta-value { font-size: 13px; font-weight: 600; color: #1f2937; }
  .doc-section { margin-top: 22px; break-inside: avoid; }
  .doc-section-title {
    font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    color: #2F6BFF; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0;
  }
  .doc-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 32px; }
  .doc-row {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    padding: 6px 0; border-bottom: 1px solid #f1f5f9; break-inside: avoid;
  }
  .doc-label { color: #64748b; }
  .doc-value { color: #0f172a; font-weight: 600; text-align: right; word-break: break-word; }
  .doc-text { white-space: normal; color: #1f2937; margin: 0; }
  .doc-footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; }
  @page { size: A4; margin: 16mm; }
  @media print {
    body { background: #ffffff; }
    .doc { margin: 0; max-width: none; box-shadow: none; padding: 0; }
  }
`;

export function documentToHtml(model: DocumentModel, options?: { generatedOn?: Date }): string {
    const brand = model.brand ?? "ParadePaard";
    const generatedOn = options?.generatedOn ?? new Date();
    const generatedLabel = formatMaybeDateTime(generatedOn.toISOString());
    const subtitle = model.subtitle ? `<p class="doc-subtitle">${escapeHtml(model.subtitle)}</p>` : "";
    const meta = model.meta ? renderMeta(model.meta) : "";
    const body = model.sections.map(renderSection).join("");
    const footer = model.footerNote ? `<div class="doc-footer">${escapeHtml(model.footerNote)}</div>` : "";

    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(model.title)}${model.subtitle ? ` — ${escapeHtml(model.subtitle)}` : ""}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>${DOCUMENT_CSS}</style>
</head>
<body>
<div class="WordSection1">
<div class="doc">
<header class="doc-header">
<div class="doc-brand">${escapeHtml(brand)}</div>
<h1 class="doc-title">${escapeHtml(model.title)}</h1>
${subtitle}
<div class="doc-generated">Generated ${escapeHtml(generatedLabel)}</div>
${meta}
</header>
${body}
${footer}
</div>
</div>
</body>
</html>`;
}

// Suggests a safe, readable file base name (no extension) from a person/record name.
export function documentFileBaseName(prefix: string, name?: string | null): string {
    const slug = (name ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug ? `${prefix}-${slug}` : prefix;
}
