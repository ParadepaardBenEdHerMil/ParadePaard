import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Spinner from "../components/Spinner";
import { UserServices, type ContractResponseDTO, type UserResponseDTO } from "../services/user-service/UserServices";
import { formatDate, formatMaybeDateTime } from "../utils/dateFormat";
import "../stylesheets/Profile.css";
import "../stylesheets/UserDashboard.css";

const moneyFormatter = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const AGREEMENT_TEXT = "I have read the employment contract and agree to it.";
const CONTRACT_VERSION = "2026-05-employment-v1";

type SignatureValidationState = {
    contractLoaded: boolean;
    alreadySigned: boolean;
    agreementChecked: boolean;
    typedName: string;
    employeeFullName?: string | null;
};

export function canSubmitContractSignature(state: SignatureValidationState): boolean {
    if (!state.contractLoaded || state.alreadySigned || !state.agreementChecked) return false;
    const typedName = normalizeName(state.typedName);
    if (!typedName) return false;
    const employeeName = normalizeName(state.employeeFullName ?? "");
    return employeeName ? typedName === employeeName : true;
}

type ContractDocumentPreviewProps = {
    contract: ContractResponseDTO;
    user: UserResponseDTO;
    companyName?: string;
};

export function ContractDocumentPreview({
    contract,
    user,
    companyName = "ParadePaard",
}: ContractDocumentPreviewProps) {
    const employeeName = employeeFullName(user);
    const position = displayValue(contract.functionName ?? user.position);
    const contractType = formatContractType(contract.contractType);
    const hourlyWage = contract.grossHourlyWage == null ? "-" : moneyFormatter.format(Number(contract.grossHourlyWage));
    const weeklyHours = contract.weeklyHours == null ? "as scheduled and agreed" : `${contract.weeklyHours} hours per week`;
    const endDateText = contract.endDate ? `and ends on ${formatDate(contract.endDate)}` : "and continues until ended according to this agreement";
    const address = formatAddress(user);

    return (
        <article className="contractDocument" aria-label="Employment contract preview">
            <header className="contractDocumentHeader">
                <p className="contractDocumentKicker">Employment contract</p>
                <h1>Employment Agreement</h1>
                <p>
                    This employment agreement is entered into between {companyName} and {employeeName}.
                    The agreement starts on {formatDate(contract.startDate)} {endDateText}.
                </p>
            </header>

            <section>
                <h2>1. Parties</h2>
                <p>
                    The employer is {companyName}. The employee is {employeeName}
                    {address ? `, living at ${address}` : ""}. The employee can be contacted at {displayValue(user.email)}
                    {user.mobileNumber ? ` and by phone at ${user.mobileNumber}` : ""}.
                </p>
            </section>

            <section>
                <h2>2. Position and Work</h2>
                <p>
                    The employee will work in the position of {position}. The work location is {displayValue(contract.workLocation)}
                    . The contract type is {contractType}. The employee is expected to follow reasonable planning instructions,
                    event procedures, and workplace rules that apply to ParadePaard assignments.
                </p>
            </section>

            <section>
                <h2>3. Pay and Payroll</h2>
                <p>
                    The gross hourly wage is {hourlyWage}. The expected working time is {weeklyHours}. Payment is processed
                    {formatPaymentFrequency(contract.paymentFrequency).toLowerCase()} unless a later written agreement changes
                    the payroll timing.
                </p>
                <p>
                    Holiday allowance is {formatPercentage(contract.holidayAllowancePercentage)}. Leave entitlement is
                    {contract.leaveEntitlementDays == null ? " handled according to Dutch employment rules" : ` ${contract.leaveEntitlementDays} days per year`}
                    . Travel allowance is {contract.travelAllowance
                        ? "included when applicable under the Horeca Payroll and Contract Rules"
                        : "not included unless agreed separately"}.
                </p>
            </section>

            <section>
                <h2>4. Employment Terms</h2>
                <p>
                    The probation period is {displayValue(contract.probationPeriod)}. The notice period is
                    {" "}{displayValue(contract.noticePeriod)}. Any applicable collective agreement is
                    {" "}{displayValue(contract.collectiveAgreement)}. Pension participation is
                    {" "}{displayValue(contract.pensionScheme)}.
                </p>
                <p>
                    If the employee is sick, the employee must follow this sickness policy: {displayValue(contract.sicknessPolicy)}.
                </p>
            </section>

            <section>
                <h2>5. Confidentiality</h2>
                <p>
                    {contract.confidentialityClause
                        ? contract.confidentialityClause
                        : "The employee must handle company, client, planning, payroll, and event information confidentially and may not share it outside the work context."}
                </p>
            </section>

            <section>
                <h2>6. Signing</h2>
                <p>
                    By signing this agreement, the employee confirms that the contract has been read, the personal and
                    employment details have been checked, and the employee agrees to the terms above.
                </p>
            </section>
        </article>
    );
}

