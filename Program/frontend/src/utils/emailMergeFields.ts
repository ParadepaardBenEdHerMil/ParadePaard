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
