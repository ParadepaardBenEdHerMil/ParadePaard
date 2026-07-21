import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserServices } from "../services/user-service/UserServices";
import { formatDateInput, normalizeDateInput, parseDisplayDate } from "../utils/dateInput";
import { formatFileSize } from "../utils/formatFileSize";
import { canAccessManagement } from "../utils/permissionPolicy";
import { formatFlagLines, onboardingFieldMeta, sanitizeFieldFlags } from "../utils/onboardingReviewFields";
import "../stylesheets/Onboarding.css";

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS: Record<Step, string> = {
    1: "Address",
    2: "Bank details",
    3: "Payroll and tax",
    4: "ID verification",
    5: "Emergency contact",
};

const STEPS: Step[] = [1, 2, 3, 4, 5];

function hasValue(value: string) {
    return value.trim().length > 0;
}

// The backend (JobApplicationUploadValidator) accepts JPEG/PNG/WebP up to 10 MB per
// side. Mirror those caps here so an over-limit or wrong-type photo is rejected
// instantly with a precise message. Without this the file is only rejected after it's
// uploaded — and once the request exceeds nginx's body cap the browser can't read the
// 413, so the failure surfaces as an opaque "Cannot reach the server" network error.
const MAX_ID_DOCUMENT_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_ID_DOCUMENT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

function validateIdDocumentImage(label: string, file: File | null): string | null {
    if (!file) {
        return `${label} is required.`;
    }
    if (!ALLOWED_ID_DOCUMENT_IMAGE_TYPES.includes(file.type)) {
        return `${label} must be a JPEG, PNG, or WebP image.`;
    }
    if (file.size > MAX_ID_DOCUMENT_IMAGE_BYTES) {
        return `${label} is too large (${formatFileSize(file.size)}). Use an image up to 10 MB.`;
    }
    return null;
}

