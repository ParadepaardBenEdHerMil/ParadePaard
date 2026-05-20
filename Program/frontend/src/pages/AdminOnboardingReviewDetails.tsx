import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import { AuthServices } from "../services/auth-service/AuthServices";
import {
    UserServices,
    type ContractResponseDTO,
    type CreateContractRequestDTO,
    type FunctionResponseDTO,
    type UserResponseDTO,
} from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";
import { normalizeDateInput, parseDisplayDate } from "../utils/dateInput";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminUsers.css";
import "../stylesheets/AdminOnboardingReviewDetails.css";

type ReviewDecision = "READY_TO_SEND_CONTRACT" | "NEEDS_CHANGES" | "REJECT_ONBOARDING";

type ContractSetupDraft = {
    functionName: string;
    contractType: string;
    startDate: string;
    endDate: string;
    grossHourlyWage: string;
    paymentFrequency: string;
    travelAllowance: boolean;
};

type ChecklistSectionKey = "personal" | "address" | "identification" | "bank" | "emergency" | "tax" | "contract";

const CHECKLIST_SECTION_KEYS: ChecklistSectionKey[] = [
    "personal",
    "address",
    "identification",
    "bank",
    "emergency",
    "tax",
    "contract",
];

function sanitizeCheckedSections(value: unknown): Partial<Record<ChecklistSectionKey, boolean>> | null {
    if (value == null || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const next: Partial<Record<ChecklistSectionKey, boolean>> = {};
    for (const key of CHECKLIST_SECTION_KEYS) {
        const maybe = record[key];
        if (typeof maybe === "boolean") {
            next[key] = maybe;
        }
    }
    return Object.keys(next).length > 0 ? next : null;
}

function sanitizeContractSetupDraft(
    value: unknown
): { selectedFunctionId: string; draft: Partial<ContractSetupDraft> } | null {
    if (value == null || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;

    const selectedFunctionId = typeof record.selectedFunctionId === "string" ? record.selectedFunctionId : "";
    const draft: Partial<ContractSetupDraft> = {};

    if (typeof record.functionName === "string") draft.functionName = record.functionName;
    if (typeof record.contractType === "string") draft.contractType = record.contractType;
    if (typeof record.startDate === "string") draft.startDate = record.startDate;
    if (typeof record.endDate === "string") draft.endDate = record.endDate;
    if (typeof record.grossHourlyWage === "string") draft.grossHourlyWage = record.grossHourlyWage;
    if (typeof record.paymentFrequency === "string") draft.paymentFrequency = record.paymentFrequency;
    if (typeof record.travelAllowance === "boolean") draft.travelAllowance = record.travelAllowance;

    if (!selectedFunctionId && Object.keys(draft).length === 0) return null;
    return { selectedFunctionId, draft };
}

function personFullName(user: UserResponseDTO): string {
    const parts = [user.firstNames, user.middleNamePrefix, user.lastName]
        .map((part) => (part ?? "").trim())
        .filter(Boolean);
    return parts.length ? parts.join(" ") : user.email;
}

function normalizeStatus(status?: string | null): string {
    return (status ?? "").trim().toUpperCase();
}

function statusBadgeLabel(userStatus?: string | null, contract?: ContractResponseDTO | null): string {
    const normalized = normalizeStatus(userStatus);
    if (normalized === "REJECTED") return "Rejected";
    if (contract?.status === "SENT_TO_EMPLOYEE") return "Contract sent";
    if (normalized === "PENDING_PROFILE_REVIEW") return "Pending review";
    if (normalized === "CHANGES_REQUESTED") return "Needs changes";
    if (normalized === "PENDING_CONTRACT_SIGNATURE" || normalized === "PENDING_CONTRACT_REVIEW") return "Ready for contract";
    return userStatus ?? "-";
}

function statusBadgeTone(userStatus?: string | null, contract?: ContractResponseDTO | null): "ok" | "warn" | "bad" | "sub" {
    const normalized = normalizeStatus(userStatus);
    if (normalized === "REJECTED") return "bad";
    if (contract?.status === "SENT_TO_EMPLOYEE") return "ok";
    if (normalized === "PENDING_PROFILE_REVIEW") return "warn";
    if (normalized === "CHANGES_REQUESTED") return "bad";
    if (normalized === "PENDING_CONTRACT_SIGNATURE" || normalized === "PENDING_CONTRACT_REVIEW") return "warn";
    if (normalized === "ACTIVE") return "ok";
    return "sub";
}

function boolLabel(value?: boolean | null): string {
    if (value == null) return "Missing";
    return value ? "Yes" : "No";
}

function valueLabel(value?: string | null): string {
    const v = (value ?? "").trim();
    return v ? v : "Missing";
}

function isMissing(value?: string | null): boolean {
    return !(value ?? "").trim();
}

function statusForReviewDecision(decision: ReviewDecision): string {
    if (decision === "NEEDS_CHANGES") return "CHANGES_REQUESTED";
    if (decision === "REJECT_ONBOARDING") return "REJECTED";
    return "PENDING_CONTRACT_REVIEW";
}

function buildContractPayload(input: {
    userId: string;
    selectedFunctionId: string;
    functions: FunctionResponseDTO[];
    draft: ContractSetupDraft;
}): CreateContractRequestDTO {
    const selectedFunction = input.functions.find((item) => item.functionId === input.selectedFunctionId);
    const functionName = selectedFunction?.functionName || input.draft.functionName.trim();
    const wageSource = selectedFunction?.hourlyWage ?? Number(input.draft.grossHourlyWage);
    const startIso = parseDisplayDate(input.draft.startDate) ?? null;
    const endIso = input.draft.endDate.trim() ? parseDisplayDate(input.draft.endDate) : null;

    if (!input.selectedFunctionId.trim()) throw new Error("Role or function is required.");
    if (!functionName.trim()) throw new Error("Function name is required.");
    if (!input.draft.contractType.trim()) throw new Error("Contract type is required.");
    if (!startIso) throw new Error("Start date is required (dd/mm/yyyy).");
    if (!endIso) throw new Error("End date is required (dd/mm/yyyy).");
    if (!Number.isFinite(wageSource) || wageSource <= 0) throw new Error("Gross hourly wage is required.");
    if (!input.draft.paymentFrequency.trim()) throw new Error("Payment frequency is required.");

    return {
        userId: input.userId,
        functionId: selectedFunction?.functionId ?? null,
        functionName: functionName.trim(),
        contractType: input.draft.contractType,
        startDate: startIso,
        endDate: endIso,
        grossHourlyWage: Number(wageSource),
        paymentFrequency: input.draft.paymentFrequency as any,
        travelAllowance: Boolean(input.draft.travelAllowance),
    };
}

export default function AdminOnboardingReviewDetails() {
    const navigate = useNavigate();
    const { userId } = useParams();

    const [user, setUser] = useState<UserResponseDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [currentContract, setCurrentContract] = useState<ContractResponseDTO | null>(null);

    const [functions, setFunctions] = useState<FunctionResponseDTO[]>([]);
    const [selectedFunctionId, setSelectedFunctionId] = useState("");

    const [contractDraft, setContractDraft] = useState<ContractSetupDraft>({
        functionName: "",
        contractType: "ON_CALL_RUNNER",
        startDate: "",
        endDate: "",
        grossHourlyWage: "",
        paymentFrequency: "WEEKLY",
        travelAllowance: false,
    });

    const [reviewDecision, setReviewDecision] = useState<ReviewDecision>("READY_TO_SEND_CONTRACT");
    const [reviewNote, setReviewNote] = useState("");
    const [savingReview, setSavingReview] = useState(false);

    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);

    const [idDocumentLoading, setIdDocumentLoading] = useState(false);
    const [idDocumentError, setIdDocumentError] = useState<string | null>(null);
    const [idDocumentNoFile, setIdDocumentNoFile] = useState(false);

    const [checkedSections, setCheckedSections] = useState<Record<ChecklistSectionKey, boolean>>({
        personal: false,
        address: false,
        identification: false,
        bank: false,
        emergency: false,
        tax: false,
        contract: false,
    });

    const load = useCallback(async () => {
        if (!userId) return;
        try {
            setLoading(true);
            setError(null);
            setActionError(null);
            setActionSuccess(null);

            const [userRes, contractRes, functionsRes] = await Promise.all([
                UserServices.getUserById(userId),
                UserServices.getCurrentContractForUser(userId),
                UserServices.getFunctions(),
            ]);

            setUser(userRes);
            setCurrentContract(contractRes);
            setFunctions(functionsRes);

            const existingDecision = (userRes.onboardingReviewDecision ?? "").trim();
            if (existingDecision) {
                if (
                    existingDecision === "READY_TO_SEND_CONTRACT"
                    || existingDecision === "NEEDS_CHANGES"
                    || existingDecision === "REJECT_ONBOARDING"
                ) {
                    setReviewDecision(existingDecision);
                }
            }
            setReviewNote(userRes.onboardingReviewNote ?? "");

            const storedCheckedSections = localStorage.getItem(`onboarding-review-checked-${userId}`);
            const serverCheckedSections = sanitizeCheckedSections(userRes.onboardingReviewCheckedSections);
            if (serverCheckedSections) {
                setCheckedSections((prev) => ({ ...prev, ...serverCheckedSections }));
            } else if (storedCheckedSections) {
                try {
                    setCheckedSections(JSON.parse(storedCheckedSections));
                } catch {
                    // ignore corrupted stored value
                }
            }

            const storedContractDraft = localStorage.getItem(`onboarding-review-contract-draft-${userId}`);
            const serverContractDraft = sanitizeContractSetupDraft(userRes.onboardingReviewContractSetupDraft);
            if (serverContractDraft) {
                setSelectedFunctionId(serverContractDraft.selectedFunctionId);
                setContractDraft((prev) => ({ ...prev, ...serverContractDraft.draft }));
            } else if (storedContractDraft) {
                try {
                    const parsed = JSON.parse(storedContractDraft) as { selectedFunctionId?: string; draft?: Partial<ContractSetupDraft> };
                    if (typeof parsed?.selectedFunctionId === "string") {
                        setSelectedFunctionId(parsed.selectedFunctionId);
                    }
                    if (parsed?.draft && typeof parsed.draft === "object") {
                        setContractDraft((prev) => ({ ...prev, ...(parsed.draft ?? {}) }));
                    }
                } catch {
                    // ignore corrupted stored value
                }
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load onboarding review.";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        void load();
    }, [load]);

    const registeredLabel = useMemo(() => formatDate(user?.registeredDate), [user?.registeredDate]);
    const badgeLabel = useMemo(() => statusBadgeLabel(user?.status, currentContract), [user?.status, currentContract]);
    const badgeTone = useMemo(() => statusBadgeTone(user?.status, currentContract), [user?.status, currentContract]);

    const checklist = useMemo(() => {
        const missing: Record<string, string[]> = {
            personal: [],
            address: [],
            identification: [],
            bank: [],
            emergency: [],
            tax: [],
            contract: [],
        };

        if (!user) return { missing };

        if (isMissing(user.firstNames)) missing.personal.push("First names");
        if (isMissing(user.lastName)) missing.personal.push("Last name");
        if (isMissing(user.email)) missing.personal.push("Email");
        if (isMissing(user.mobileNumber)) missing.personal.push("Mobile");
        if (isMissing(user.dateOfBirth)) missing.personal.push("Date of birth");

        if (isMissing(user.street)) missing.address.push("Street");
        if (isMissing(user.houseNumber)) missing.address.push("House number");
        if (isMissing(user.postalCode)) missing.address.push("Postal code");
        if (isMissing(user.city)) missing.address.push("City");
        if (isMissing(user.country)) missing.address.push("Country");

        if (isMissing(user.idDocumentType)) missing.identification.push("Document type");
        if (isMissing(user.idDocumentNumber)) missing.identification.push("Document number");
        if (isMissing(user.idIssueDate)) missing.identification.push("Issue date");
        if (isMissing(user.idExpirationDate)) missing.identification.push("Expiration date");
        if (isMissing(user.idIssuingCountry)) missing.identification.push("Issuing country");
        if (!user.hasIdDocumentImage) missing.identification.push("Uploaded ID document");

        if (isMissing(user.iban)) missing.bank.push("IBAN");
        if (isMissing(user.bankAccountHolderName ?? null)) missing.bank.push("Account holder");

        if (isMissing(user.emergencyContactName ?? null)) missing.emergency.push("Contact name");
        if (isMissing(user.emergencyContactRelationship ?? null)) missing.emergency.push("Relationship");
        if (isMissing(user.emergencyContactPhone ?? null)) missing.emergency.push("Phone");

        if (isMissing(user.employeeTaxProfile?.bsn ?? null)) missing.tax.push("BSN");

        if (!selectedFunctionId) missing.contract.push("Role or function");
        if (isMissing(contractDraft.functionName) && !selectedFunctionId) missing.contract.push("Function name");
        if (isMissing(contractDraft.contractType)) missing.contract.push("Contract type");
        if (!parseDisplayDate(contractDraft.startDate)) missing.contract.push("Start date");
        if (!parseDisplayDate(contractDraft.endDate)) missing.contract.push("End date");
        if (isMissing(contractDraft.grossHourlyWage)) missing.contract.push("Gross hourly wage");
        if (isMissing(contractDraft.paymentFrequency)) missing.contract.push("Payment frequency");

        return { missing };
    }, [user, contractDraft, selectedFunctionId]);

    useEffect(() => {
        if (!userId) return;
        localStorage.setItem(`onboarding-review-checked-${userId}`, JSON.stringify(checkedSections));
    }, [checkedSections, userId]);

    useEffect(() => {
        if (!userId) return;
        localStorage.setItem(
            `onboarding-review-contract-draft-${userId}`,
            JSON.stringify({ selectedFunctionId, draft: contractDraft })
        );
    }, [contractDraft, selectedFunctionId, userId]);

    useEffect(() => {
        // If fields become missing, clear the manual checkmark so the UI stays honest.
        const keys: ChecklistSectionKey[] = ["personal", "address", "identification", "bank", "emergency", "tax", "contract"];
        setCheckedSections((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const key of keys) {
                const hasMissing = (checklist.missing[key] ?? []).length > 0;
                if (hasMissing && next[key]) {
                    next[key] = false;
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [checklist.missing]);

    const handleSaveReview = async (nextDecision?: ReviewDecision) => {
        if (!userId) return;
        const decisionToSave = nextDecision ?? reviewDecision;
        if ((decisionToSave === "NEEDS_CHANGES" || decisionToSave === "REJECT_ONBOARDING") && !reviewNote.trim()) {
            setActionError("Admin note is required for this decision.");
            return;
        }
        try {
            setSavingReview(true);
            setActionError(null);
            setActionSuccess(null);
            const updated = await UserServices.updateOnboardingReview(userId, {
                decision: decisionToSave,
                note: reviewNote.trim() ? reviewNote.trim() : null,
                status: statusForReviewDecision(decisionToSave),
                checkedSections,
                contractSetupDraft: {
                    selectedFunctionId,
                    ...contractDraft,
                },
            });
            setUser(updated);
            setActionSuccess("Review saved.");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to save review.";
            setActionError(message);
        } finally {
            setSavingReview(false);
        }
    };

    const handleRequestChanges = async () => {
        setReviewDecision("NEEDS_CHANGES");
        await handleSaveReview("NEEDS_CHANGES");
    };

    const requireContractReady = (): string[] => {
        const missingFields: string[] = [];
        if (!user) return ["User data not loaded"];
        if (isMissing(user.iban)) missingFields.push("IBAN");
        if (!selectedFunctionId) missingFields.push("Role or function");
        if (isMissing(contractDraft.functionName) && !selectedFunctionId) missingFields.push("Function name");
        if (isMissing(contractDraft.contractType)) missingFields.push("Contract type");
        if (!parseDisplayDate(contractDraft.startDate)) missingFields.push("Start date");
        if (!parseDisplayDate(contractDraft.endDate)) missingFields.push("End date");
        if (isMissing(contractDraft.grossHourlyWage)) missingFields.push("Gross hourly wage");
        if (isMissing(contractDraft.paymentFrequency)) missingFields.push("Payment frequency");
        return missingFields;
    };

    const handleCreateContractDraft = async () => {
        if (!userId || !user) return;
        const missingFields = requireContractReady();
        if (missingFields.length > 0) {
            setActionError(
                "Cannot create contract yet. Please complete the following fields first:\n" + missingFields.join("\n")
            );
            return;
        }
        try {
            setActionLoading(true);
            setActionError(null);
            setActionSuccess(null);

            const payload = buildContractPayload({
                userId,
                selectedFunctionId,
                functions,
                draft: contractDraft,
            });
            const created = await UserServices.createContract(payload);
            setCurrentContract(created);
            setActionSuccess("Contract draft created.");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to create contract draft.";
            setActionError(message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreateAndSend = async () => {
        if (!userId || !user) return;
        if (!canSendContract) {
            const labels: Record<ChecklistSectionKey, string> = {
                personal: "Personal information",
                address: "Address",
                identification: "Identification",
                bank: "Bank details",
                emergency: "Emergency contact",
                tax: "Tax information",
                contract: "Contract setup",
            };
            const incomplete = checklistKeys.filter((key) => !isSectionComplete(key)).map((key) => labels[key]);
            setActionError(
                "Cannot send contract yet. Please complete and check all review sections first:\n" + incomplete.join("\n")
            );
            return;
        }
        const missingFields = requireContractReady();
        if (missingFields.length > 0) {
            setActionError(
                "Cannot send contract yet. Please complete the following fields first:\n" + missingFields.join("\n")
            );
            return;
        }

        try {
            setActionLoading(true);
            setActionError(null);
            setActionSuccess(null);

            let contract = currentContract;
            if (!contract) {
                const payload = buildContractPayload({
                    userId,
                    selectedFunctionId,
                    functions,
                    draft: contractDraft,
                });
                contract = await UserServices.createContract(payload);
                setCurrentContract(contract);
            }

            const sent = await UserServices.sendContract(contract.contractId);
            setCurrentContract(sent);
            setActionSuccess("Contract email sent to employee.");
            try {
                const updatedUser = await UserServices.updateOnboardingReview(userId, {
                    decision: "READY_TO_SEND_CONTRACT",
                    note: reviewNote.trim() ? reviewNote.trim() : null,
                    status: "PENDING_CONTRACT_SIGNATURE",
                });
                setUser(updatedUser);
                setReviewDecision("READY_TO_SEND_CONTRACT");
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Contract sent, but failed to update onboarding status.";
                setActionError(message);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to create and send contract.";
            setActionError(message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectOnboarding = async () => {
        if (!userId) return;
        if (!reviewNote.trim()) {
            setActionError("Admin note is required to reject onboarding.");
            return;
        }
        try {
            setActionLoading(true);
            setActionError(null);
            setActionSuccess(null);

            await AuthServices.disableUser(userId);
            const updated = await UserServices.updateOnboardingReview(userId, {
                decision: "REJECT_ONBOARDING",
                note: reviewNote.trim(),
                status: "REJECTED",
            });
            setUser(updated);
            setActionSuccess("Onboarding rejected and account disabled.");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to reject onboarding.";
            setActionError(message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenIdDocument = async () => {
        if (!userId) return;
        try {
            setIdDocumentLoading(true);
            setIdDocumentError(null);
            setIdDocumentNoFile(false);
            const blob = await UserServices.getUserIdDocumentImage(userId);
            if (!blob) {
                setIdDocumentNoFile(true);
                return;
            }
            const url = URL.createObjectURL(blob);
            const opened = window.open(url, "_blank", "noopener");
            if (!opened) {
                const a = document.createElement("a");
                a.href = url;
                a.download = `id-document-${userId}`;
                a.rel = "noopener";
                document.body.appendChild(a);
                a.click();
                a.remove();
            }
            window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to open ID document image.";
            setIdDocumentError(message);
        } finally {
            setIdDocumentLoading(false);
        }
    };

    const missingFor = (key: ChecklistSectionKey) => checklist.missing[key] ?? [];
    const canCheckSection = (key: ChecklistSectionKey) => missingFor(key).length === 0;
    const isSectionComplete = (key: ChecklistSectionKey) => canCheckSection(key) && checkedSections[key];
    const checklistKeys: ChecklistSectionKey[] = ["personal", "address", "identification", "bank", "emergency", "tax", "contract"];
    const canSendContract = checklistKeys.every((key) => isSectionComplete(key));
    const toggleSection = (key: ChecklistSectionKey) => {
        if (!canCheckSection(key)) return;
        setCheckedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };
    const sectionTitle = (key: ChecklistSectionKey, label: string) => (
        <label className="reviewSectionTitle">
            <input
                type="checkbox"
                checked={checkedSections[key]}
                onChange={() => toggleSection(key)}
                disabled={!canCheckSection(key)}
            />
            <span>{label}</span>
        </label>
    );
    const sectionCardClass = (key: ChecklistSectionKey) =>
        `reviewCard${isSectionComplete(key) ? " reviewCard--complete" : ""}`;

    if (!userId) {
        return (
            <>
                <Navbar />
                <div className="adminDashboardPage">
                    <div className="pageShell">
                        <PrimaryNav />
                        <div className="pageShellContent">
                            <header className="pageHeader">
                                <PageBack to="/management/onboarding-review" />
                                <h1 className="pageTitle">Onboarding Review</h1>
                            </header>
                            <div className="adminDashboardCard">
                                <Card title="Error">
                                    <div className="listEmpty errorText">Missing user id.</div>
                                </Card>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header className="pageHeader">
                            <PageBack to="/management/onboarding-review" />
                            <div className="adminOnboardingReviewHeader">
                                <h1 className="pageTitle">Onboarding Review</h1>
                                <p className="pageSubtitle">
                                    Review employee information before creating and sending the contract.
                                </p>
                            </div>
                        </header>

                        <div className="adminDashboardCard adminOnboardingReviewDetails">
                            {loading ? (
                                <div className="listEmpty">Loading onboarding review...</div>
                            ) : error ? (
                                <div className="listEmpty errorText">{error}</div>
                            ) : !user ? (
                                <div className="listEmpty">Employee not found.</div>
                            ) : (
                                <>
                                    <Card title="Employee summary" className="reviewCard">
                                        <div className="reviewSummaryTop">
                                            <div className="reviewSummaryName">{personFullName(user)}</div>
                                            <span className={`reviewStatusBadge reviewStatusBadge--${badgeTone}`}>
                                                {badgeLabel}
                                            </span>
                                        </div>
                                        <div className="reviewSummaryGrid">
                                            <div className="reviewSummaryItem">
                                                <div className="reviewSummaryLabel">Full name</div>
                                                <div className="reviewSummaryValue">{personFullName(user)}</div>
                                            </div>
                                            <div className="reviewSummaryItem">
                                                <div className="reviewSummaryLabel">Email</div>
                                                <div className="reviewSummaryValue">{user.email}</div>
                                            </div>
                                            <div className="reviewSummaryItem">
                                                <div className="reviewSummaryLabel">Phone number</div>
                                                <div className="reviewSummaryValue">{user.mobileNumber ?? "-"}</div>
                                            </div>
                                            <div className="reviewSummaryItem">
                                                <div className="reviewSummaryLabel">Position</div>
                                                <div className="reviewSummaryValue">{user.position ?? "-"}</div>
                                            </div>
                                            <div className="reviewSummaryItem">
                                                <div className="reviewSummaryLabel">Status</div>
                                                <div className="reviewSummaryValue">{user.status ?? "-"}</div>
                                            </div>
                                            <div className="reviewSummaryItem">
                                                <div className="reviewSummaryLabel">Registered date</div>
                                                <div className="reviewSummaryValue">{registeredLabel}</div>
                                            </div>
                                        </div>
                                    </Card>

                                    <div className="reviewSections">
                                        <Card title={sectionTitle("personal", "Personal information")} className={sectionCardClass("personal")}>
                                            {missingFor("personal").length ? (
                                                <div className="reviewSectionMissing">Missing: {missingFor("personal").join(", ")}</div>
                                            ) : null}
                                            <div className="reviewRows">
                                                <div className="reviewRow">
                                                    <div className="reviewLabel">Full name</div>
                                                    <div className="reviewValue">{personFullName(user)}</div>
                                                </div>
                                                <div className="reviewRow">
                                                    <div className="reviewLabel">Preferred name</div>
                                                    <div className="reviewValue">{valueLabel(user.preferredName)}</div>
                                                </div>
                                                <div className="reviewRow">
                                                    <div className="reviewLabel">First names</div>
                                                    <div className={`reviewValue ${isMissing(user.firstNames) ? "reviewValue--missing" : ""}`}>
                                                        {valueLabel(user.firstNames)}
                                                    </div>
                                                </div>
                                                <div className="reviewRow">
                                                    <div className="reviewLabel">Middle name prefix</div>
                                                    <div className="reviewValue">{valueLabel(user.middleNamePrefix)}</div>
                                                </div>
                                                <div className="reviewRow">
                                                    <div className="reviewLabel">Last name</div>
                                                    <div className={`reviewValue ${isMissing(user.lastName) ? "reviewValue--missing" : ""}`}>
                                                        {valueLabel(user.lastName)}
                                                    </div>
                                                </div>
                                                <div className="reviewRow">
                                                    <div className="reviewLabel">Gender</div>
                                                    <div className="reviewValue">{valueLabel(user.gender)}</div>
                                                </div>
                                                <div className="reviewRow">
                                                    <div className="reviewLabel">Date of birth</div>
                                                    <div className={`reviewValue ${isMissing(user.dateOfBirth) ? "reviewValue--missing" : ""}`}>
                                                        {valueLabel(user.dateOfBirth)}
                                                    </div>
                                                </div>
                                                <div className="reviewRow">
                                                    <div className="reviewLabel">Nationality</div>
                                                    <div className="reviewValue">{valueLabel(user.nationality ?? null)}</div>
                                                </div>
                                                <div className="reviewRow">
                                                    <div className="reviewLabel">Email</div>
                                                    <div className={`reviewValue ${isMissing(user.email) ? "reviewValue--missing" : ""}`}>
                                                        {valueLabel(user.email)}
                                                    </div>
                                                </div>
                                                <div className="reviewRow">
                                                    <div className="reviewLabel">Mobile</div>
                                                    <div className={`reviewValue ${isMissing(user.mobileNumber) ? "reviewValue--missing" : ""}`}>
                                                        {valueLabel(user.mobileNumber)}
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>

                                        <Card title={sectionTitle("address", "Address")} className={sectionCardClass("address")}>
                                            {missingFor("address").length ? (
                                                <div className="reviewSectionMissing">Missing: {missingFor("address").join(", ")}</div>
                                            ) : null}
                                            <div className="reviewRows">
                                                {[
                                                    ["Street", user.street],
                                                    ["House number", user.houseNumber],
                                                    ["House number suffix", user.houseNumberSuffix],
                                                    ["Postal code", user.postalCode],
                                                    ["City", user.city],
                                                    ["Country", user.country],
                                                ].map(([label, value]) => (
                                                    <div key={label} className="reviewRow">
                                                        <div className="reviewLabel">{label}</div>
                                                        <div className={`reviewValue ${isMissing(value) ? "reviewValue--missing" : ""}`}>
                                                            {valueLabel(value)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>

                                        <Card title={sectionTitle("identification", "Identification")} className={sectionCardClass("identification")}>
                                            {missingFor("identification").length ? (
                                                <div className="reviewSectionMissing">Missing: {missingFor("identification").join(", ")}</div>
                                            ) : null}
                                            <div className="reviewRows">
                                                {[
                                                    ["Document type", user.idDocumentType ?? null],
                                                    ["Document number", user.idDocumentNumber ?? null],
                                                    ["Issue date", user.idIssueDate ?? null],
                                                    ["Expiration date", user.idExpirationDate ?? null],
                                                    ["Issuing country", user.idIssuingCountry ?? null],
                                                ].map(([label, value]) => (
                                                    <div key={label} className="reviewRow">
                                                        <div className="reviewLabel">{label}</div>
                                                        <div className={`reviewValue ${isMissing(value) ? "reviewValue--missing" : ""}`}>
                                                            {valueLabel(value)}
                                                        </div>
                                                    </div>
                                                ))}
                                            <div className="reviewRow">
                                                <div className="reviewLabel">Uploaded ID document</div>
                                                <div className="reviewValue">
                                                        {user.hasIdDocumentImage ? (
                                                            <button
                                                                type="button"
                                                                className="button buttonSecondary"
                                                                onClick={() => void handleOpenIdDocument()}
                                                                disabled={idDocumentLoading}
                                                            >
                                                                {idDocumentLoading ? "Opening..." : "Open ID document"}
                                                            </button>
                                                        ) : (
                                                            <div className="reviewInlineWarn">Missing ID document</div>
                                                        )}
                                                        {idDocumentNoFile ? (
                                                            <div className="reviewInlineWarn">Missing ID document</div>
                                                        ) : null}
                                                        {idDocumentError ? (
                                                            <div className="reviewInlineError">{idDocumentError}</div>
                                                        ) : null}
                                                </div>
                                            </div>
                                            </div>
                                        </Card>

                                        <Card title={sectionTitle("bank", "Bank details")} className={sectionCardClass("bank")}>
                                            {missingFor("bank").length ? (
                                                <div className="reviewSectionMissing">Missing: {missingFor("bank").join(", ")}</div>
                                            ) : null}
                                            <div className="reviewRows">
                                                <div className="reviewRow">
                                                    <div className="reviewLabel">Account holder</div>
                                                    <div className={`reviewValue ${isMissing(user.bankAccountHolderName ?? null) ? "reviewValue--missing" : ""}`}>
                                                        {valueLabel(user.bankAccountHolderName ?? null)}
                                                    </div>
                                                </div>
                                                <div className="reviewRow">
                                                    <div className="reviewLabel">IBAN</div>
                                                    <div className={`reviewValue ${isMissing(user.iban) ? "reviewValue--missing reviewValue--important" : ""}`}>
                                                        {valueLabel(user.iban)}
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>

                                        <Card title={sectionTitle("emergency", "Emergency contact")} className={sectionCardClass("emergency")}>
                                            {missingFor("emergency").length ? (
                                                <div className="reviewSectionMissing">Missing: {missingFor("emergency").join(", ")}</div>
                                            ) : null}
                                            <div className="reviewRows">
                                                {[
                                                    ["Contact name", user.emergencyContactName ?? null],
                                                    ["Relationship", user.emergencyContactRelationship ?? null],
                                                    ["Phone", user.emergencyContactPhone ?? null],
                                                    ["Email", user.emergencyContactEmail ?? null],
                                                ].map(([label, value]) => (
                                                    <div key={label} className="reviewRow">
                                                        <div className="reviewLabel">{label}</div>
                                                        <div className={`reviewValue ${isMissing(value) ? "reviewValue--missing" : ""}`}>
                                                            {valueLabel(value)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>

                                        <Card title={sectionTitle("tax", "Tax information")} className={sectionCardClass("tax")}>
                                            {missingFor("tax").length ? (
                                                <div className="reviewSectionMissing">Missing: {missingFor("tax").join(", ")}</div>
                                            ) : null}
                                            <div className="reviewRows">
                                                <div className="reviewRow">
                                                    <div className="reviewLabel">BSN</div>
                                                    <div className={`reviewValue ${isMissing(user.employeeTaxProfile?.bsn ?? null) ? "reviewValue--missing" : ""}`}>
                                                        {valueLabel(user.employeeTaxProfile?.bsn ?? null)}
                                                    </div>
                                                </div>
                                                <div className="reviewRow">
                                                    <div className="reviewLabel">Apply loonheffingskorting</div>
                                                    <div className="reviewValue">{boolLabel(user.employeeTaxProfile?.applyLoonheffingskorting)}</div>
                                                </div>
                                                <div className="reviewRow">
                                                    <div className="reviewLabel">Pension participant</div>
                                                    <div className="reviewValue">{boolLabel(user.employeeTaxProfile?.pensionParticipant)}</div>
                                                </div>
                                                <div className="reviewRow">
                                                    <div className="reviewLabel">Special employee ZVW contribution</div>
                                                    <div className="reviewValue">{boolLabel(user.employeeTaxProfile?.specialZvwContribution)}</div>
                                                </div>
                                                <div className="reviewRow">
                                                    <div className="reviewLabel">Payroll notes</div>
                                                    <div className="reviewValue">{valueLabel(user.employeeTaxProfile?.payrollNotes ?? null)}</div>
                                                </div>
                                            </div>
                                        </Card>

                                        <Card title={sectionTitle("contract", "Contract setup")} className={sectionCardClass("contract")}>
                                            {missingFor("contract").length ? (
                                                <div className="reviewSectionMissing">Missing: {missingFor("contract").join(", ")}</div>
                                            ) : null}
                                            <div className="reviewFormGrid">
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">
                                                        Role or function <span className="reviewRequired">*</span>
                                                    </span>
                                                    <select
                                                        className={`uiSelect ${!selectedFunctionId ? "reviewInputMissing" : ""}`}
                                                        value={selectedFunctionId}
                                                        onChange={(event) => {
                                                            const nextId = event.target.value;
                                                            setSelectedFunctionId(nextId);
                                                            const selected = functions.find((fn) => fn.functionId === nextId);
                                                            if (selected?.functionName) {
                                                                setContractDraft((prev) => ({ ...prev, functionName: selected.functionName }));
                                                            }
                                                        }}
                                                        disabled={actionLoading}
                                                    >
                                                        <option value="">Select a function</option>
                                                        {functions.map((fn) => (
                                                            <option key={fn.functionId} value={fn.functionId}>
                                                                {fn.functionName}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">
                                                        Function name <span className="reviewRequired">*</span>
                                                    </span>
                                                    <input
                                                        className={`uiSelect ${isMissing(contractDraft.functionName) && !selectedFunctionId ? "reviewInputMissing" : ""}`}
                                                        value={contractDraft.functionName}
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({ ...prev, functionName: event.target.value }))
                                                        }
                                                        placeholder="Function name"
                                                        disabled={actionLoading || Boolean(selectedFunctionId)}
                                                    />
                                                </label>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">
                                                        Contract type <span className="reviewRequired">*</span>
                                                    </span>
                                                    <select
                                                        className={`uiSelect ${isMissing(contractDraft.contractType) ? "reviewInputMissing" : ""}`}
                                                        value={contractDraft.contractType}
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({ ...prev, contractType: event.target.value }))
                                                        }
                                                        disabled={actionLoading}
                                                    >
                                                        <option value="">Select a contract type</option>
                                                        <option value="ON_CALL_RUNNER">On-call (Runner)</option>
                                                        <option value="ON_CALL_BAR">On-call (Bar)</option>
                                                        <option value="FIXED_HOURS">Fixed hours</option>
                                                    </select>
                                                </label>
                                                <div className="reviewFieldRow">
                                                    <label className="reviewField">
                                                        <span className="reviewFieldLabel">
                                                            Start date <span className="reviewRequired">*</span>
                                                        </span>
                                                        <input
                                                            className={`uiSelect ${!parseDisplayDate(contractDraft.startDate) ? "reviewInputMissing" : ""}`}
                                                            value={contractDraft.startDate}
                                                            onChange={(event) =>
                                                                setContractDraft((prev) => ({
                                                                    ...prev,
                                                                    startDate: normalizeDateInput(event.target.value),
                                                                }))
                                                            }
                                                            inputMode="numeric"
                                                            placeholder="dd/mm/yyyy"
                                                            maxLength={10}
                                                            disabled={actionLoading}
                                                        />
                                                    </label>
                                                    <label className="reviewField">
                                                        <span className="reviewFieldLabel">
                                                            End date <span className="reviewRequired">*</span>
                                                        </span>
                                                        <input
                                                            className={`uiSelect ${!parseDisplayDate(contractDraft.endDate) ? "reviewInputMissing" : ""}`}
                                                            value={contractDraft.endDate}
                                                            onChange={(event) =>
                                                                setContractDraft((prev) => ({
                                                                    ...prev,
                                                                    endDate: normalizeDateInput(event.target.value),
                                                                }))
                                                            }
                                                            inputMode="numeric"
                                                            placeholder="dd/mm/yyyy"
                                                            maxLength={10}
                                                            disabled={actionLoading}
                                                        />
                                                    </label>
                                                </div>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">
                                                        Gross hourly wage <span className="reviewRequired">*</span>
                                                    </span>
                                                    <input
                                                        className={`uiSelect ${isMissing(contractDraft.grossHourlyWage) ? "reviewInputMissing" : ""}`}
                                                        inputMode="decimal"
                                                        value={contractDraft.grossHourlyWage}
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({ ...prev, grossHourlyWage: event.target.value }))
                                                        }
                                                        placeholder="e.g. 17.50"
                                                        disabled={actionLoading}
                                                    />
                                                </label>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">
                                                        Payment frequency <span className="reviewRequired">*</span>
                                                    </span>
                                                    <select
                                                        className={`uiSelect ${isMissing(contractDraft.paymentFrequency) ? "reviewInputMissing" : ""}`}
                                                        value={contractDraft.paymentFrequency}
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({ ...prev, paymentFrequency: event.target.value }))
                                                        }
                                                        disabled={actionLoading}
                                                    >
                                                        <option value="">Select a frequency</option>
                                                        <option value="DAILY">Daily</option>
                                                        <option value="WEEKLY">Weekly</option>
                                                        <option value="BIWEEKLY">Bi-weekly</option>
                                                        <option value="MONTHLY">Monthly</option>
                                                    </select>
                                                </label>
                                                <label className="reviewField reviewFieldCheckbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(contractDraft.travelAllowance)}
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({ ...prev, travelAllowance: event.target.checked }))
                                                        }
                                                        disabled={actionLoading}
                                                    />
                                                    <span>Travel allowance</span>
                                                </label>
                                            </div>
                                        </Card>

                                        <Card title="Review checklist" className="reviewCard">
                                            <div className="reviewChecklist">
                                                {(
                                                    [
                                                        ["personal", "Personal information"],
                                                        ["address", "Address"],
                                                        ["identification", "Identification"],
                                                        ["bank", "Bank details"],
                                                        ["emergency", "Emergency contact"],
                                                        ["tax", "Tax information"],
                                                        ["contract", "Contract setup"],
                                                    ] as const
                                                ).map(([key, label]) => {
                                                    const isComplete = canCheckSection(key) && checkedSections[key];
                                                    const isMissing = !canCheckSection(key);
                                                    return (
                                                        <div
                                                            key={key}
                                                            className={`reviewChecklistItem ${isMissing ? "reviewChecklistItem--missing" : isComplete ? "reviewChecklistItem--complete" : ""}`}
                                                        >
                                                            <label className="reviewChecklistToggle reviewChecklistToggle--inline">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checkedSections[key]}
                                                                    disabled
                                                                />
                                                                <span className="reviewChecklistLabel">{label}</span>
                                                            </label>
                                                            {missingFor(key).length ? (
                                                                <div className="reviewChecklistMissing">
                                                                    Missing: {missingFor(key).join(", ")}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </Card>

                                        <Card title="Final review decision" className="reviewCard reviewFinalCard">
                                            <p className="reviewFinalDescription">
                                                Choose what should happen with this onboarding review.
                                            </p>
                                            <div className="reviewFinalFields">
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">Review decision</span>
                                                    <select
                                                        className="uiSelect"
                                                        value={reviewDecision}
                                                        onChange={(event) => setReviewDecision(event.target.value as ReviewDecision)}
                                                        disabled={savingReview || actionLoading}
                                                    >
                                                        <option value="READY_TO_SEND_CONTRACT">Ready to send contract</option>
                                                        <option value="NEEDS_CHANGES">Needs changes</option>
                                                        <option value="REJECT_ONBOARDING">Reject onboarding</option>
                                                    </select>
                                                </label>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">Admin note</span>
                                                    <textarea
                                                        className="uiSelect"
                                                        rows={4}
                                                        value={reviewNote}
                                                        onChange={(event) => setReviewNote(event.target.value)}
                                                        placeholder="Add a note for this review"
                                                        disabled={savingReview || actionLoading}
                                                    />
                                                </label>
                                            </div>

                                            {actionError ? <pre className="reviewActionError">{actionError}</pre> : null}
                                            {actionSuccess ? <div className="helperText">{actionSuccess}</div> : null}

                                            <div className="reviewActions">
                                                <button
                                                    type="button"
                                                    className="button buttonSecondary"
                                                    onClick={() => void handleSaveReview()}
                                                    disabled={savingReview || actionLoading}
                                                >
                                                    {savingReview ? "Saving..." : "Save review"}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="button buttonSecondary"
                                                    onClick={() => void handleRequestChanges()}
                                                    disabled={savingReview || actionLoading}
                                                >
                                                    Request changes
                                                </button>
                                                <button
                                                    type="button"
                                                    className="button buttonSecondary"
                                                    onClick={() => void handleCreateContractDraft()}
                                                    disabled={savingReview || actionLoading}
                                                >
                                                    {actionLoading ? "Working..." : "Create contract draft"}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="button"
                                                    onClick={() => void handleCreateAndSend()}
                                                    disabled={savingReview || actionLoading || !canSendContract}
                                                >
                                                    {actionLoading ? "Working..." : "Create and send contract"}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="button buttonDanger"
                                                    onClick={() => void handleRejectOnboarding()}
                                                    disabled={savingReview || actionLoading}
                                                >
                                                    {actionLoading ? "Rejecting..." : "Reject onboarding"}
                                                </button>
                                            </div>
                                        </Card>
                                    </div>
                                </>
                            )}

                            {!loading && !error && user ? (
                                <div className="reviewFooterNav">
                                    <button
                                        type="button"
                                        className="button buttonSecondary"
                                        onClick={() => navigate("/management/onboarding-review")}
                                    >
                                        Back to queue
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
