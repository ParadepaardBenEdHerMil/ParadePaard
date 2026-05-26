import React, { useState } from "react";
import { UserServices, type JobApplicationRequestDTO } from "../services/user-service/UserServices";
import { normalizeDateInput } from "../utils/dateInput";
import "../stylesheets/Application.css";

type ApplicationProps = {
    initialSubmitted?: boolean;
};

type ApplicationFormState = {
    firstNames: string;
    preferredName: string;
    middleNamePrefix: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    dateOfBirth: string;
    gender: string;
    nationality: string;
    city: string;
    country: string;
    roleInterest: string;
    contractPreference: string;
    availableFrom: string;
    note: string;
    workedForUsBefore: boolean;
    contactConsent: boolean;
    informationAccurate: boolean;
};

const initialFormState: ApplicationFormState = {
    firstNames: "",
    preferredName: "",
    middleNamePrefix: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    dateOfBirth: "",
    gender: "",
    nationality: "",
    city: "",
    country: "",
    roleInterest: "",
    contractPreference: "",
    availableFrom: "",
    note: "",
    workedForUsBefore: false,
    contactConsent: false,
    informationAccurate: false,
};

function emptyToNull(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function displayDateToIsoDate(value: string): string {
    const trimmed = value.trim();
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);

    if (!match) {
        return trimmed;
    }

    const [, dayText, monthText, yearText] = match;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = Number(yearText);
    const daysInMonth = new Date(year, month, 0).getDate();

    if (month < 1 || month > 12 || day < 1 || day > daysInMonth) {
        return trimmed;
    }

    return `${yearText}-${monthText}-${dayText}`;
}

export function formatApplicationDateEntry(value: string): string {
    return normalizeDateInput(value);
}

export function toApplicationPayload(form: ApplicationFormState): JobApplicationRequestDTO {
    return {
        firstNames: form.firstNames.trim(),
        preferredName: emptyToNull(form.preferredName),
        middleNamePrefix: emptyToNull(form.middleNamePrefix),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
        dateOfBirth: displayDateToIsoDate(form.dateOfBirth),
        gender: emptyToNull(form.gender),
        nationality: emptyToNull(form.nationality),
        city: emptyToNull(form.city),
        country: emptyToNull(form.country),
        roleInterest: form.roleInterest.trim(),
        contractPreference: form.contractPreference,
        availableFrom: emptyToNull(displayDateToIsoDate(form.availableFrom)),
        note: emptyToNull(form.note),
        workedForUsBefore: form.workedForUsBefore,
        contactConsent: form.contactConsent,
        informationAccurate: form.informationAccurate,
    };
}

export async function submitApplicationForm(
    payload: JobApplicationRequestDTO,
    cvFile: File | null = null
) {
    return await UserServices.submitApplication(payload, cvFile);
}

