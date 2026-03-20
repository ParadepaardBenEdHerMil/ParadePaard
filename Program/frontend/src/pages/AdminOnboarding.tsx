import { useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import { UserServices, type AdminOnboardingRequestDTO, type AdminOnboardingResponseDTO } from "../services/user-service/UserServices";
import "../stylesheets/AdminDashboard.css";
import "../stylesheets/Modal.css";
import "../stylesheets/AdminOnboarding.css";

export default function AdminOnboarding() {
    const [preferredName, setPreferredName] = useState("");
    const [firstNames, setFirstNames] = useState("");
    const [middleNamePrefix, setMiddleNamePrefix] = useState("");
    const [lastName, setLastName] = useState("");
    const [gender, setGender] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [email, setEmail] = useState("");
    const [mobileNumber, setMobileNumber] = useState("");
    const [workedForUsBefore, setWorkedForUsBefore] = useState(false);
    const [position, setPosition] = useState<"BAR" | "RUNNER">("BAR");
    const [contractStartDate, setContractStartDate] = useState("");
    const [contractEndDate, setContractEndDate] = useState("");
    const [contractType, setContractType] = useState<"FIXED" | "ON_CALL">("ON_CALL");
    const [grossHourlyWage, setGrossHourlyWage] = useState("");
    const [travelAllowance, setTravelAllowance] = useState(true);

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [result, setResult] = useState<AdminOnboardingResponseDTO | null>(null);

    const canSubmit = useMemo(() => {
        const wage = Number(grossHourlyWage);
        const dobIso = parseDateToIso(dateOfBirth);
        const startIso = parseDateToIso(contractStartDate);
        const endIso = parseDateToIso(contractEndDate);
        return (
            email.trim().length > 0 &&
            firstNames.trim().length > 0 &&
            lastName.trim().length > 0 &&
            dobIso !== "" &&
            mobileNumber.trim().length > 0 &&
            startIso !== "" &&
            endIso !== "" &&
            Number.isFinite(wage) &&
            wage > 0
        );
    }, [
        email,
        firstNames,
        lastName,
        dateOfBirth,
        mobileNumber,
        contractStartDate,
        contractEndDate,
        grossHourlyWage,
    ]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setResult(null);

        const wage = Number(grossHourlyWage);
        if (!Number.isFinite(wage) || wage <= 0) {
            setErrorMsg("Gross hourly wage must be a positive number.");
            return;
        }

        const dateOfBirthIso = parseDateToIso(dateOfBirth);
        const contractStartIso = parseDateToIso(contractStartDate);
        const contractEndIso = parseDateToIso(contractEndDate);
        if (!dateOfBirthIso || !contractStartIso || !contractEndIso) {
            setErrorMsg("Please use dd-mm-yyyy for all dates.");
            return;
        }

        const payload: AdminOnboardingRequestDTO = {
            email: email.trim(),
            firstNames: firstNames.trim(),
            preferredName: preferredName.trim() ? preferredName.trim() : null,
            middleNamePrefix: middleNamePrefix.trim() ? middleNamePrefix.trim() : null,
            lastName: lastName.trim(),
            gender: gender.trim() ? gender.trim() : null,
            dateOfBirth: dateOfBirthIso,
            mobileNumber: mobileNumber.trim(),
            workedForUsBefore,
            position,
            startDate: contractStartIso,
            endDate: contractEndIso,
            contractType,
            grossHourlyWage: wage,
            travelAllowance,
        };

        setLoading(true);
        try {
            const response = await UserServices.adminOnboardEmployee(payload);
            setResult(response);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Onboarding failed";
            setErrorMsg(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage adminOnboardingPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header className="pageHeader">
                            <h1 className="pageTitle">Onboard employee</h1>
                        </header>
                        <div className="adminDashboardCard">
                            <Card title="Employee details">
                                <form className="adminOnboardingForm" onSubmit={submit}>
                                    <div className="adminOnboardingIntro">
                                        The employee will be asked to change their password on first login.
                                    </div>

                                    <div className="adminOnboardingGrid form_grid">
                                        <div className="form_row">
                                            <label className="adminOnboardingLabel">Preferred name</label>
                                            <input
                                                className="modal_input"
                                                value={preferredName}
                                                onChange={(e) => setPreferredName(e.target.value)}
                                                placeholder="Ben"
                                            />
                                        </div>

                                        <div className="form_row">
                                            <label className="adminOnboardingLabel">Full first names</label>
                                            <input
                                                className="modal_input"
                                                value={firstNames}
                                                onChange={(e) => setFirstNames(e.target.value)}
                                                placeholder="Benjamin"
                                                required
                                            />
                                        </div>

                                        <div className="form_row">
                                            <label className="adminOnboardingLabel">Prefix</label>
                                            <input
                                                className="modal_input"
                                                value={middleNamePrefix}
                                                onChange={(e) => setMiddleNamePrefix(e.target.value)}
                                                placeholder="van"
                                            />
                                        </div>

                                        <div className="form_row">
                                            <label className="adminOnboardingLabel">Surname</label>
                                            <input
                                                className="modal_input"
                                                value={lastName}
                                                onChange={(e) => setLastName(e.target.value)}
                                                placeholder="Rhee"
                                                required
                                            />
                                        </div>

                                        <div className="form_row">
                                            <label className="adminOnboardingLabel">Gender</label>
                                            <select
                                                className={`modal_input${gender ? "" : " selectPlaceholder"}`}
                                                value={gender}
                                                onChange={(e) => setGender(e.target.value)}
                                            >
                                                <option value="">(optional)</option>
                                                <option value="MALE">Male</option>
                                                <option value="FEMALE">Female</option>
                                                <option value="OTHER">Other</option>
                                            </select>
                                        </div>

                                        <div className="form_row">
                                            <label className="adminOnboardingLabel">Date of birth</label>
                                            <input
                                                className="modal_input"
                                                type="text"
                                                inputMode="numeric"
                                                pattern="\d{2}-\d{2}-\d{4}"
                                                value={dateOfBirth}
                                                onChange={(e) => setDateOfBirth(formatDateInput(e.target.value))}
                                                placeholder="dd-mm-yyyy"
                                                maxLength={10}
                                                required
                                            />
                                        </div>

                                        <div className="form_row">
                                            <label className="adminOnboardingLabel">Email address</label>
                                            <input
                                                className="modal_input"
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="employee@domain.com"
                                                required
                                            />
                                        </div>

                                        <div className="form_row">
                                            <label className="adminOnboardingLabel">Mobile number</label>
                                            <input
                                                className="modal_input"
                                                value={mobileNumber}
                                                onChange={(e) => setMobileNumber(e.target.value)}
                                                placeholder="0612345678"
                                                required
                                            />
                                        </div>

                                        <div className="form_row">
                                            <label className="adminOnboardingLabel">Worked for us before</label>
                                            <label className="adminOnboardingToggle">
                                                <input
                                                    type="checkbox"
                                                    checked={workedForUsBefore}
                                                    onChange={(e) => setWorkedForUsBefore(e.target.checked)}
                                                />
                                                <span>Yes</span>
                                            </label>
                                        </div>

                                        <div className="form_row">
                                            <label className="adminOnboardingLabel">Position</label>
                                            <select
                                                className={`modal_input${position === "BAR" ? " selectPlaceholder" : ""}`}
                                                value={position}
                                                onChange={(e) => setPosition(e.target.value as any)}
                                            >
                                                <option value="BAR">Bar</option>
                                                <option value="RUNNER">Runner</option>
                                            </select>
                                        </div>

                                        <div className="form_row">
                                            <label className="adminOnboardingLabel">Contract start date</label>
                                            <input
                                                className="modal_input"
                                                type="text"
                                                inputMode="numeric"
                                                pattern="\d{2}-\d{2}-\d{4}"
                                                value={contractStartDate}
                                                onChange={(e) => setContractStartDate(formatDateInput(e.target.value))}
                                                placeholder="dd-mm-yyyy"
                                                maxLength={10}
                                                required
                                            />
                                        </div>

                                        <div className="form_row">
                                            <label className="adminOnboardingLabel">Contract end date</label>
                                            <input
                                                className="modal_input"
                                                type="text"
                                                inputMode="numeric"
                                                pattern="\d{2}-\d{2}-\d{4}"
                                                value={contractEndDate}
                                                onChange={(e) => setContractEndDate(formatDateInput(e.target.value))}
                                                placeholder="dd-mm-yyyy"
                                                maxLength={10}
                                                required
                                            />
                                        </div>

                                        <div className="form_row">
                                            <label className="adminOnboardingLabel">Contract type</label>
                                            <select
                                                className={`modal_input${contractType === "ON_CALL" ? " selectPlaceholder" : ""}`}
                                                value={contractType}
                                                onChange={(e) => setContractType(e.target.value as any)}
                                            >
                                                <option value="FIXED">Fixed</option>
                                                <option value="ON_CALL">On-call</option>
                                            </select>
                                        </div>

                                        <div className="form_row">
                                            <label className="adminOnboardingLabel">Gross hourly wage</label>
                                            <input
                                                className="modal_input"
                                                inputMode="decimal"
                                                value={grossHourlyWage}
                                                onChange={(e) => setGrossHourlyWage(e.target.value)}
                                                placeholder="15.00"
                                                required
                                            />
                                        </div>

                                        <div className="form_row">
                                            <label className="adminOnboardingLabel">Travel allowance</label>
                                            <label className="adminOnboardingToggle">
                                                <input
                                                    type="checkbox"
                                                    checked={travelAllowance}
                                                    onChange={(e) => setTravelAllowance(e.target.checked)}
                                                />
                                                <span>EUR 0.23 net / km</span>
                                            </label>
                                        </div>
                                    </div>

                                    {errorMsg ? <div className="adminOnboardingError">{errorMsg}</div> : null}

                                    {result ? (
                                        <div className="adminOnboardingResult">
                                            <div><strong>Username:</strong> {result.username}</div>
                                            <div><strong>Temporary password:</strong> {result.temporaryPassword}</div>
                                            <div className="adminOnboardingHint">
                                                Onboarding email sent to {email.trim()}.
                                            </div>
                                        </div>
                                    ) : null}

                                    <div className="actions_row">
                                        <button className="button" type="submit" disabled={!canSubmit || loading}>
                                            {loading ? "Creating..." : "Create employee & send email"}
                                        </button>
                                    </div>
                                </form>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function parseDateToIso(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const match = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return "";
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return "";
    const date = new Date(year, month - 1, day);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return "";
    }
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
}

function formatDateInput(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}
