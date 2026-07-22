// Insertable placeholders for preset emails. Resolved server-side at send time by MergeFieldResolver
// (keep this list in sync with the backend). Link fields are inserted as real <a> tags whose href is
// the placeholder; text fields are inserted inline.

export type EmailMergeField = {
    label: string;
    token: string;
    kind: "link" | "text";
    /** Default visible text for link fields. */
    linkText?: string;
};

export const EMAIL_MERGE_FIELDS: EmailMergeField[] = [
    { label: "First name", token: "{{first_name}}", kind: "text" },
    { label: "Full name", token: "{{full_name}}", kind: "text" },
    { label: "Reset password link", token: "{{reset_password_url}}", kind: "link", linkText: "Reset your password" },
    { label: "Log in link", token: "{{login_url}}", kind: "link", linkText: "Log in" },
    { label: "Apply link", token: "{{apply_url}}", kind: "link", linkText: "Apply" },
    { label: "Planning link", token: "{{planning_url}}", kind: "link", linkText: "View your planning" },
    { label: "Account link", token: "{{account_url}}", kind: "link", linkText: "Your account" },
    { label: "Employment link", token: "{{employment_url}}", kind: "link", linkText: "Your employment" },
    { label: "Payslips link", token: "{{payslips_url}}", kind: "link", linkText: "Your payslips" },
    { label: "Messages link", token: "{{messages_url}}", kind: "link", linkText: "Open messages" },
    { label: "Homepage link", token: "{{home_url}}", kind: "link", linkText: "Open ParadePaard" },
];

// Only meaningful in an application acceptance email (Applications → Accept): accepting creates the
// account, so its starting credentials exist at send time. They are resolved server-side from the
// new user's username / temporary password and would be empty anywhere else, so they are offered
// only for acceptance presets (see mergeFieldsFor).
export const ACCEPTANCE_MERGE_FIELDS: EmailMergeField[] = [
    { label: "Username", token: "{{username}}", kind: "text" },
    { label: "Temporary password", token: "{{temporary_password}}", kind: "text" },
];

/** The insertable fields for a preset, given its group + category. */
export function mergeFieldsFor(groupType: string, category: string): EmailMergeField[] {
    if (groupType === "APPLICATIONS" && category === "ACCEPT") {
        return [...EMAIL_MERGE_FIELDS, ...ACCEPTANCE_MERGE_FIELDS];
    }
    return EMAIL_MERGE_FIELDS;
}