export default function Application({ initialSubmitted = false }: ApplicationProps) {
    const [form, setForm] = useState<ApplicationFormState>(initialFormState);
    const [cvFile, setCvFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(initialSubmitted);
    const [error, setError] = useState<string | null>(null);

    function updateField<K extends keyof ApplicationFormState>(
        field: K,
        value: ApplicationFormState[K]
    ) {
        setForm((current) => ({ ...current, [field]: value }));
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            await submitApplicationForm(toApplicationPayload(form), cvFile);
            setSubmitted(true);
        } catch (err: unknown) {
            const message = err instanceof Error
                ? err.message
                : "We could not submit your application. Please try again.";
            setError(message);
        } finally {
            setSubmitting(false);
        }
    }

    function handleCvChange(event: React.ChangeEvent<HTMLInputElement>) {
        setCvFile(event.target.files?.[0] ?? null);
    }

    if (submitted) {
        return (
            <main className="applicationPage">
                <section className="applicationShell applicationSuccess">
                    <p className="applicationEyebrow">ParadePaard application</p>
                    <h1>Application submitted</h1>
                    <p>
                        Thank you for applying. ParadePaard will review your basic details and work
                        interest before asking for any sensitive onboarding information.
                    </p>
                </section>
            </main>
        );
    }

    return (
        <main className="applicationPage">
            <div className="applicationShell">
                <header className="applicationHeader">
                    <p className="applicationEyebrow">ParadePaard application</p>
                    <h1>Apply to work with us</h1>
                    <p>
                        Share your contact details, role interest, availability, and optional CV.
                        Employment, bank, tax, and identity details are handled later if your
                        application continues.
                    </p>
                </header>

                <form className="applicationForm" onSubmit={handleSubmit}>
                    <section className="applicationSection">
                        <h2>Personal details</h2>
                        <div className="applicationGrid">
                            <label>
                                <span>Full first names</span>
                                <input
                                    required
                                    autoComplete="given-name"
                                    placeholder="Jan Jeroen"
                                    value={form.firstNames}
                                    onChange={(event) => updateField("firstNames", event.target.value)}
                                />
                            </label>
                            <label>
                                <span>Preferred name</span>
                                <input
                                    autoComplete="nickname"
                                    placeholder="Jan"
                                    value={form.preferredName}
                                    onChange={(event) => updateField("preferredName", event.target.value)}
                                />
                            </label>
                            <label>
                                <span>Prefix</span>
                                <input
                                    autoComplete="additional-name"
                                    placeholder="van"
                                    value={form.middleNamePrefix}
                                    onChange={(event) => updateField("middleNamePrefix", event.target.value)}
                                />
                            </label>
                            <label>
                                <span>Surname</span>
                                <input
                                    required
                                    autoComplete="family-name"
                                    placeholder="Dijk"
                                    value={form.lastName}
                                    onChange={(event) => updateField("lastName", event.target.value)}
                                />
                            </label>
                            <label>
                                <span>Email address</span>
                                <input
                                    required
                                    type="email"
                                    autoComplete="email"
                                    value={form.email}
                                    onChange={(event) => updateField("email", event.target.value)}
                                />
                            </label>
                            <label>
                                <span>Phone number</span>
                                <input
                                    required
                                    type="tel"
                                    autoComplete="tel"
                                    value={form.phoneNumber}
                                    onChange={(event) => updateField("phoneNumber", event.target.value)}
                                />
                            </label>
                            <label>
                                <span>Date of birth</span>
                                <input
                                    required
                                    type="text"
                                    inputMode="numeric"
                                    pattern="\d{2}/\d{2}/\d{4}"
                                    placeholder="dd/mm/yyyy"
                                    title="Use dd/mm/yyyy"
                                    value={form.dateOfBirth}
                                    onChange={(event) => updateField("dateOfBirth", formatApplicationDateEntry(event.target.value))}
                                />
                            </label>
                            <label>
                                <span>Gender</span>
                                <select
                                    value={form.gender}
                                    onChange={(event) => updateField("gender", event.target.value)}
                                >
                                    <option value="">Prefer not to say yet</option>
                                    <option value="Female">Female</option>
                                    <option value="Male">Male</option>
                                    <option value="Non-binary">Non-binary</option>
                                    <option value="Other">Other</option>
                                </select>
                            </label>
                            <label>
                                <span>Nationality</span>
                                <input
                                    autoComplete="country-name"
                                    value={form.nationality}
                                    onChange={(event) => updateField("nationality", event.target.value)}
                                />
                            </label>
                            <label>
                                <span>Current city</span>
                                <input
                                    autoComplete="address-level2"
                                    value={form.city}
                                    onChange={(event) => updateField("city", event.target.value)}
                                />
                            </label>
                            <label>
                                <span>Current country</span>
                                <input
                                    autoComplete="country-name"
                                    value={form.country}
                                    onChange={(event) => updateField("country", event.target.value)}
                                />
                            </label>
                        </div>
                    </section>

                    <section className="applicationSection">
                        <h2>Work interest</h2>
                        <div className="applicationGrid">
                            <label>
                                <span>Role interest</span>
                                <input
                                    required
                                    value={form.roleInterest}
                                    onChange={(event) => updateField("roleInterest", event.target.value)}
                                />
                            </label>
                            <label>
                                <span>Contract preference</span>
                                <select
                                    required
                                    value={form.contractPreference}
                                    onChange={(event) => updateField("contractPreference", event.target.value)}
                                >
                                    <option value="">Select a preference</option>
                                    <option value="On-call">On-call</option>
                                    <option value="Fixed hours">Fixed hours</option>
                                    <option value="Temporary event work">Temporary event work</option>
                                    <option value="No preference">No preference</option>
                                </select>
                            </label>
                            <label>
                                <span>Availability/start date</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="\d{2}/\d{2}/\d{4}"
                                    placeholder="dd/mm/yyyy"
                                    title="Use dd/mm/yyyy"
                                    value={form.availableFrom}
                                    onChange={(event) => updateField("availableFrom", formatApplicationDateEntry(event.target.value))}
                                />
                            </label>
                            <label className="applicationCheck applicationFullWidth">
                                <input
                                    type="checkbox"
                                    checked={form.workedForUsBefore}
                                    onChange={(event) => updateField("workedForUsBefore", event.target.checked)}
                                />
                                <span>Worked for ParadePaard before</span>
                            </label>
                            <div className="applicationFileField applicationFullWidth">
                                <span className="applicationFileLabel">CV upload</span>
                                <label className="applicationFilePicker">
                                    <input
                                        type="file"
                                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                        onChange={handleCvChange}
                                    />
                                    <span className="applicationFileButton">Choose CV file</span>
                                    <span className="applicationFileName">{cvFile?.name ?? "No file selected"}</span>
                                </label>
                            </div>
                        </div>
                    </section>

                    <section className="applicationSection">
                        <h2>Note</h2>
                        <label>
                            <span>Note</span>
                            <textarea
                                rows={4}
                                value={form.note}
                                onChange={(event) => updateField("note", event.target.value)}
                            />
                        </label>
                    </section>

                    <section className="applicationSection">
                        <h2>Confirmation</h2>
                        <label className="applicationCheck">
                            <input
                                required
                                type="checkbox"
                                checked={form.contactConsent}
                                onChange={(event) => updateField("contactConsent", event.target.checked)}
                            />
                            <span>I agree that ParadePaard may contact me about this application.</span>
                        </label>
                        <label className="applicationCheck">
                            <input
                                required
                                type="checkbox"
                                checked={form.informationAccurate}
                                onChange={(event) => updateField("informationAccurate", event.target.checked)}
                            />
                            <span>I confirm that the information I submitted is accurate.</span>
                        </label>
                    </section>

                    {error && <p className="applicationError" role="alert">{error}</p>}

                    <div className="applicationActions">
                        <button type="submit" disabled={submitting}>
                            {submitting ? "Submitting..." : "Submit application"}
                        </button>
                    </div>
                </form>
            </div>
        </main>
    );
}
