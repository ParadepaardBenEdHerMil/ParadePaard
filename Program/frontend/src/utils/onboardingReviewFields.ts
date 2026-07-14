// Canonical registry of the employee-editable onboarding inputs, shared by the admin review
// page (which flags fields) and the employee onboarding form (which shows those flags inline).
// Keeping the keys + step grouping in one place is what lets a flag placed during review land
// on the exact input when the form reopens. Admin-only data (personal identity, contract setup)
// is intentionally absent — the employee cannot change it, so it is not flaggable.

export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

export type OnboardingFieldMeta = {
    label: string;
    section: string;
    step: OnboardingStep;
};

export const ONBOARDING_REVIEW_FIELDS = {
    street: { label: "Street", section: "Address", step: 1 },
    houseNumber: { label: "House number", section: "Address", step: 1 },
    houseNumberSuffix: { label: "House number suffix", section: "Address", step: 1 },
    postalCode: { label: "Postal code", section: "Address", step: 1 },
    city: { label: "City", section: "Address", step: 1 },
    country: { label: "Country", section: "Address", step: 1 },
    iban: { label: "IBAN", section: "Bank details", step: 2 },
    bankAccountHolderName: { label: "Account holder", section: "Bank details", step: 2 },
    bsn: { label: "BSN", section: "Payroll and tax", step: 3 },
    applyLoonheffingskorting: { label: "Apply loonheffingskorting", section: "Payroll and tax", step: 3 },
    payrollNotes: { label: "Payroll notes", section: "Payroll and tax", step: 3 },
    idDocumentType: { label: "Document type", section: "Identification", step: 4 },
    idDocumentNumber: { label: "Document number", section: "Identification", step: 4 },
    idIssueDate: { label: "Issue date", section: "Identification", step: 4 },
    idExpirationDate: { label: "Expiration date", section: "Identification", step: 4 },
    idIssuingCountry: { label: "Issuing country", section: "Identification", step: 4 },
    idDocumentFrontImage: { label: "Front ID document", section: "Identification", step: 4 },
    idDocumentBackImage: { label: "Back ID document", section: "Identification", step: 4 },
    emergencyContactName: { label: "Contact name", section: "Emergency contact", step: 5 },
    emergencyContactRelationship: { label: "Relationship", section: "Emergency contact", step: 5 },
    emergencyContactPhone: { label: "Phone", section: "Emergency contact", step: 5 },
    emergencyContactEmail: { label: "Email", section: "Emergency contact", step: 5 },
} as const satisfies Record<string, OnboardingFieldMeta>;

export type OnboardingReviewFieldKey = keyof typeof ONBOARDING_REVIEW_FIELDS;

export function onboardingFieldMeta(key: string): OnboardingFieldMeta | null {
    return (ONBOARDING_REVIEW_FIELDS as Record<string, OnboardingFieldMeta>)[key] ?? null;
}

// Keeps only known field keys with a non-empty explanation, so callers never persist or send
// stray keys (e.g. from an older client) or empty flags.
export function sanitizeFieldFlags(value: unknown): Record<string, string> {
    if (value == null || typeof value !== "object") return {};
    const record = value as Record<string, unknown>;
    const next: Record<string, string> = {};
    for (const key of Object.keys(ONBOARDING_REVIEW_FIELDS)) {
        const explanation = record[key];
        if (typeof explanation === "string" && explanation.trim().length > 0) {
            next[key] = explanation.trim();
        }
    }
    return next;
}

// Formats a flags map into readable "Section · Field: explanation" lines, ordered by step, for
// the changes email and the employee's summary banner. Unknown keys fall back to the raw key.
export function formatFlagLines(flags: Record<string, string> | null | undefined): string[] {
    if (!flags) return [];
    return Object.entries(flags)
        .filter(([, explanation]) => (explanation ?? "").trim().length > 0)
        .sort((a, b) => (onboardingFieldMeta(a[0])?.step ?? 99) - (onboardingFieldMeta(b[0])?.step ?? 99))
        .map(([key, explanation]) => {
            const meta = onboardingFieldMeta(key);
            const prefix = meta ? `${meta.section} · ${meta.label}` : key;
            return `${prefix}: ${explanation.trim()}`;
        });
}