function WaitingForReview({ canOpenManagement }: { canOpenManagement: boolean }) {
    const navigate = useNavigate();
    return (
        <div className="onboarding-container">
            <div className="onboarding-card onboarding-card--waiting">
                <div className="status-pill">Awaiting review</div>
                <h1>Onboarding submitted</h1>
                <p className="onboarding-subtitle">
                    Your onboarding details are awaiting internal review. You can return here to check the status,
                    and ParadePaard will continue the contract process after the review is complete.
                </p>
                {canOpenManagement ? (
                    <div className="onboarding-actions onboarding-actions--waiting">
                        <button type="button" onClick={() => navigate("/management")}>
                            Go to management
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default function Onboarding() {
    const navigate = useNavigate();
    const { status, setStatus, permissions } = useAuth();
    const canOpenManagement = canAccessManagement(permissions);
    const [step, setStep] = useState<Step>(1);
    const [showWaiting, setShowWaiting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [street, setStreet] = useState("");
    const [houseNumber, setHouseNumber] = useState("");
    const [houseNumberSuffix, setHouseNumberSuffix] = useState("");
    const [postalCode, setPostalCode] = useState("");
    const [city, setCity] = useState("");
    const [country, setCountry] = useState("");

    const [iban, setIban] = useState("");
    const [bankAccountHolderName, setBankAccountHolderName] = useState("");

    const [bsn, setBsn] = useState("");
    const [applyLoonheffingskorting, setApplyLoonheffingskorting] = useState(false);
    const [payrollNotes, setPayrollNotes] = useState("");
    const [nationality, setNationality] = useState("");

    const [idDocumentType, setIdDocumentType] = useState("");
    const [idDocumentNumber, setIdDocumentNumber] = useState("");
    const [idIssueDate, setIdIssueDate] = useState("");
    const [idExpirationDate, setIdExpirationDate] = useState("");
    const [idIssuingCountry, setIdIssuingCountry] = useState("");
    const [idDocumentFrontImage, setIdDocumentFrontImage] = useState<File | null>(null);
    const [idDocumentBackImage, setIdDocumentBackImage] = useState<File | null>(null);

    const [emergencyContactName, setEmergencyContactName] = useState("");
    const [emergencyContactRelationship, setEmergencyContactRelationship] = useState("");
    const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
    const [emergencyContactEmail, setEmergencyContactEmail] = useState("");

    // Admin revision feedback shown when the form reopens after a "request changes": the overall
    // note plus per-field flags (fieldKey -> explanation), surfaced as a banner and per-step.
    const [fieldFlags, setFieldFlags] = useState<Record<string, string>>({});
    const [reviewNote, setReviewNote] = useState<string | null>(null);

    // Pre-fill the form with whatever the user has on file. This is the
    // "redo onboarding" case: when an admin sends the user back through the
    // form, we don't want them to retype everything. They can review, change
    // what is now wrong, and resubmit. ID document images are NOT pre-filled
    // because file inputs can't carry an existing blob — the user has to
    // upload again, and the prompt below makes that clear.
    useEffect(() => {
        let cancelled = false;
        if (status === "PENDING_PROFILE_REVIEW" || showWaiting) return;
        UserServices.getMe()
            .then((me) => {
                if (cancelled || !me) return;
                if (me.street) setStreet(me.street);
                if (me.houseNumber) setHouseNumber(me.houseNumber);
                if (me.houseNumberSuffix) setHouseNumberSuffix(me.houseNumberSuffix);
                if (me.postalCode) setPostalCode(me.postalCode);
                if (me.city) setCity(me.city);
                if (me.country) setCountry(me.country);
                if (me.iban) setIban(me.iban);
                if (me.bankAccountHolderName) setBankAccountHolderName(me.bankAccountHolderName);
                if (me.employeeTaxProfile?.bsn) setBsn(me.employeeTaxProfile.bsn);
                if (typeof me.employeeTaxProfile?.applyLoonheffingskorting === "boolean") {
                    setApplyLoonheffingskorting(me.employeeTaxProfile.applyLoonheffingskorting);
                }
                if (me.employeeTaxProfile?.payrollNotes) setPayrollNotes(me.employeeTaxProfile.payrollNotes);
                if (me.nationality) setNationality(me.nationality);
                if (me.idDocumentType) setIdDocumentType(me.idDocumentType);
                if (me.idDocumentNumber) setIdDocumentNumber(me.idDocumentNumber);
                if (me.idIssueDate) setIdIssueDate(formatDateInput(me.idIssueDate));
                if (me.idExpirationDate) setIdExpirationDate(formatDateInput(me.idExpirationDate));
                if (me.idIssuingCountry) setIdIssuingCountry(me.idIssuingCountry);
                if (me.emergencyContactName) setEmergencyContactName(me.emergencyContactName);
                if (me.emergencyContactRelationship) {
                    setEmergencyContactRelationship(me.emergencyContactRelationship);
                }
                if (me.emergencyContactPhone) setEmergencyContactPhone(me.emergencyContactPhone);
                if (me.emergencyContactEmail) setEmergencyContactEmail(me.emergencyContactEmail);
                setFieldFlags(sanitizeFieldFlags(me.onboardingReviewFieldFlags));
                setReviewNote(me.onboardingReviewNote ?? null);
            })
            .catch(() => {
                // Silent fallback: leave the form blank so the user can still
                // complete onboarding from scratch when prefill fails.
            });
        return () => {
            cancelled = true;
        };
    }, [status, showWaiting]);

    const canContinue = useMemo(() => {
        if (step === 1) {
            return [street, houseNumber, postalCode, city, country].every(hasValue);
        }
        if (step === 2) {
            return hasValue(iban) && hasValue(bankAccountHolderName);
        }
        if (step === 3) {
            return hasValue(bsn);
        }
        if (step === 4) {
            return [idDocumentType, idDocumentNumber, idIssueDate, idExpirationDate, idIssuingCountry].every(hasValue)
                && parseDisplayDate(idIssueDate) !== null
                && parseDisplayDate(idExpirationDate) !== null
                && idDocumentFrontImage !== null
                && idDocumentBackImage !== null;
        }
        return [emergencyContactName, emergencyContactRelationship, emergencyContactPhone].every(hasValue);
    }, [
        step,
        street,
        houseNumber,
        postalCode,
        city,
        country,
        iban,
        bankAccountHolderName,
        bsn,
        idDocumentType,
        idDocumentNumber,
        idIssueDate,
        idExpirationDate,
        idIssuingCountry,
        idDocumentFrontImage,
        idDocumentBackImage,
        emergencyContactName,
        emergencyContactRelationship,
        emergencyContactPhone,
    ]);

    const goNext = () => {
        setErrorMsg(null);
        if (step < 5 && canContinue) {
            setStep((step + 1) as Step);
        }
    };

    const goBack = () => {
        setErrorMsg(null);
        if (step > 1) {
            setStep((step - 1) as Step);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        if (!canContinue || !idDocumentFrontImage || !idDocumentBackImage) {
            setErrorMsg("Please complete the required fields.");
            return;
        }
        const idImageError =
            validateIdDocumentImage("Front of ID", idDocumentFrontImage)
            ?? validateIdDocumentImage("Back of ID", idDocumentBackImage);
        if (idImageError) {
            setStep(4);
            setErrorMsg(idImageError);
            return;
        }
        const parsedIdIssueDate = parseDisplayDate(idIssueDate);
        const parsedIdExpirationDate = parseDisplayDate(idExpirationDate);
        if (!parsedIdIssueDate || !parsedIdExpirationDate) {
            setStep(4);
            setErrorMsg("Please enter ID dates as dd/mm/yyyy.");
            return;
        }
        setLoading(true);
        try {
            try {
                await UserServices.uploadIdDocumentImages(idDocumentFrontImage, idDocumentBackImage);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "ID document image upload failed";
                setStep(4);
                setErrorMsg(`ID document image upload failed: ${message}`);
                return;
            }

            await UserServices.completeSetup({
                street,
                houseNumber,
                houseNumberSuffix: houseNumberSuffix.trim() || null,
                postalCode,
                city,
                country,
                iban,
                bankAccountHolderName,
                bsn,
                applyLoonheffingskorting,
                payrollNotes: payrollNotes.trim() || null,
                nationality: nationality.trim() || null,
                idDocumentType,
                idDocumentNumber,
                idIssueDate: parsedIdIssueDate,
                idExpirationDate: parsedIdExpirationDate,
                idIssuingCountry,
                emergencyContactName,
                emergencyContactRelationship,
                emergencyContactPhone,
                emergencyContactEmail: emergencyContactEmail.trim() || null,
            });
            setStatus("PENDING_PROFILE_REVIEW");
            setShowWaiting(true);
            navigate("/onboarding", { replace: true });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Onboarding failed";
            setErrorMsg(message);
        } finally {
            setLoading(false);
        }
    };

    const flaggedForStep = (targetStep: Step) =>
        Object.entries(fieldFlags)
            .map(([key, explanation]) => ({ key, explanation, meta: onboardingFieldMeta(key) }))
            .filter((item) => item.meta?.step === targetStep && item.explanation.trim().length > 0);

    const renderStepFlags = (targetStep: Step) => {
        const flagged = flaggedForStep(targetStep);
        if (flagged.length === 0) return null;
        return (
            <div className="onboarding-flags" role="alert">
                <p className="onboarding-flags-title">The reviewer asked you to fix these:</p>
                <ul>
                    {flagged.map((item) => (
                        <li key={item.key}>
                            <strong>{item.meta?.label ?? item.key}:</strong> {item.explanation}
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    const summaryFlagLines = formatFlagLines(fieldFlags);
    const hasReviewFeedback = summaryFlagLines.length > 0 || Boolean(reviewNote);

    if (status === "PENDING_PROFILE_REVIEW" || showWaiting) {
        return <WaitingForReview canOpenManagement={canOpenManagement} />;
    }

    return (
        <div className="onboarding-container">
            <div className="onboarding-card">
                <h1>Complete your account setup</h1>
                <p className="onboarding-subtitle">
                    {status === "CHANGES_REQUESTED"
                        ? "Review the details we already have on file, update anything that has changed, and submit them for review. Please re-upload your ID document images."
                        : "Complete your required details so your account can be activated."}
                </p>

                {hasReviewFeedback ? (
                    <div className="onboarding-review-summary" role="alert">
                        <h2 className="onboarding-review-summary-title">Changes requested by the reviewer</h2>
                        {reviewNote ? <p className="onboarding-review-note">{reviewNote}</p> : null}
                        {summaryFlagLines.length > 0 ? (
                            <ul>
                                {summaryFlagLines.map((line) => (
                                    <li key={line}>{line}</li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                ) : null}

                <div className="step-indicator" aria-label="Onboarding sections">
                    {STEPS.map((stepNumber) => (
                        <span key={stepNumber} className={step === stepNumber ? "active" : ""}>
                            {stepNumber}. {STEP_LABELS[stepNumber]}
                        </span>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    {step === 1 && (
                        <section className="step-panel" aria-labelledby="onboarding-address">
                            <h2 id="onboarding-address">Address</h2>
                            {renderStepFlags(1)}
                            <label>
                                Street
                                <input
                                    value={street}
                                    onChange={(e) => setStreet(e.target.value)}
                                    placeholder="Street name"
                                    required
                                />
                            </label>
                            <div className="inline-fields">
                                <label>
                                    House number
                                    <input
                                        value={houseNumber}
                                        onChange={(e) => setHouseNumber(e.target.value)}
                                        placeholder="12"
                                        required
                                    />
                                </label>
                                <label>
                                    Suffix
                                    <input
                                        value={houseNumberSuffix}
                                        onChange={(e) => setHouseNumberSuffix(e.target.value)}
                                        placeholder="A"
                                    />
                                </label>
                            </div>
                            <label>
                                Postal code
                                <input
                                    value={postalCode}
                                    onChange={(e) => setPostalCode(e.target.value)}
                                    placeholder="1234 AB"
                                    required
                                />
                            </label>
                            <label>
                                City
                                <input
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    placeholder="City"
                                    required
                                />
                            </label>
                            <label>
                                Country
                                <input
                                    value={country}
                                    onChange={(e) => setCountry(e.target.value)}
                                    placeholder="Country"
                                    required
                                />
                            </label>
                        </section>
                    )}

                    {step === 2 && (
                        <section className="step-panel" aria-labelledby="onboarding-bank-details">
                            <h2 id="onboarding-bank-details">Bank details</h2>
                            {renderStepFlags(2)}
                            <label>
                                IBAN
                                <input
                                    value={iban}
                                    onChange={(e) => setIban(e.target.value)}
                                    placeholder="NL00BANK0123456789"
                                    required
                                />
                            </label>
                            <label>
                                Account holder name
                                <input
                                    value={bankAccountHolderName}
                                    onChange={(e) => setBankAccountHolderName(e.target.value)}
                                    placeholder="Full name on the bank account"
                                    required
                                />
                            </label>
                        </section>
                    )}

                    {step === 3 && (
                        <section className="step-panel" aria-labelledby="onboarding-payroll-tax">
                            <h2 id="onboarding-payroll-tax">Payroll and tax</h2>
                            {renderStepFlags(3)}
                            <label>
                                BSN
                                <input
                                    value={bsn}
                                    onChange={(e) => setBsn(e.target.value)}
                                    placeholder="Burgerservicenummer"
                                    required
                                />
                            </label>
                            <label>
                                Nationality
                                <input
                                    value={nationality}
                                    onChange={(e) => setNationality(e.target.value)}
                                    placeholder="Optional"
                                />
                            </label>
                            <div className="choice-list">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={applyLoonheffingskorting}
                                        onChange={(e) => setApplyLoonheffingskorting(e.target.checked)}
                                    />
                                    Apply loonheffingskorting
                                </label>
                            </div>
                            <label>
                                Payroll notes
                                <textarea
                                    value={payrollNotes}
                                    onChange={(e) => setPayrollNotes(e.target.value)}
                                    placeholder="Optional notes for payroll"
                                    rows={4}
                                />
                            </label>
                        </section>
                    )}

                    {step === 4 && (
                        <section className="step-panel" aria-labelledby="onboarding-id-verification">
                            <h2 id="onboarding-id-verification">ID verification</h2>
                            {renderStepFlags(4)}
                            <label>
                                Document type
                                <select
                                    value={idDocumentType}
                                    onChange={(e) => setIdDocumentType(e.target.value)}
                                    required
                                >
                                    <option value="">Select a document type</option>
                                    <option value="PASSPORT">Passport</option>
                                    <option value="ID_CARD">ID card</option>
                                    <option value="RESIDENCE_PERMIT">Residence permit</option>
                                    <option value="DRIVING_LICENSE">Driving license</option>
                                </select>
                            </label>
                            <label>
                                Document number
                                <input
                                    value={idDocumentNumber}
                                    onChange={(e) => setIdDocumentNumber(e.target.value)}
                                    placeholder="Document number"
                                    required
                                />
                            </label>
                            <div className="inline-fields">
                                <label>
                                    Issue date
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="\d{2}/\d{2}/\d{4}"
                                        placeholder="dd/mm/yyyy"
                                        title="Use dd/mm/yyyy"
                                        value={idIssueDate}
                                        onChange={(e) => setIdIssueDate(normalizeDateInput(e.target.value))}
                                        required
                                    />
                                </label>
                                <label>
                                    Expiration date
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="\d{2}/\d{2}/\d{4}"
                                        placeholder="dd/mm/yyyy"
                                        title="Use dd/mm/yyyy"
                                        value={idExpirationDate}
                                        onChange={(e) => setIdExpirationDate(normalizeDateInput(e.target.value))}
                                        required
                                    />
                                </label>
                            </div>
                            <label>
                                Issuing country
                                <input
                                    value={idIssuingCountry}
                                    onChange={(e) => setIdIssuingCountry(e.target.value)}
                                    placeholder="Country that issued the document"
                                    required
                                />
                            </label>
                            <div className="onboardingDocumentUploadGrid">
                                <div className="onboardingFileField">
                                    <span className="onboardingFileLabel">Front of ID</span>
                                    <label className="onboardingFilePicker">
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            onChange={(e) => setIdDocumentFrontImage(e.target.files?.[0] ?? null)}
                                            required
                                        />
                                        <span className="onboardingFileButton">Choose file</span>
                                        <span className="onboardingFileName">
                                            {idDocumentFrontImage?.name ?? "No file selected"}
                                        </span>
                                    </label>
                                </div>
                                <div className="onboardingFileField">
                                    <span className="onboardingFileLabel">Back of ID</span>
                                    <label className="onboardingFilePicker">
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            onChange={(e) => setIdDocumentBackImage(e.target.files?.[0] ?? null)}
                                            required
                                        />
                                        <span className="onboardingFileButton">Choose file</span>
                                        <span className="onboardingFileName">
                                            {idDocumentBackImage?.name ?? "No file selected"}
                                        </span>
                                    </label>
                                </div>
                            </div>
                            <p className="hint">Upload a clear image of both sides of the ID document used for verification.</p>
                        </section>
                    )}

                    {step === 5 && (
                        <section className="step-panel" aria-labelledby="onboarding-emergency-contact">
                            <h2 id="onboarding-emergency-contact">Emergency contact</h2>
                            {renderStepFlags(5)}
                            <label>
                                Contact name
                                <input
                                    value={emergencyContactName}
                                    onChange={(e) => setEmergencyContactName(e.target.value)}
                                    placeholder="Full name"
                                    required
                                />
                            </label>
                            <label>
                                Relationship
                                <input
                                    value={emergencyContactRelationship}
                                    onChange={(e) => setEmergencyContactRelationship(e.target.value)}
                                    placeholder="Parent, partner, friend"
                                    required
                                />
                            </label>
                            <label>
                                Phone number
                                <input
                                    value={emergencyContactPhone}
                                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                                    placeholder="+31 6 12345678"
                                    required
                                />
                            </label>
                            <label>
                                Email address
                                <input
                                    type="email"
                                    value={emergencyContactEmail}
                                    onChange={(e) => setEmergencyContactEmail(e.target.value)}
                                    placeholder="Optional"
                                />
                            </label>
                        </section>
                    )}

                    {errorMsg && <div className="error-message">{errorMsg}</div>}

                    <div className="onboarding-actions">
                        <button type="button" onClick={goBack} disabled={step === 1 || loading}>
                            Back
                        </button>
                        {step < 5 && (
                            <button type="button" onClick={goNext} disabled={!canContinue || loading}>
                                Next
                            </button>
                        )}
                        {step === 5 && (
                            <button type="submit" disabled={!canContinue || loading}>
                                {loading ? "Submitting..." : "Finish setup"}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
