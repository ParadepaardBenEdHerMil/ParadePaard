import React, { useEffect, useState } from "react";
import FunctionPicker from "../components/common/FunctionPicker";
import ProfilePictureCropper from "../components/common/ProfilePictureCropper";
import { UserServices, type JobApplicationRequestDTO } from "../services/user-service/UserServices";
import { normalizeDateInput, parseDisplayDate } from "../utils/dateInput";
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

const MAX_PROFILE_PICTURE_BYTES = 2_000_000;
// Matches the backend's per-file cap (spring.servlet.multipart.max-file-size=15MB).
// Without this, a large CV sails past the picture check and is rejected only at the
// nginx edge as a raw 413 HTML page — so we stop it here with a readable message.
const MAX_CV_BYTES = 15_000_000;

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
    profilePicture: File,
    cvFile: File | null = null
) {
    return await UserServices.submitApplication(payload, profilePicture, cvFile);
}

function validateProfilePicture(file: File | null): string | null {
    if (!file) {
        return "Profile picture is required.";
    }
    if (!file.type.startsWith("image/")) {
        return "Profile picture must be an image.";
    }
    if (file.size > MAX_PROFILE_PICTURE_BYTES) {
        return "Profile picture is too large. Use a file up to 2 MB.";
    }
    return null;
}

// The CV is optional, so a null file is valid; only a present, oversized file is an error.
function validateCv(file: File | null): string | null {
    if (file && file.size > MAX_CV_BYTES) {
        return "CV file is too large. Use a file up to 15 MB.";
    }
    return null;
}

export default function Application({ initialSubmitted = false }: ApplicationProps) {
    const [form, setForm] = useState<ApplicationFormState>(initialFormState);
    const [profilePicture, setProfilePicture] = useState<File | null>(null);
    const [profilePicturePreviewUrl, setProfilePicturePreviewUrl] = useState<string | null>(null);
    const [profilePictureError, setProfilePictureError] = useState<string | null>(null);
    const [profilePictureSourceFile, setProfilePictureSourceFile] = useState<File | null>(null);
    const [cvFile, setCvFile] = useState<File | null>(null);
    const [cvError, setCvError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(initialSubmitted);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!profilePicture) {
            setProfilePicturePreviewUrl(null);
            return;
        }

        const objectUrl = URL.createObjectURL(profilePicture);
        setProfilePicturePreviewUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [profilePicture]);

    function updateField<K extends keyof ApplicationFormState>(
        field: K,
        value: ApplicationFormState[K]
    ) {
        setForm((current) => ({ ...current, [field]: value }));
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        const pictureValidationError = validateProfilePicture(profilePicture);
        setProfilePictureError(pictureValidationError);
        if (pictureValidationError || !profilePicture) {
            return;
        }

        const cvValidationError = validateCv(cvFile);
        setCvError(cvValidationError);
        if (cvValidationError) {
            return;
        }

        // Catch a bad date here (e.g. someone typing the US-style 11/30/2004) with a clear
        // message instead of silently sending an unparseable value that the backend rejects.
        if (!parseDisplayDate(form.dateOfBirth)) {
            setError("Please enter your date of birth as a valid date in dd/mm/yyyy format.");
            return;
        }
        if (form.availableFrom.trim() && !parseDisplayDate(form.availableFrom)) {
            setError("Please enter your available-from date as a valid date in dd/mm/yyyy format, or leave it empty.");
            return;
        }

        setSubmitting(true);

        try {
            await submitApplicationForm(toApplicationPayload(form), profilePicture, cvFile);
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
        const nextFile = event.target.files?.[0] ?? null;
        setCvFile(nextFile);
        setCvError(validateCv(nextFile));
    }

    function handleProfilePictureChange(event: React.ChangeEvent<HTMLInputElement>) {
        const nextFile = event.target.files?.[0] ?? null;
        const nextError = validateProfilePicture(nextFile);
        setProfilePictureError(nextError);
        if (nextError || !nextFile) {
            setProfilePictureSourceFile(null);
            return;
        }

        setProfilePictureSourceFile(nextFile);
        event.target.value = "";
    }

    function handleProfileCropComplete(croppedFile: File) {
        setProfilePicture(croppedFile);
        setProfilePictureError(null);
        setProfilePictureSourceFile(null);
    }

    function handleCancelProfileCrop() {
        setProfilePictureSourceFile(null);
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
                        Share your contact details, role interest, required profile picture, and
                        optional CV. Employment, bank, tax, and identity details are handled later
                        if your application continues.
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
                            <FunctionPicker
                                label="Role interest"
                                source="public"
                                required
                                value={form.roleInterest}
                                placeholder="Search job functions, or type your own"
                                onChange={(value) => updateField("roleInterest", value)}
                            />
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
                        </div>
                    </section>

                    <section className="applicationSection">
                        <h2>Uploads</h2>
                        <div className="applicationUploadGrid">
                            <div className="applicationUploadCard">
                                <div className="applicationUploadHeading">
                                    <span>CV upload</span>
                                    <p>Optional. Add a CV if you want to give extra background.</p>
                                </div>
                                <label className="applicationFilePicker applicationFilePickerStacked">
                                    <input
                                        type="file"
                                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                        onChange={handleCvChange}
                                    />
                                    <span className="applicationFileButton">Choose CV file</span>
                                    <span className="applicationFileName">
                                        {cvFile?.name ?? "No file selected"}
                                    </span>
                                </label>
                                <p className="applicationFieldHint">
                                    PDF and Word files are supported. Use a file up to 15 MB.
                                </p>
                                {cvError ? (
                                    <p className="applicationFileError" role="alert">
                                        {cvError}
                                    </p>
                                ) : null}
                            </div>

                            <div className="applicationUploadCard">
                                <div className="applicationUploadHeading">
                                    <span>Profile picture</span>
                                    <p>
                                        Required. ParadePaard will use this as your starting account
                                        profile picture if your application is accepted.
                                    </p>
                                </div>
                                <label className="applicationFilePicker applicationFilePickerStacked">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleProfilePictureChange}
                                    />
                                    <span className="applicationFileButton">Choose profile picture</span>
                                    <span className="applicationFileName">
                                        {profilePicture?.name ?? "No file selected"}
                                    </span>
                                </label>
                                <div className="applicationProfilePreview">
                                    <div className="applicationProfilePreviewCircle">
                                        {profilePicturePreviewUrl ? (
                                            <img
                                                src={profilePicturePreviewUrl}
                                                alt="Selected profile preview"
                                            />
                                        ) : (
                                            <div className="applicationProfilePreviewPlaceholder">
                                                No preview yet
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <p className="applicationFieldHint">
                                    Use a clear image file up to 2 MB. Adjust visible profile area before saving.
                                </p>
                                {profilePictureError ? (
                                    <p className="applicationFileError" role="alert">
                                        {profilePictureError}
                                    </p>
                                ) : null}
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

            <ProfilePictureCropper
                sourceFile={profilePictureSourceFile}
                onCropComplete={handleProfileCropComplete}
                onCancel={handleCancelProfileCrop}
            />
        </main>
    );
}