export default function AccountContractSign() {
    const { contractId } = useParams();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const [contract, setContract] = useState<ContractResponseDTO | null>(null);
    const [user, setUser] = useState<UserResponseDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [agreementChecked, setAgreementChecked] = useState(false);
    const [typedName, setTypedName] = useState("");
    const [signatureImage, setSignatureImage] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        Promise.all([UserServices.getMe(), UserServices.getMyContracts()])
            .then(([currentUser, contracts]) => {
                if (cancelled) return;
                const selectedContract = contracts.find((row) => row.contractId === contractId) ?? null;
                if (!selectedContract) {
                    setError("Contract not found.");
                    return;
                }
                setUser(currentUser);
                setContract(selectedContract);
            })
            .catch((err: unknown) => {
                if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load contract.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [contractId]);

    const employeeName = useMemo(() => user ? employeeFullName(user) : "", [user]);
    const alreadySigned = isSignedStatus(contract?.status);
    const canSubmit = canSubmitContractSignature({
        contractLoaded: Boolean(contract && user),
        alreadySigned,
        agreementChecked,
        typedName,
        employeeFullName: employeeName,
    });

    const beginDrawing = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        if (alreadySigned || submitting) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        canvas.setPointerCapture(event.pointerId);
        drawingRef.current = true;
        const point = canvasPoint(canvas, event);
        context.beginPath();
        context.moveTo(point.x, point.y);
    }, [alreadySigned, submitting]);

    const draw = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current || alreadySigned || submitting) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        const point = canvasPoint(canvas, event);
        context.lineWidth = 2;
        context.lineCap = "round";
        context.strokeStyle = "#111827";
        context.lineTo(point.x, point.y);
        context.stroke();
    }, [alreadySigned, submitting]);

    const endDrawing = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (canvas?.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }
        if (!drawingRef.current || !canvas) return;
        drawingRef.current = false;
        setSignatureImage(canvas.toDataURL("image/png"));
    }, []);

    const clearSignature = () => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureImage(null);
    };

    const submitSignature = async () => {
        if (!contract || !user || !canSubmit) return;
        try {
            setSubmitting(true);
            setError(null);
            const documentHash = await buildDocumentHash(contract, user);
            const updated = await UserServices.signContract(contract.contractId, {
                typedSignatureName: typedName.trim(),
                drawnSignatureImage: signatureImage,
                agreementCheckboxText: AGREEMENT_TEXT,
                contractVersion: CONTRACT_VERSION,
                documentHash,
                browserUserAgent: navigator.userAgent,
            });
            setContract(updated);
            setSuccess("Contract signed. The signed contract is now locked for editing.");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to sign contract.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <Navbar />
            <div className="contractSignPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <main className="contractSignMain">
                        <header className="pageHeader">
                            <PageBack to="/account/employment" />
                            <h1 className="pageTitle">Review and sign contract</h1>
                        </header>

                        {loading ? <Spinner text="Loading contract" /> : null}
                        {!loading && error && !contract ? <p className="errorText">{error}</p> : null}

                        {!loading && contract && user ? (
                            <div className="contractSignGrid">
                                <section className="contractPreviewPanel">
                                    <ContractDocumentPreview contract={contract} user={user} />
                                </section>

                                <aside className="contractSigningPanel" aria-label="Contract signing section">
                                    <div className="contractSigningCard">
                                        <h2>Sign contract</h2>
                                        <dl className="contractMetaList">
                                            <div>
                                                <dt>Status</dt>
                                                <dd>{formatContractStatus(contract.status)}</dd>
                                            </div>
                                            <div>
                                                <dt>Version</dt>
                                                <dd>{contract.contractVersion ?? CONTRACT_VERSION}</dd>
                                            </div>
                                            {contract.employeeSignedAt ? (
                                                <div>
                                                    <dt>Signed</dt>
                                                    <dd>{formatMaybeDateTime(contract.employeeSignedAt)}</dd>
                                                </div>
                                            ) : null}
                                            {contract.typedSignatureName ? (
                                                <div>
                                                    <dt>Typed signature</dt>
                                                    <dd>{contract.typedSignatureName}</dd>
                                                </div>
                                            ) : null}
                                        </dl>

                                        {alreadySigned ? (
                                            <div className="contractLockedNotice">
                                                This contract has been signed and is locked. You can review it, but you cannot edit or sign it again.
                                            </div>
                                        ) : (
                                            <>
                                                <label className="contractAgreement">
                                                    <input
                                                        type="checkbox"
                                                        checked={agreementChecked}
                                                        onChange={(event) => setAgreementChecked(event.target.checked)}
                                                        disabled={submitting}
                                                    />
                                                    <span>{AGREEMENT_TEXT}</span>
                                                </label>

                                                <label className="contractSignatureLabel" htmlFor="typed-signature-name">
                                                    Full legal name
                                                </label>
                                                <input
                                                    id="typed-signature-name"
                                                    className="uiSelect contractTypedInput"
                                                    value={typedName}
                                                    onChange={(event) => setTypedName(event.target.value)}
                                                    placeholder={employeeName}
                                                    disabled={submitting}
                                                />
                                                {typedName.trim() && normalizeName(typedName) !== normalizeName(employeeName) ? (
                                                    <p className="helperText">Type your full legal name exactly as shown on the contract: {employeeName}.</p>
                                                ) : null}

                                                <div className="contractSignatureLabel">Optional drawn signature</div>
                                                <canvas
                                                    ref={canvasRef}
                                                    className="contractSignatureCanvas"
                                                    width={520}
                                                    height={180}
                                                    onPointerDown={beginDrawing}
                                                    onPointerMove={draw}
                                                    onPointerUp={endDrawing}
                                                    onPointerCancel={endDrawing}
                                                    aria-label="Drawn signature box"
                                                />
                                                <button
                                                    type="button"
                                                    className="button buttonSecondary"
                                                    onClick={clearSignature}
                                                    disabled={submitting || !signatureImage}
                                                >
                                                    Clear signature
                                                </button>

                                                <button
                                                    type="button"
                                                    className="button contractSignButton"
                                                    onClick={() => void submitSignature()}
                                                    disabled={!canSubmit || submitting}
                                                >
                                                    {submitting ? "Signing..." : "Sign contract"}
                                                </button>
                                            </>
                                        )}

                                        {success ? <p className="helperText">{success}</p> : null}
                                        {error ? <p className="errorText">{error}</p> : null}

                                        <Link className="listLink contractReturnLink" to="/account/employment">
                                            Back to employment details
                                        </Link>
                                    </div>
                                </aside>
                            </div>
                        ) : null}
                    </main>
                </div>
            </div>
        </>
    );
}

