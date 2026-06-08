import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserServices } from "../services/user-service/UserServices";
import { normalizeDateInput, parseDisplayDate } from "../utils/dateInput";
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

function WaitingForReview() {
    return (
        <div className="onboarding-container">
            <div className="onboarding-card onboarding-card--waiting">
                <div className="status-pill">Awaiting review</div>
                <h1>Onboarding submitted</h1>
                <p className="onboarding-subtitle">
                    Your onboarding details are awaiting internal review. You can return here to check the status,
                    and ParadePaard will continue the contract process after the review is complete.
                </p>
            </div>
        </div>
    );
}

export default function Onboarding() {
    const navigate = useNavigate();
    const { status, setStatus } = useAuth();
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

    if (status === "PENDING_PROFILE_REVIEW" || showWaiting) {
        return <WaitingForReview />;
    }

    return (
        <div className="onboarding-container">
            <div className="onboarding-card">
                <h1>Complete your account setup</h1>
                <p className="onboarding-subtitle">
                    Complete your required details so your account can be activated.
                </p>

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
                                            accept="image/*,.pdf,application/pdf"
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
                                            accept="image/*,.pdf,application/pdf"
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