function employeeFullName(user: UserResponseDTO): string {
    const parts = [user.firstNames, user.middleNamePrefix, user.lastName]
        .map((part) => (part ?? "").trim())
        .filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : (user.preferredName ?? "Employee").trim();
}

function formatAddress(user: UserResponseDTO): string {
    return [
        [user.street, user.houseNumber, user.houseNumberSuffix].filter(Boolean).join(" "),
        user.postalCode,
        user.city,
        user.country,
    ].map((part) => (part ?? "").trim()).filter(Boolean).join(", ");
}

function displayValue(value?: string | null): string {
    return value && value.trim() ? value.trim() : "-";
}

function formatContractType(value?: string | null): string {
    return displayValue(value).toLowerCase().replace(/_/g, " ");
}

function formatPaymentFrequency(value?: string | null): string {
    switch (value) {
        case "DAILY":
            return "Daily";
        case "WEEKLY":
            return "Weekly";
        case "BIWEEKLY":
            return "Biweekly";
        case "MONTHLY":
            return "Monthly";
        default:
            return value ?? "-";
    }
}

function formatPercentage(value?: number | null): string {
    return value == null ? "according to the applicable rules" : `${value}%`;
}

function isSignedStatus(status?: string | null): boolean {
    return status === "SIGNED" || status === "EMPLOYEE_SIGNED" || status === "FINALIZED";
}

function formatContractStatus(status?: string | null): string {
    return displayValue(status).toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeName(value: string): string {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function canvasPoint(canvas: HTMLCanvasElement, event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: ((event.clientX - rect.left) / rect.width) * canvas.width,
        y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
}

async function buildDocumentHash(contract: ContractResponseDTO, user: UserResponseDTO): Promise<string | null> {
    if (!crypto.subtle) return null;
    const source = JSON.stringify({
        contractVersion: CONTRACT_VERSION,
        contractId: contract.contractId,
        userId: contract.userId,
        employeeName: employeeFullName(user),
        functionName: contract.functionName,
        startDate: contract.startDate,
        endDate: contract.endDate,
        contractType: contract.contractType,
        grossHourlyWage: contract.grossHourlyWage,
        paymentFrequency: contract.paymentFrequency,
        weeklyHours: contract.weeklyHours,
        holidayAllowancePercentage: contract.holidayAllowancePercentage,
        leaveEntitlementDays: contract.leaveEntitlementDays,
        workLocation: contract.workLocation,
        noticePeriod: contract.noticePeriod,
    });
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
    return "sha256:" + Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}
