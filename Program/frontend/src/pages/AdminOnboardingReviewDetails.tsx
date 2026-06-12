import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    type SignContractRequestDTO,
    type UserResponseDTO,
} from "../services/user-service/UserServices";
import {
    HORECA_CAO_OPTIONS,
    HORECA_RULE_SOURCES,
    type ContractType,
    type HolidayAllowanceMode,
    type JobPreset,
    type PayrollPeriod,
} from "../data/horecaPayrollRules";
import {
    calculateMonthlyHours,
    formatHorecaAgeGroupLabel,
    formatOnboardingReviewTravelAllowanceHelpText,
    formatSourceLabel,
    getHorecaMinimumHourlyWage,
    getManagedHorecaWageRules,
    getPayrollVariableNumber,
    getRuleSource,
    loadHorecaJobPresets,
    validateContractPayrollSettings,
} from "../utils/horecaPayrollRules";
import type { HorecaJobPresetConfigDTO, HorecaRuleVersionDTO } from "../services/user-service/Types";
import { formatDate } from "../utils/dateFormat";
import { normalizeDateInput, parseDisplayDate } from "../utils/dateInput";
import { useAuth } from "../context/AuthContext";
import { canViewEmployeeIdentification } from "../utils/permissionPolicy";
import { formatEmployerSignaturePlaceholder } from "../utils/employerSignature";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminUsers.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/AdminOnboardingReviewDetails.css";

type ReviewDecision = "READY_TO_SEND_CONTRACT" | "NEEDS_CHANGES" | "REJECT_ONBOARDING";
type IdDocumentSide = "front" | "back";
const EMPLOYER_AGREEMENT_TEXT = "I have reviewed the signed employment contract and approve it for ParadePaard.";
const CONTRACT_VERSION = "2026-05-employment-v1";

type ContractSetupDraft = {
    caoId: string;
    jobPresetId: string;
    jobTitle: string;
    jobFunction: string;
    functionGroup: string;
    functionName: string;
    contractType: string;
    startDate: string;
    endDate: string;
    grossHourlyWage: string;
    grossMonthlyWage: string;
    hoursPerWeek: string;
    payrollPeriod: PayrollPeriod;
    workLocation: string;
    loonheffingskorting: "" | "YES" | "NO";
    pensionApplicable: "" | "YES" | "NO";
    holidayAllowanceMode: HolidayAllowanceMode;
    vacationBuildUpApplicable: boolean;
    isManualWageOverride: boolean;
    manualWageOverrideReason: string;
    awfType: "LOW" | "HIGH";
    aofType: "LOW" | "HIGH";
    whkSector: string;
    zvwApplicable: boolean;
    paymentFrequency: string;
    travelAllowance: boolean;
    employerAgreementChecked: boolean;
    employerTypedSignatureName: string;
    employerDrawnSignatureImage: string;
};

type ChecklistSectionKey = "personal" | "address" | "identification" | "bank" | "emergency" | "tax" | "contract";
type PayrollPeriodOption = { value: PayrollPeriod; label: string };
type ContractTypeRuleDraft = Pick<
    ContractSetupDraft,
    "contractType" | "hoursPerWeek" | "grossMonthlyWage" | "payrollPeriod" | "paymentFrequency"
>;
type EmployerPreSignValidationInput = Pick<ContractSetupDraft, "employerAgreementChecked" | "employerTypedSignatureName">;
type CreateAndSendOnboardingContractInput = {
    currentContract: ContractResponseDTO | null;
    payload: CreateContractRequestDTO;
    reviewPayload: {
        decision: ReviewDecision;
        note: string | null;
        status: string;
        checkedSections?: Record<string, boolean> | null;
        contractSetupDraft?: Record<string, unknown> | null;
    };
    employerSignaturePayload: {
        typedSignatureName: string;
        drawnSignatureImage?: string | null;
        agreementCheckboxText: string;
        contractVersion: string;
        documentHash?: string | null;
        browserUserAgent?: string | null;
    };
    saveReview: () => Promise<void>;
    saveContractDraft: () => Promise<{ contract: ContractResponseDTO; mode: "created" | "updated" }>;
    saveEmployerSignature: (contract: ContractResponseDTO) => Promise<ContractResponseDTO>;
    sendContract: (contractId: string) => Promise<ContractResponseDTO>;
    updateReviewAfterSend: () => Promise<void>;
};

const CHECKLIST_SECTION_KEYS: ChecklistSectionKey[] = [
    "personal",
    "address",
    "identification",
    "bank",
    "emergency",
    "tax",
    "contract",
];

const STANDARD_PAYROLL_PERIOD_OPTIONS: PayrollPeriodOption[] = [
    { value: "WEEKLY", label: "Weekly" },
    { value: "BIWEEKLY", label: "Bi-weekly" },
    { value: "MONTHLY", label: "Monthly" },
    { value: "FOUR_WEEKLY", label: "Four-weekly" },
];

export function getPayrollPeriodOptionsForContractType(contractType?: string | null): PayrollPeriodOption[] {
    if (contractType === "ZERO_HOURS") {
        return [...STANDARD_PAYROLL_PERIOD_OPTIONS, { value: "EVERY_10_MINUTES", label: "10 minutes (for testing)" }];
    }
    return STANDARD_PAYROLL_PERIOD_OPTIONS;
}

export function normalizeContractDraftForContractType<T extends ContractTypeRuleDraft>(draft: T): T {
    const normalizedHoursPerWeek =
        draft.contractType === "FULL_TIME" ? "38" : draft.contractType === "ZERO_HOURS" ? "0" : (draft.hoursPerWeek ?? "");
    const normalizedGrossMonthlyWage =
        draft.contractType === "ZERO_HOURS" ? "0" : (draft.grossMonthlyWage ?? "");
    const normalizedPayrollPeriod =
        draft.contractType !== "ZERO_HOURS" && draft.payrollPeriod === "EVERY_10_MINUTES" ? "MONTHLY" : (draft.payrollPeriod ?? "");
    const normalizedPaymentFrequency =
        draft.paymentFrequency === draft.payrollPeriod ? normalizedPayrollPeriod : (draft.paymentFrequency ?? "");

    return {
        ...draft,
        hoursPerWeek: normalizedHoursPerWeek,
        grossMonthlyWage: normalizedGrossMonthlyWage,
        payrollPeriod: normalizedPayrollPeriod as T["payrollPeriod"],
        paymentFrequency: normalizedPaymentFrequency,
    };
}

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

    if (typeof record.caoId === "string") draft.caoId = record.caoId;
    if (typeof record.jobPresetId === "string") draft.jobPresetId = record.jobPresetId;
    if (typeof record.jobTitle === "string") draft.jobTitle = record.jobTitle;
    if (typeof record.jobFunction === "string") draft.jobFunction = record.jobFunction;
    if (typeof record.functionGroup === "string") draft.functionGroup = record.functionGroup;
    if (typeof record.functionName === "string") draft.functionName = record.functionName;
    if (typeof record.contractType === "string") draft.contractType = record.contractType;
    if (typeof record.startDate === "string") draft.startDate = record.startDate;
    if (typeof record.endDate === "string") draft.endDate = record.endDate;
    if (typeof record.grossHourlyWage === "string") draft.grossHourlyWage = record.grossHourlyWage;
    if (typeof record.grossMonthlyWage === "string") draft.grossMonthlyWage = record.grossMonthlyWage;
    if (typeof record.hoursPerWeek === "string") draft.hoursPerWeek = record.hoursPerWeek;
    if (
        record.payrollPeriod === "MONTHLY" ||
        record.payrollPeriod === "WEEKLY" ||
        record.payrollPeriod === "BIWEEKLY" ||
        record.payrollPeriod === "FOUR_WEEKLY" ||
        record.payrollPeriod === "EVERY_10_MINUTES"
    ) {
        draft.payrollPeriod = record.payrollPeriod;
    }
    if (typeof record.workLocation === "string") draft.workLocation = record.workLocation;
    if (record.loonheffingskorting === "YES" || record.loonheffingskorting === "NO" || record.loonheffingskorting === "") {
        draft.loonheffingskorting = record.loonheffingskorting;
    }
    if (record.pensionApplicable === "YES" || record.pensionApplicable === "NO" || record.pensionApplicable === "") {
        draft.pensionApplicable = record.pensionApplicable;
    }
    if (record.holidayAllowanceMode === "RESERVED" || record.holidayAllowanceMode === "PAID_EACH_PERIOD") {
        draft.holidayAllowanceMode = record.holidayAllowanceMode;
    }
    if (typeof record.vacationBuildUpApplicable === "boolean") draft.vacationBuildUpApplicable = record.vacationBuildUpApplicable;
    if (typeof record.isManualWageOverride === "boolean") draft.isManualWageOverride = record.isManualWageOverride;
    if (typeof record.manualWageOverrideReason === "string") draft.manualWageOverrideReason = record.manualWageOverrideReason;
    if (record.awfType === "LOW" || record.awfType === "HIGH") draft.awfType = record.awfType;
    if (record.aofType === "LOW" || record.aofType === "HIGH") draft.aofType = record.aofType;
    if (typeof record.whkSector === "string") draft.whkSector = record.whkSector;
    if (typeof record.zvwApplicable === "boolean") draft.zvwApplicable = record.zvwApplicable;
    if (typeof record.paymentFrequency === "string") draft.paymentFrequency = record.paymentFrequency;
    if (typeof record.travelAllowance === "boolean") draft.travelAllowance = record.travelAllowance;
    if (typeof record.employerAgreementChecked === "boolean") draft.employerAgreementChecked = record.employerAgreementChecked;
    if (typeof record.employerTypedSignatureName === "string") draft.employerTypedSignatureName = record.employerTypedSignatureName;
    if (typeof record.employerDrawnSignatureImage === "string") draft.employerDrawnSignatureImage = record.employerDrawnSignatureImage;

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

function boolChoice(value?: boolean | null): "" | "YES" | "NO" {
    if (value == null) return "";
    return value ? "YES" : "NO";
}

function choiceToBool(value: "" | "YES" | "NO"): boolean | null {
    if (value === "YES") return true;
    if (value === "NO") return false;
    return null;
}

function numberFromDraft(value?: string | null): number | null {
    if (!value?.trim()) return null;
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
}

function sourceIdFromDocumentName(documentName?: string | null): string {
    return HORECA_RULE_SOURCES.find((source) => source.documentName === documentName)?.id ?? "loontabel-2026-01-01";
}

function toJobPreset(dto: HorecaJobPresetConfigDTO): JobPreset {
    return {
        id: dto.id ?? dto.presetKey ?? "",
        sector: "horeca",
        presetName: dto.presetName,
        jobTitle: dto.jobTitle,
        jobFunction: dto.jobFunction,
        functionGroup: dto.functionGroup,
        defaultContractType: dto.defaultContractType as ContractType,
        defaultHourlyWage: dto.defaultHourlyWage,
        defaultMonthlyWage: dto.defaultMonthlyWage ?? 0,
        defaultHoursPerWeek: dto.defaultHoursPerWeek ?? 0,
        defaultPayrollPeriod: dto.defaultPayrollPeriod as PayrollPeriod,
        pensionApplicable: dto.pensionApplicable ?? false,
        holidayAllowanceMode: (dto.holidayAllowanceMode ?? "RESERVED") as HolidayAllowanceMode,
        vacationBuildUpApplicable: dto.vacationBuildUpApplicable ?? false,
        sourceId: sourceIdFromDocumentName(dto.documentName),
        adminNotes: dto.adminNotes ?? dto.sourceNote ?? "",
        isActive: dto.active ?? true,
    };
}

const reviewCurrencyFormatter = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
});

function moneyLabel(value?: number | null): string {
    return value == null || !Number.isFinite(value) ? "Missing" : reviewCurrencyFormatter.format(value);
}

function statusForReviewDecision(decision: ReviewDecision): string {
    if (decision === "NEEDS_CHANGES") return "CHANGES_REQUESTED";
    if (decision === "REJECT_ONBOARDING") return "REJECTED";
    return "PENDING_CONTRACT_REVIEW";
}

function buildContractPayload(input: {
    userId: string;
    employeeDateOfBirth?: string | null;
    selectedFunctionId: string;
    functions: FunctionResponseDTO[];
    draft: ContractSetupDraft;
    managedWageRules?: ReturnType<typeof getManagedHorecaWageRules>;
}): CreateContractRequestDTO {
    const selectedFunction = input.functions.find((item) => item.functionId === input.selectedFunctionId);
    const functionName =
        selectedFunction?.functionName ||
        input.draft.jobTitle.trim() ||
        input.draft.jobFunction.trim() ||
        input.draft.functionName.trim();
    const wageSource = selectedFunction?.hourlyWage ?? numberFromDraft(input.draft.grossHourlyWage);
    const startIso = parseDisplayDate(input.draft.startDate) ?? null;
    const endIso = input.draft.endDate.trim() ? parseDisplayDate(input.draft.endDate) : null;
    const validation = validateContractPayrollSettings({
        employeeDateOfBirth: input.employeeDateOfBirth,
        startDate: startIso,
        caoId: input.draft.caoId,
        jobPresetId: input.draft.jobPresetId,
        contractType: input.draft.contractType,
        functionGroup: input.draft.functionGroup,
        hourlyWage: wageSource,
        loonheffingskorting: choiceToBool(input.draft.loonheffingskorting),
        pensionApplicable: choiceToBool(input.draft.pensionApplicable),
        isManualWageOverride: input.draft.isManualWageOverride,
        manualWageOverrideReason: input.draft.manualWageOverrideReason,
    }, { wageRules: input.managedWageRules });

    if (!input.draft.caoId.trim()) throw new Error("CAO is required.");
    if (!input.draft.jobPresetId.trim()) throw new Error("Job preset is required.");
    if (!functionName.trim()) throw new Error("Function name is required.");
    if (!input.draft.contractType.trim()) throw new Error("Contract type is required.");
    if (!startIso) throw new Error("Start date is required (dd/mm/yyyy).");
    if (input.draft.endDate.trim() && !endIso) throw new Error("End date must use dd/mm/yyyy.");
    if (!Number.isFinite(wageSource) || !wageSource || wageSource <= 0) throw new Error("Gross hourly wage is required.");
    if (!input.draft.payrollPeriod.trim() && !input.draft.paymentFrequency.trim()) throw new Error("Payment frequency is required.");
    if (validation.blockingErrors.length > 0) throw new Error(validation.blockingErrors.join("\n"));

    return {
        userId: input.userId,
        functionId: selectedFunction?.functionId ?? null,
        functionName: functionName.trim(),
        contractType: input.draft.contractType,
        startDate: startIso,
        endDate: endIso,
        grossHourlyWage: wageSource,
        paymentFrequency: (input.draft.payrollPeriod || input.draft.paymentFrequency) as CreateContractRequestDTO["paymentFrequency"],
        travelAllowance: Boolean(input.draft.travelAllowance),
    };
}

export function ReviewContractDownloadAction({
    currentContract,
    actionLoading,
    onDownload,
}: {
    currentContract: ContractResponseDTO | null;
    actionLoading: boolean;
    onDownload: () => void;
}) {
    if (!currentContract) return null;
    return (
        <div className="reviewActions reviewActions--download">
            <button type="button" className="button buttonSecondary" onClick={onDownload} disabled={actionLoading}>
                {actionLoading ? "Downloading..." : "Download contract PDF"}
            </button>
        </div>
    );
}

function canReuseOnboardingContractDraft(currentContract: ContractResponseDTO | null): currentContract is ContractResponseDTO {
    if (!currentContract) return false;
    const status = normalizeStatus(currentContract.status);
    return status !== "FINALIZED" && status !== "SIGNED" && status !== "EMPLOYEE_SIGNED";
}

export function getContractDraftActionLabel(currentContract: ContractResponseDTO | null): string {
    return canReuseOnboardingContractDraft(currentContract) ? "Update contract draft" : "Create contract draft";
}

export function applyEmployeeTaxProfileDefaults(
    draft: Pick<ContractSetupDraft, "loonheffingskorting" | "pensionApplicable">,
    employeeTaxProfile?: UserResponseDTO["employeeTaxProfile"] | null
): Pick<ContractSetupDraft, "loonheffingskorting" | "pensionApplicable"> {
    return {
        loonheffingskorting: boolChoice(employeeTaxProfile?.applyLoonheffingskorting),
        pensionApplicable:
            employeeTaxProfile?.pensionParticipant == null
                ? draft.pensionApplicable
                : boolChoice(employeeTaxProfile.pensionParticipant),
    };
}

export async function saveOnboardingReviewContractDraft(input: {
    currentContract: ContractResponseDTO | null;
    payload: CreateContractRequestDTO;
    createContract: (payload: CreateContractRequestDTO) => Promise<ContractResponseDTO>;
    updateContract: (contractId: string, payload: CreateContractRequestDTO) => Promise<ContractResponseDTO>;
}): Promise<{ contract: ContractResponseDTO; mode: "created" | "updated" }> {
    if (canReuseOnboardingContractDraft(input.currentContract)) {
        const contract = await input.updateContract(input.currentContract.contractId, input.payload);
        return { contract, mode: "updated" };
    }
    const contract = await input.createContract(input.payload);
    return { contract, mode: "created" };
}

export function validateEmployerPreSignRequirements(input: EmployerPreSignValidationInput): string[] {
    const missing: string[] = [];
    if (!input.employerAgreementChecked) {
        missing.push("Employer agreement confirmation");
    }
    if (!(input.employerTypedSignatureName ?? "").trim()) {
        missing.push("Employer typed signature name");
    }
    return missing;
}

export async function saveEmployerSignatureForContract(input: {
    contract: ContractResponseDTO;
    typedSignatureName: string;
    drawnSignatureImage?: string | null;
    agreementCheckboxText: string;
    contractVersion: string;
    buildDocumentHash: (contract: ContractResponseDTO, typedSignatureName: string) => Promise<string | null>;
    browserUserAgent?: string;
    prepareEmployerSignature: (contractId: string, payload: SignContractRequestDTO) => Promise<ContractResponseDTO>;
    finalizeContract: (contractId: string, payload: SignContractRequestDTO) => Promise<ContractResponseDTO>;
}): Promise<ContractResponseDTO> {
    const documentHash = await input.buildDocumentHash(input.contract, input.typedSignatureName);
    const payload: SignContractRequestDTO = {
        typedSignatureName: input.typedSignatureName.trim(),
        drawnSignatureImage: input.drawnSignatureImage ?? null,
        agreementCheckboxText: input.agreementCheckboxText,
        contractVersion: input.contractVersion,
        documentHash,
        browserUserAgent: input.browserUserAgent,
    };

    const status = normalizeStatus(input.contract.status);
    if (status === "SIGNED" || status === "EMPLOYEE_SIGNED") {
        return input.finalizeContract(input.contract.contractId, payload);
    }

    return input.prepareEmployerSignature(input.contract.contractId, payload);
}

export async function createAndSendOnboardingContract(input: CreateAndSendOnboardingContractInput): Promise<{
    contract: ContractResponseDTO;
}> {
    await input.saveReview();
    const draftResult = await input.saveContractDraft();
    const signedDraft = await input.saveEmployerSignature(draftResult.contract);
    const sentContract = await input.sendContract(signedDraft.contractId);
    await input.updateReviewAfterSend();
    return { contract: sentContract };
}

export default function AdminOnboardingReviewDetails() {
    const navigate = useNavigate();
    const { userId } = useParams();
    const { permissions } = useAuth();
    // Without CAN_VIEW_EMPLOYEE_IDENTIFICATION the BSN and ID-document fields
    // are masked so reviewers can still process the rest of the profile/contract
    // without seeing personal identifiers.
    const canSeeIdentification = canViewEmployeeIdentification(permissions);
    const maskedIdentificationValue = "•••••";
    const renderIdentificationValue = (value?: string | null): string =>
        canSeeIdentification ? valueLabel(value) : isMissing(value) ? valueLabel(value) : maskedIdentificationValue;
    const employerSignatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const employerDrawingRef = useRef(false);

    const [currentManager, setCurrentManager] = useState<UserResponseDTO | null>(null);
    const [user, setUser] = useState<UserResponseDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [currentContract, setCurrentContract] = useState<ContractResponseDTO | null>(null);

    const [functions, setFunctions] = useState<FunctionResponseDTO[]>([]);
    const [selectedFunctionId, setSelectedFunctionId] = useState("");
    const [horecaRulesVersion, setHorecaRulesVersion] = useState<HorecaRuleVersionDTO | null>(null);
    const [horecaJobPresets, setHorecaJobPresets] = useState<JobPreset[]>(() => loadHorecaJobPresets().filter((preset) => preset.isActive));

    const [contractDraft, setContractDraft] = useState<ContractSetupDraft>({
        caoId: HORECA_CAO_OPTIONS[0].id,
        jobPresetId: "bar-employee",
        jobTitle: "Bar employee",
        jobFunction: "Bar service and guest support",
        functionGroup: "I+II",
        functionName: "Bar employee",
        contractType: "PART_TIME",
        startDate: "",
        endDate: "",
        grossHourlyWage: "14.71",
        grossMonthlyWage: "2422.25",
        hoursPerWeek: "24",
        payrollPeriod: "MONTHLY",
        workLocation: "",
        loonheffingskorting: "",
        pensionApplicable: "YES",
        holidayAllowanceMode: "RESERVED",
        vacationBuildUpApplicable: true,
        isManualWageOverride: false,
        manualWageOverrideReason: "",
        awfType: "LOW",
        aofType: "LOW",
        whkSector: "33 Horeca algemeen",
        zvwApplicable: true,
        paymentFrequency: "MONTHLY",
        travelAllowance: false,
        employerAgreementChecked: false,
        employerTypedSignatureName: "",
        employerDrawnSignatureImage: "",
    });

    const [reviewDecision, setReviewDecision] = useState<ReviewDecision>("READY_TO_SEND_CONTRACT");
    const [reviewNote, setReviewNote] = useState("");
    const [savingReview, setSavingReview] = useState(false);

    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [downloadingContractPdf, setDownloadingContractPdf] = useState(false);

    const [idDocumentLoadingSide, setIdDocumentLoadingSide] = useState<IdDocumentSide | null>(null);
    const [idDocumentFrontError, setIdDocumentFrontError] = useState<string | null>(null);
    const [idDocumentBackError, setIdDocumentBackError] = useState<string | null>(null);
    const [idDocumentFrontNoFile, setIdDocumentFrontNoFile] = useState(false);
    const [idDocumentBackNoFile, setIdDocumentBackNoFile] = useState(false);

    const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

    const [checkedSections, setCheckedSections] = useState<Record<ChecklistSectionKey, boolean>>({
        personal: false,
        address: false,
        identification: false,
        bank: false,
        emergency: false,
        tax: false,
        contract: false,
    });

    const contractDraftActionLabel = getContractDraftActionLabel(currentContract);
    const managerName = useMemo(() => currentManager ? personFullName(currentManager) : "", [currentManager]);

    useEffect(() => {
        let cancelled = false;
        UserServices.getMe()
            .then((me) => {
                if (!cancelled) setCurrentManager(me);
            })
            .catch(() => {
                if (!cancelled) setCurrentManager(null);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const load = useCallback(async () => {
        if (!userId) return;
        try {
            setLoading(true);
            setError(null);
            setActionError(null);
            setActionSuccess(null);

            const [userRes, contractRes, functionsRes, horecaRulesRes] = await Promise.all([
                UserServices.getUserById(userId),
                UserServices.getCurrentContractForUser(userId),
                UserServices.getFunctions(),
                UserServices.getCurrentHorecaRules().catch(() => null),
            ]);

            setUser(userRes);
            setCurrentContract(contractRes);
            setFunctions(functionsRes);
            setHorecaRulesVersion(horecaRulesRes);
            setHorecaJobPresets(
                horecaRulesRes?.jobPresets?.length
                    ? horecaRulesRes.jobPresets.map(toJobPreset).filter((preset) => preset.isActive)
                    : loadHorecaJobPresets().filter((preset) => preset.isActive)
            );

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
                setContractDraft((prev) =>
                    normalizeContractDraftForContractType({
                        ...prev,
                        ...serverContractDraft.draft,
                        ...applyEmployeeTaxProfileDefaults(
                            {
                                loonheffingskorting:
                                    serverContractDraft.draft.loonheffingskorting === "YES" || serverContractDraft.draft.loonheffingskorting === "NO"
                                        ? serverContractDraft.draft.loonheffingskorting
                                        : prev.loonheffingskorting,
                                pensionApplicable:
                                    serverContractDraft.draft.pensionApplicable === "YES" || serverContractDraft.draft.pensionApplicable === "NO"
                                        ? serverContractDraft.draft.pensionApplicable
                                        : prev.pensionApplicable,
                            },
                            userRes.employeeTaxProfile
                        ),
                    })
                );
            } else if (storedContractDraft) {
                try {
                    const parsed = JSON.parse(storedContractDraft) as { selectedFunctionId?: string; draft?: Partial<ContractSetupDraft> };
                    if (typeof parsed?.selectedFunctionId === "string") {
                        setSelectedFunctionId(parsed.selectedFunctionId);
                    }
                    if (parsed?.draft && typeof parsed.draft === "object") {
                        setContractDraft((prev) =>
                            normalizeContractDraftForContractType({
                                ...prev,
                                ...(parsed.draft ?? {}),
                                ...applyEmployeeTaxProfileDefaults(
                                    {
                                        loonheffingskorting:
                                            parsed.draft?.loonheffingskorting === "YES" || parsed.draft?.loonheffingskorting === "NO"
                                                ? parsed.draft.loonheffingskorting
                                                : prev.loonheffingskorting,
                                        pensionApplicable:
                                            parsed.draft?.pensionApplicable === "YES" || parsed.draft?.pensionApplicable === "NO"
                                                ? parsed.draft.pensionApplicable
                                                : prev.pensionApplicable,
                                    },
                                    userRes.employeeTaxProfile
                                ),
                            })
                        );
                    }
                } catch {
                    // ignore corrupted stored value
                }
            } else {
                setContractDraft((prev) => ({
                    ...prev,
                    ...applyEmployeeTaxProfileDefaults(prev, userRes.employeeTaxProfile),
                }));
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
    const selectedJobPreset = useMemo(
        () => horecaJobPresets.find((preset) => preset.id === contractDraft.jobPresetId) ?? null,
        [horecaJobPresets, contractDraft.jobPresetId]
    );
    const contractStartIso = useMemo(() => parseDisplayDate(contractDraft.startDate), [contractDraft.startDate]);
    const contractHourlyWage = useMemo(() => numberFromDraft(contractDraft.grossHourlyWage), [contractDraft.grossHourlyWage]);
    const contractHoursPerWeek = useMemo(() => numberFromDraft(contractDraft.hoursPerWeek), [contractDraft.hoursPerWeek]);
    const managedWageRules = useMemo(
        () => getManagedHorecaWageRules(horecaRulesVersion?.sections?.WAGE_RULES),
        [horecaRulesVersion]
    );
    const minimumWageInfo = useMemo(
        () =>
            getHorecaMinimumHourlyWage(
                {
                    dateOfBirth: user?.dateOfBirth,
                    referenceDate: contractStartIso ?? new Date().toISOString().slice(0, 10),
                    functionGroup: contractDraft.functionGroup,
                },
                { wageRules: managedWageRules }
            ),
        [user?.dateOfBirth, contractStartIso, contractDraft.functionGroup, managedWageRules]
    );
    const contractValidation = useMemo(
        () =>
            validateContractPayrollSettings({
                employeeDateOfBirth: user?.dateOfBirth,
                startDate: contractStartIso,
                caoId: contractDraft.caoId,
                jobPresetId: contractDraft.jobPresetId,
                contractType: contractDraft.contractType,
                functionGroup: contractDraft.functionGroup,
                hourlyWage: contractHourlyWage,
                loonheffingskorting: choiceToBool(contractDraft.loonheffingskorting),
                pensionApplicable: choiceToBool(contractDraft.pensionApplicable),
                isManualWageOverride: contractDraft.isManualWageOverride,
                manualWageOverrideReason: contractDraft.manualWageOverrideReason,
            }, { wageRules: managedWageRules }),
        [
            user?.dateOfBirth,
            contractStartIso,
            contractDraft.caoId,
            contractDraft.jobPresetId,
            contractDraft.contractType,
            contractDraft.functionGroup,
            contractDraft.loonheffingskorting,
            contractDraft.pensionApplicable,
            contractDraft.isManualWageOverride,
            contractDraft.manualWageOverrideReason,
            contractHourlyWage,
            managedWageRules,
        ]
    );
    const wageBelowMinimumWarning = useMemo(() => {
        const minimum = minimumWageInfo.minimumHourlyWage;
        if (minimum == null || contractHourlyWage == null) return null;
        if (contractHourlyWage >= minimum) return null;
        return `Warning: this is below minimum wage. The entered hourly wage (€${contractHourlyWage.toFixed(2)}) is below the minimum wage from the horeca wage table (€${minimum.toFixed(2)}) for this employee age.`;
    }, [contractHourlyWage, minimumWageInfo.minimumHourlyWage]);
    const contractValidationWarnings = useMemo(
        () => contractValidation.warnings.filter((item) => !wageBelowMinimumWarning || item !== wageBelowMinimumWarning.replace("Warning: this is below minimum wage. ", "")),
        [contractValidation.warnings, wageBelowMinimumWarning]
    );
    const selectedSource = useMemo(() => getRuleSource(selectedSourceId), [selectedSourceId]);
    const expectedMonthlyHours = useMemo(() => {
        if (contractDraft.contractType === "FULL_TIME") return 164.67;
        if (contractDraft.contractType === "ZERO_HOURS" && (!contractHoursPerWeek || contractHoursPerWeek === 0)) return 0;
        return calculateMonthlyHours(contractHoursPerWeek ?? 0);
    }, [contractDraft.contractType, contractHoursPerWeek]);
    const holidayAllowancePct = getPayrollVariableNumber("holidayAllowancePercentage");
    const vacationBuildUpRate = getPayrollVariableNumber("vacationBuildUpPerPaidHour");
    const pensionEmployeePct = getPayrollVariableNumber("pensionPremiumEmployee");
    const pensionEmployerPct = getPayrollVariableNumber("pensionPremiumEmployer");

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
        if (!user.hasIdDocumentImage) missing.identification.push("Front ID document");
        if (!user.hasIdDocumentBackImage) missing.identification.push("Back ID document");

        if (isMissing(user.iban)) missing.bank.push("IBAN");
        if (isMissing(user.bankAccountHolderName ?? null)) missing.bank.push("Account holder");

        if (isMissing(user.emergencyContactName ?? null)) missing.emergency.push("Contact name");
        if (isMissing(user.emergencyContactRelationship ?? null)) missing.emergency.push("Relationship");
        if (isMissing(user.emergencyContactPhone ?? null)) missing.emergency.push("Phone");

        if (isMissing(user.employeeTaxProfile?.bsn ?? null)) missing.tax.push("BSN");

        if (isMissing(contractDraft.caoId)) missing.contract.push("CAO");
        if (isMissing(contractDraft.jobPresetId)) missing.contract.push("Job preset");
        if (isMissing(contractDraft.jobTitle)) missing.contract.push("Job title");
        if (isMissing(contractDraft.jobFunction)) missing.contract.push("Job function");
        if (isMissing(contractDraft.functionGroup)) missing.contract.push("Function group");
        if (isMissing(contractDraft.contractType)) missing.contract.push("Contract type");
        if (!parseDisplayDate(contractDraft.startDate)) missing.contract.push("Start date");
        if (contractDraft.endDate.trim() && !parseDisplayDate(contractDraft.endDate)) missing.contract.push("Valid end date");
        if (isMissing(contractDraft.hoursPerWeek) && contractDraft.contractType !== "ZERO_HOURS") missing.contract.push("Hours per week");
        if (isMissing(contractDraft.grossHourlyWage)) missing.contract.push("Gross hourly wage");
        if (isMissing(contractDraft.payrollPeriod)) missing.contract.push("Payroll period");
        if (isMissing(contractDraft.loonheffingskorting)) missing.contract.push("Loonheffingskorting");
        if (isMissing(contractDraft.pensionApplicable)) missing.contract.push("Pension setting");
        if (contractValidation.blockingErrors.length > 0) missing.contract.push(...contractValidation.blockingErrors);

        return { missing };
    }, [user, contractDraft, contractValidation.blockingErrors]);

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
        if (contractDraft.isManualWageOverride) return;
        if (minimumWageInfo.minimumHourlyWage == null) return;
        const nextHourlyWage = minimumWageInfo.minimumHourlyWage.toFixed(2);
        setContractDraft((prev) => {
            if (prev.isManualWageOverride) return prev;
            if (prev.grossHourlyWage === nextHourlyWage) return prev;
            return {
                ...prev,
                grossHourlyWage: nextHourlyWage,
            };
        });
    }, [contractDraft.isManualWageOverride, minimumWageInfo.minimumHourlyWage]);

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

    useEffect(() => {
        const canvas = employerSignatureCanvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (!contractDraft.employerDrawnSignatureImage) return;

        const image = new Image();
        image.onload = () => {
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
        };
        image.src = contractDraft.employerDrawnSignatureImage;
    }, [contractDraft.employerDrawnSignatureImage]);

    const buildReviewUpdatePayload = useCallback((decision: ReviewDecision, statusOverride?: string) => ({
        decision,
        note: reviewNote.trim() ? reviewNote.trim() : null,
        status: statusOverride ?? statusForReviewDecision(decision),
        checkedSections,
        contractSetupDraft: {
            selectedFunctionId,
            ...contractDraft,
        },
    }), [checkedSections, contractDraft, reviewNote, selectedFunctionId]);

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
            const updated = await UserServices.updateOnboardingReview(userId, buildReviewUpdatePayload(decisionToSave));
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
        if (isMissing(contractDraft.caoId)) missingFields.push("CAO");
        if (isMissing(contractDraft.jobPresetId)) missingFields.push("Job preset");
        if (isMissing(contractDraft.jobTitle)) missingFields.push("Job title");
        if (isMissing(contractDraft.jobFunction)) missingFields.push("Job function");
        if (isMissing(contractDraft.functionGroup)) missingFields.push("Function group");
        if (isMissing(contractDraft.contractType)) missingFields.push("Contract type");
        if (!parseDisplayDate(contractDraft.startDate)) missingFields.push("Start date");
        if (contractDraft.endDate.trim() && !parseDisplayDate(contractDraft.endDate)) missingFields.push("Valid end date");
        if (isMissing(contractDraft.hoursPerWeek) && contractDraft.contractType !== "ZERO_HOURS") missingFields.push("Hours per week");
        if (isMissing(contractDraft.grossHourlyWage)) missingFields.push("Gross hourly wage");
        if (isMissing(contractDraft.payrollPeriod)) missingFields.push("Payroll period");
        if (isMissing(contractDraft.loonheffingskorting)) missingFields.push("Loonheffingskorting");
        if (isMissing(contractDraft.pensionApplicable)) missingFields.push("Pension setting");
        missingFields.push(...contractValidation.blockingErrors);
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
                employeeDateOfBirth: user.dateOfBirth,
                selectedFunctionId,
                functions,
                draft: contractDraft,
                managedWageRules,
            });
            const result = await saveOnboardingReviewContractDraft({
                currentContract,
                payload,
                createContract: UserServices.createContract,
                updateContract: UserServices.updateContract,
            });
            setCurrentContract(result.contract);

            // Also persist the optional employer signature (typed name and the
            // optional drawn image) so it doesn't get lost between sessions.
            // The backend requires the typed name and agreement to be present
            // before it accepts any signature data, so if either is missing we
            // skip silently and only save the contract fields.
            const canSaveEmployerSignature =
                contractDraft.employerAgreementChecked &&
                contractDraft.employerTypedSignatureName.trim().length > 0;

            let employerSignatureSaved = false;
            let employerSignatureFinalizedContract = false;
            let employerSignatureError: string | null = null;
            if (canSaveEmployerSignature && normalizeStatus(result.contract.status) !== "FINALIZED") {
                try {
                    const signed = await saveEmployerSignatureForContract({
                        contract: result.contract,
                        typedSignatureName: contractDraft.employerTypedSignatureName.trim(),
                        drawnSignatureImage: contractDraft.employerDrawnSignatureImage || null,
                        agreementCheckboxText: EMPLOYER_AGREEMENT_TEXT,
                        contractVersion: CONTRACT_VERSION,
                        buildDocumentHash: buildEmployerDocumentHash,
                        browserUserAgent: navigator.userAgent,
                        prepareEmployerSignature: UserServices.prepareEmployerSignature,
                        finalizeContract: UserServices.finalizeContract,
                    });
                    setCurrentContract(signed);
                    employerSignatureSaved = true;
                    employerSignatureFinalizedContract =
                        normalizeStatus(result.contract.status) !== "FINALIZED" &&
                        normalizeStatus(signed.status) === "FINALIZED";
                } catch (err: unknown) {
                    // Don't fail the whole save just because the signature
                    // persistence failed — the contract changes are already
                    // committed. Surface the reason as part of the success/
                    // warning line so the admin can react.
                    employerSignatureError =
                        err instanceof Error ? err.message : "Failed to save employer signature.";
                }
            }

            const baseMessage = result.mode === "updated" ? "Contract draft updated." : "Contract draft created.";
            if (employerSignatureSaved) {
                setActionSuccess(
                    employerSignatureFinalizedContract
                        ? `${baseMessage} Employer signature saved and contract finalized.`
                        : `${baseMessage} Employer signature saved.`
                );
            } else if (employerSignatureError) {
                setActionSuccess(`${baseMessage} Employer signature could not be saved: ${employerSignatureError}`);
            } else {
                setActionSuccess(baseMessage);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to save contract draft.";
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
        const missingEmployerFields = validateEmployerPreSignRequirements(contractDraft);
        if (missingEmployerFields.length > 0) {
            setActionError(
                "Cannot send contract yet. Please complete the following employer signing fields first:\n" + missingEmployerFields.join("\n")
            );
            return;
        }

        try {
            setActionLoading(true);
            setSavingReview(true);
            setActionError(null);
            setActionSuccess(null);

            const payload = buildContractPayload({
                userId,
                employeeDateOfBirth: user.dateOfBirth,
                selectedFunctionId,
                functions,
                draft: contractDraft,
                managedWageRules,
            });
            const result = await createAndSendOnboardingContract({
                currentContract,
                payload,
                reviewPayload: buildReviewUpdatePayload("READY_TO_SEND_CONTRACT"),
                employerSignaturePayload: {
                    typedSignatureName: contractDraft.employerTypedSignatureName.trim(),
                    drawnSignatureImage: contractDraft.employerDrawnSignatureImage || null,
                    agreementCheckboxText: EMPLOYER_AGREEMENT_TEXT,
                    contractVersion: CONTRACT_VERSION,
                },
                saveReview: async () => {
                    const updated = await UserServices.updateOnboardingReview(
                        userId,
                        buildReviewUpdatePayload("READY_TO_SEND_CONTRACT")
                    );
                    setUser(updated);
                    setReviewDecision("READY_TO_SEND_CONTRACT");
                },
                saveContractDraft: async () => {
                    const draftResult = await saveOnboardingReviewContractDraft({
                        currentContract,
                        payload,
                        createContract: UserServices.createContract,
                        updateContract: UserServices.updateContract,
                    });
                    setCurrentContract(draftResult.contract);
                    return draftResult;
                },
                saveEmployerSignature: async (contract) => {
                    const prepared = await saveEmployerSignatureForContract({
                        contract,
                        typedSignatureName: contractDraft.employerTypedSignatureName.trim(),
                        drawnSignatureImage: contractDraft.employerDrawnSignatureImage || null,
                        agreementCheckboxText: EMPLOYER_AGREEMENT_TEXT,
                        contractVersion: CONTRACT_VERSION,
                        buildDocumentHash: buildEmployerDocumentHash,
                        browserUserAgent: navigator.userAgent,
                        prepareEmployerSignature: UserServices.prepareEmployerSignature,
                        finalizeContract: UserServices.finalizeContract,
                    });
                    setCurrentContract(prepared);
                    return prepared;
                },
                sendContract: async (contractId) => {
                    const sent = await UserServices.sendContract(contractId);
                    setCurrentContract(sent);
                    return sent;
                },
                updateReviewAfterSend: async () => {
                    const updatedUser = await UserServices.updateOnboardingReview(userId, {
                        ...buildReviewUpdatePayload("READY_TO_SEND_CONTRACT", "PENDING_CONTRACT_SIGNATURE"),
                        decision: "READY_TO_SEND_CONTRACT",
                    });
                    setUser(updatedUser);
                    setReviewDecision("READY_TO_SEND_CONTRACT");
                },
            });
            setCurrentContract(result.contract);
            setActionSuccess("Contract email sent to employee.");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to create and send contract.";
            setActionError(message);
        } finally {
            setSavingReview(false);
            setActionLoading(false);
        }
    };

    const beginEmployerDrawing = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (actionLoading || savingReview) return;
        const canvas = employerSignatureCanvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        canvas.setPointerCapture(event.pointerId);
        employerDrawingRef.current = true;
        const point = canvasPoint(canvas, event);
        context.beginPath();
        context.moveTo(point.x, point.y);
    }, [actionLoading, savingReview]);

    const drawEmployerSignature = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!employerDrawingRef.current || actionLoading || savingReview) return;
        const canvas = employerSignatureCanvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        const point = canvasPoint(canvas, event);
        context.lineWidth = 2;
        context.lineCap = "round";
        context.strokeStyle = "#111827";
        context.lineTo(point.x, point.y);
        context.stroke();
    }, [actionLoading, savingReview]);

    const endEmployerDrawing = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
        const canvas = employerSignatureCanvasRef.current;
        if (canvas?.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }
        if (!employerDrawingRef.current || !canvas) return;
        employerDrawingRef.current = false;
        setContractDraft((prev) => ({
            ...prev,
            employerDrawnSignatureImage: canvas.toDataURL("image/png"),
        }));
    }, []);

    const clearEmployerSignature = () => {
        const canvas = employerSignatureCanvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        setContractDraft((prev) => ({ ...prev, employerDrawnSignatureImage: "" }));
    };

    const handleDownloadContractPdf = async () => {
        if (!currentContract) return;
        try {
            setDownloadingContractPdf(true);
            setActionError(null);
            const blob = await UserServices.getContractPdf(currentContract.contractId);
            const url = URL.createObjectURL(blob);
            try {
                const a = document.createElement("a");
                a.href = url;
                a.download = `contract_${currentContract.contractId}.pdf`;
                a.rel = "noopener";
                document.body.appendChild(a);
                a.click();
                a.remove();
            } finally {
                URL.revokeObjectURL(url);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to download contract PDF.";
            setActionError(message);
        } finally {
            setDownloadingContractPdf(false);
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

    const handleOpenIdDocument = async (side: IdDocumentSide) => {
        if (!userId) return;
        const setError = side === "front" ? setIdDocumentFrontError : setIdDocumentBackError;
        const setNoFile = side === "front" ? setIdDocumentFrontNoFile : setIdDocumentBackNoFile;
        const label = side === "front" ? "front" : "back";
        try {
            setIdDocumentLoadingSide(side);
            setError(null);
            setNoFile(false);
            const blob = side === "front"
                ? await UserServices.getUserIdDocumentImage(userId)
                : await UserServices.getUserIdDocumentBackImage(userId);
            if (!blob) {
                setNoFile(true);
                return;
            }
            const url = URL.createObjectURL(blob);
            const opened = window.open(url, "_blank", "noopener");
            if (!opened) {
                const a = document.createElement("a");
                a.href = url;
                a.download = `id-document-${label}-${userId}`;
                a.rel = "noopener";
                document.body.appendChild(a);
                a.click();
                a.remove();
            }
            window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : `Failed to open ${label} ID document image.`;
            setError(message);
        } finally {
            setIdDocumentLoadingSide(null);
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
    const sourceButton = (sourceId: string, pageNumber?: string) => (
        <button
            type="button"
            className="reviewSourcePill"
            onClick={() => setSelectedSourceId(sourceId)}
        >
            {formatSourceLabel(sourceId, pageNumber)}
        </button>
    );
    const applyJobPreset = (presetId: string) => {
        const preset = horecaJobPresets.find((item) => item.id === presetId);
        if (!preset) {
            setContractDraft((prev) => ({ ...prev, jobPresetId: "" }));
            return;
        }
        const referenceDate = parseDisplayDate(contractDraft.startDate) ?? new Date().toISOString().slice(0, 10);
        const presetMinimum = getHorecaMinimumHourlyWage(
            {
                dateOfBirth: user?.dateOfBirth,
                referenceDate,
                functionGroup: preset.functionGroup,
            },
            { wageRules: managedWageRules }
        );
        setSelectedFunctionId("");
        setContractDraft((prev) =>
            normalizeContractDraftForContractType({
                ...prev,
                caoId: HORECA_CAO_OPTIONS[0].id,
                jobPresetId: preset.id,
                jobTitle: preset.jobTitle,
                jobFunction: preset.jobFunction,
                functionGroup: preset.functionGroup,
                functionName: preset.jobTitle,
                contractType: preset.defaultContractType,
                grossHourlyWage: (presetMinimum.minimumHourlyWage ?? preset.defaultHourlyWage).toFixed(2),
                grossMonthlyWage: preset.defaultMonthlyWage.toFixed(2),
                hoursPerWeek: String(preset.defaultHoursPerWeek),
                payrollPeriod: preset.defaultPayrollPeriod,
                paymentFrequency: preset.defaultPayrollPeriod,
                pensionApplicable: boolChoice(preset.pensionApplicable),
                holidayAllowanceMode: preset.holidayAllowanceMode,
                vacationBuildUpApplicable: preset.vacationBuildUpApplicable,
                isManualWageOverride: false,
                manualWageOverrideReason: "",
            })
        );
    };

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
                                                            {renderIdentificationValue(value)}
                                                        </div>
                                                    </div>
                                                ))}
                                            <div className="reviewRow">
                                                <div className="reviewLabel">Uploaded ID documents</div>
                                                <div className="reviewValue">
                                                    {canSeeIdentification ? (
                                                        <div className="reviewDocumentActions">
                                                            <div className="reviewDocumentAction">
                                                                {user.hasIdDocumentImage ? (
                                                                    <button
                                                                        type="button"
                                                                        className="button buttonSecondary"
                                                                        onClick={() => void handleOpenIdDocument("front")}
                                                                        disabled={idDocumentLoadingSide !== null}
                                                                    >
                                                                        {idDocumentLoadingSide === "front" ? "Opening..." : "Open front"}
                                                                    </button>
                                                                ) : (
                                                                    <div className="reviewInlineWarn">Missing front</div>
                                                                )}
                                                                {idDocumentFrontNoFile ? (
                                                                    <div className="reviewInlineWarn">Missing front</div>
                                                                ) : null}
                                                                {idDocumentFrontError ? (
                                                                    <div className="reviewInlineError">{idDocumentFrontError}</div>
                                                                ) : null}
                                                            </div>
                                                            <div className="reviewDocumentAction">
                                                                {user.hasIdDocumentBackImage ? (
                                                                    <button
                                                                        type="button"
                                                                        className="button buttonSecondary"
                                                                        onClick={() => void handleOpenIdDocument("back")}
                                                                        disabled={idDocumentLoadingSide !== null}
                                                                    >
                                                                        {idDocumentLoadingSide === "back" ? "Opening..." : "Open back"}
                                                                    </button>
                                                                ) : (
                                                                    <div className="reviewInlineWarn">Missing back</div>
                                                                )}
                                                                {idDocumentBackNoFile ? (
                                                                    <div className="reviewInlineWarn">Missing back</div>
                                                                ) : null}
                                                                {idDocumentBackError ? (
                                                                    <div className="reviewInlineError">{idDocumentBackError}</div>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="reviewFieldHelp">
                                                            You do not have permission to view uploaded ID documents.
                                                        </div>
                                                    )}
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
                                                        {renderIdentificationValue(user.employeeTaxProfile?.bsn ?? null)}
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

                                        <Card title={sectionTitle("contract", "Contract setup")} className={`${sectionCardClass("contract")} reviewContractCard--singleColumn`}>
                                            {missingFor("contract").length ? (
                                                <div className="reviewSectionMissing">Missing: {missingFor("contract").join(", ")}</div>
                                            ) : null}
                                            <div className="reviewContractSplit">
                                                <div className="reviewContractSourceBox">
                                                    <h3>Employee provided information</h3>
                                                    <p>
                                                        Personal identity, address, bank, identification, emergency contact, and tax
                                                        choice come from the employee onboarding profile.
                                                    </p>
                                                </div>
                                                <div className="reviewContractSourceBox">
                                                    <h3>Admin selected contract information</h3>
                                                    <p>
                                                        CAO, job preset, function group, wage, dates, hours, pension, holiday
                                                        allowance, payroll period, and billing settings are chosen here by management.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="reviewFormGrid">
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">
                                                        Job preset <span className="reviewRequired">*</span>
                                                    </span>
                                                    <select
                                                        className={`uiSelect ${isMissing(contractDraft.jobPresetId) ? "reviewInputMissing" : ""}`}
                                                        value={contractDraft.jobPresetId}
                                                        onChange={(event) => applyJobPreset(event.target.value)}
                                                        disabled={actionLoading}
                                                    >
                                                        <option value="">Select a job preset</option>
                                                        {horecaJobPresets.map((preset) => (
                                                            <option key={preset.id} value={preset.id}>
                                                                {preset.presetName}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {selectedJobPreset ? sourceButton(selectedJobPreset.sourceId, "1") : null}
                                                </label>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">
                                                        Contract type <span className="reviewRequired">*</span>
                                                    </span>
                                                    <select
                                                        className={`uiSelect ${isMissing(contractDraft.contractType) ? "reviewInputMissing" : ""}`}
                                                        value={contractDraft.contractType}
                                                        onChange={(event) =>
                                                            setContractDraft((prev) =>
                                                                normalizeContractDraftForContractType({
                                                                    ...prev,
                                                                    contractType: event.target.value as ContractType,
                                                                })
                                                            )
                                                        }
                                                        disabled={actionLoading}
                                                    >
                                                        <option value="">Select a contract type</option>
                                                        <option value="FULL_TIME">Full time</option>
                                                        <option value="PART_TIME">Part time</option>
                                                        <option value="ZERO_HOURS">Zero hours</option>
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
                                                        <span className="reviewFieldLabel">End date if needed</span>
                                                        <input
                                                            className={`uiSelect ${
                                                                contractDraft.endDate.trim() && !parseDisplayDate(contractDraft.endDate)
                                                                    ? "reviewInputMissing"
                                                                    : ""
                                                            }`}
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
                                                        CAO <span className="reviewRequired">*</span>
                                                    </span>
                                                    <select
                                                        className={`uiSelect ${isMissing(contractDraft.caoId) ? "reviewInputMissing" : ""}`}
                                                        value={contractDraft.caoId}
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({ ...prev, caoId: event.target.value }))
                                                        }
                                                        disabled={actionLoading}
                                                    >
                                                        <option value="">Select a CAO</option>
                                                        {HORECA_CAO_OPTIONS.map((cao) => (
                                                            <option key={cao.id} value={cao.id}>
                                                                {cao.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {sourceButton("horeca-cao-2025-2026", "12")}
                                                </label>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">
                                                        Function group <span className="reviewRequired">*</span>
                                                    </span>
                                                    <select
                                                        className={`uiSelect ${isMissing(contractDraft.functionGroup) ? "reviewInputMissing" : ""}`}
                                                        value={contractDraft.functionGroup}
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({ ...prev, functionGroup: event.target.value }))
                                                        }
                                                        disabled={actionLoading}
                                                    >
                                                        <option value="">Select a function group</option>
                                                        <option value="I+II">I plus II</option>
                                                        <option value="III">III</option>
                                                        <option value="IV">IV</option>
                                                        <option value="V">V</option>
                                                    </select>
                                                    {sourceButton("loontabel-2026-01-01", "1")}
                                                </label>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">Age group from date of birth</span>
                                                    <input
                                                        className="uiSelect"
                                                        value={formatHorecaAgeGroupLabel(minimumWageInfo.ageGroup)}
                                                        readOnly
                                                        disabled
                                                    />
                                                    <span className="reviewFieldHelp">
                                                        The employee date of birth determines which minimum wage row is suggested for this contract.
                                                    </span>
                                                </label>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">
                                                        Job title <span className="reviewRequired">*</span>
                                                    </span>
                                                    <input
                                                        className={`uiSelect ${isMissing(contractDraft.jobTitle) ? "reviewInputMissing" : ""}`}
                                                        value={contractDraft.jobTitle}
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({
                                                                ...prev,
                                                                jobTitle: event.target.value,
                                                                functionName: event.target.value,
                                                            }))
                                                        }
                                                        placeholder="Bar employee"
                                                        disabled={actionLoading}
                                                    />
                                                </label>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">
                                                        Job function <span className="reviewRequired">*</span>
                                                    </span>
                                                    <input
                                                        className={`uiSelect ${isMissing(contractDraft.jobFunction) ? "reviewInputMissing" : ""}`}
                                                        value={contractDraft.jobFunction}
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({ ...prev, jobFunction: event.target.value }))
                                                        }
                                                        placeholder="Guest service and table care"
                                                        disabled={actionLoading}
                                                    />
                                                </label>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">
                                                        Hours per week <span className="reviewRequired">*</span>
                                                    </span>
                                                    <input
                                                        className={`uiSelect ${
                                                            isMissing(contractDraft.hoursPerWeek) && contractDraft.contractType !== "ZERO_HOURS"
                                                                ? "reviewInputMissing"
                                                                : ""
                                                        }`}
                                                        inputMode="decimal"
                                                        value={
                                                            contractDraft.contractType === "FULL_TIME"
                                                                ? "38"
                                                                : contractDraft.contractType === "ZERO_HOURS"
                                                                    ? "0"
                                                                    : contractDraft.hoursPerWeek
                                                        }
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({ ...prev, hoursPerWeek: event.target.value }))
                                                        }
                                                        disabled={
                                                            actionLoading
                                                            || contractDraft.contractType === "FULL_TIME"
                                                            || contractDraft.contractType === "ZERO_HOURS"
                                                        }
                                                    />
                                                    {sourceButton("horeca-cao-2025-2026", "12")}
                                                </label>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">
                                                        Gross hourly wage <span className="reviewRequired">*</span>
                                                    </span>
                                                    <input
                                                        className={`uiSelect ${
                                                            isMissing(contractDraft.grossHourlyWage) || contractValidation.blockingErrors.length
                                                                ? "reviewInputMissing"
                                                                : ""
                                                        }`}
                                                        inputMode="decimal"
                                                        value={contractDraft.grossHourlyWage}
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({
                                                                ...prev,
                                                                grossHourlyWage: event.target.value,
                                                                isManualWageOverride: true,
                                                            }))
                                                        }
                                                        placeholder="e.g. 14.71"
                                                        disabled={actionLoading}
                                                    />
                                                    {minimumWageInfo.minimumHourlyWage != null ? (
                                                        <span className="reviewFieldHelp">
                                                            Suggested minimum for {formatHorecaAgeGroupLabel(minimumWageInfo.ageGroup)} in group{" "}
                                                            {contractDraft.functionGroup || "?"}: {moneyLabel(minimumWageInfo.minimumHourlyWage)} per hour.
                                                        </span>
                                                    ) : null}
                                                    {wageBelowMinimumWarning ? (
                                                        <span className="reviewFieldHelp reviewFieldHelpWarning">
                                                            <span
                                                                className="reviewWarningIcon"
                                                                aria-label={wageBelowMinimumWarning}
                                                                title={wageBelowMinimumWarning}
                                                            >
                                                                !
                                                            </span>
                                                            <span>{wageBelowMinimumWarning.replace("Warning: this is below minimum wage. ", "")}</span>
                                                        </span>
                                                    ) : null}
                                                    {sourceButton("loontabel-2026-01-01", "1")}
                                                </label>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">Gross monthly wage if applicable</span>
                                                    <input
                                                        className="uiSelect"
                                                        inputMode="decimal"
                                                        value={
                                                            contractDraft.contractType === "ZERO_HOURS"
                                                                ? "0"
                                                                : contractDraft.grossMonthlyWage
                                                        }
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({ ...prev, grossMonthlyWage: event.target.value }))
                                                        }
                                                        placeholder="e.g. 2422.25"
                                                        disabled={actionLoading || contractDraft.contractType === "ZERO_HOURS"}
                                                    />
                                                    {sourceButton("loontabel-2026-01-01", "1")}
                                                </label>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">
                                                        Payroll period <span className="reviewRequired">*</span>
                                                    </span>
                                                    <select
                                                        className={`uiSelect ${isMissing(contractDraft.payrollPeriod) ? "reviewInputMissing" : ""}`}
                                                        value={contractDraft.payrollPeriod}
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({
                                                                ...prev,
                                                                payrollPeriod: event.target.value as PayrollPeriod,
                                                                paymentFrequency: event.target.value,
                                                            }))
                                                        }
                                                        disabled={actionLoading}
                                                    >
                                                        <option value="">Select a period</option>
                                                        {getPayrollPeriodOptionsForContractType(contractDraft.contractType).map((option) => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">
                                                        Loonheffingskorting <span className="reviewRequired">*</span>
                                                    </span>
                                                    <input
                                                        className={`uiSelect ${
                                                            isMissing(contractDraft.loonheffingskorting) ? "reviewInputMissing" : ""
                                                        }`}
                                                        value={
                                                            contractDraft.loonheffingskorting === "YES"
                                                                ? "Yes"
                                                                : contractDraft.loonheffingskorting === "NO"
                                                                    ? "No"
                                                                    : "Missing from onboarding"
                                                        }
                                                        readOnly
                                                        disabled
                                                    />
                                                    <span className="reviewFieldHelp">
                                                        This follows the employee onboarding tax choice and cannot be changed here.
                                                    </span>
                                                    {sourceButton("witte-maandloon-2026-01-01", "15")}
                                                </label>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">
                                                        Pension applies <span className="reviewRequired">*</span>
                                                    </span>
                                                    <select
                                                        className={`uiSelect ${isMissing(contractDraft.pensionApplicable) ? "reviewInputMissing" : ""}`}
                                                        value={contractDraft.pensionApplicable}
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({
                                                                ...prev,
                                                                pensionApplicable: event.target.value as "" | "YES" | "NO",
                                                            }))
                                                        }
                                                        disabled={actionLoading}
                                                    >
                                                        <option value="">Select pension setting</option>
                                                        <option value="YES">Yes</option>
                                                        <option value="NO">No</option>
                                                    </select>
                                                    {sourceButton("phenc-pensioenpremie", "Web page")}
                                                </label>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">Holiday allowance</span>
                                                    <select
                                                        className="uiSelect"
                                                        value={contractDraft.holidayAllowanceMode}
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({
                                                                ...prev,
                                                                holidayAllowanceMode: event.target.value as HolidayAllowanceMode,
                                                            }))
                                                        }
                                                        disabled={actionLoading}
                                                    >
                                                        <option value="RESERVED">Reserved</option>
                                                        <option value="PAID_EACH_PERIOD">Paid each period</option>
                                                    </select>
                                                    {sourceButton("horeca-cao-2025-2026", "32")}
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
                                                <div className="reviewFieldHelp reviewFieldHelpFull">
                                                    {formatOnboardingReviewTravelAllowanceHelpText()}
                                                </div>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">Work location</span>
                                                    <input
                                                        className="uiSelect"
                                                        value={contractDraft.workLocation}
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({ ...prev, workLocation: event.target.value }))
                                                        }
                                                        placeholder="Client location"
                                                        disabled={actionLoading}
                                                    />
                                                </label>
                                                <label className="reviewField">
                                                    <span className="reviewFieldLabel">Manual wage override reason</span>
                                                    <textarea
                                                        className="uiSelect"
                                                        rows={3}
                                                        value={contractDraft.manualWageOverrideReason}
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({
                                                                ...prev,
                                                                manualWageOverrideReason: event.target.value,
                                                            }))
                                                        }
                                                        placeholder="Required when the wage is manually changed"
                                                        disabled={actionLoading}
                                                    />
                                                </label>
                                            </div>
                                            <div className="reviewRuleSummary">
                                                <div>
                                                    <span>Expected monthly hours</span>
                                                    <strong>{expectedMonthlyHours.toFixed(2)}</strong>
                                                    {sourceButton("horeca-cao-2025-2026", "12")}
                                                </div>
                                                <div>
                                                    <span>Age group</span>
                                                    <strong>{formatHorecaAgeGroupLabel(minimumWageInfo.ageGroup)}</strong>
                                                    {sourceButton("loontabel-2026-01-01", "1")}
                                                </div>
                                                <div>
                                                    <span>Official hourly wage row</span>
                                                    <strong>{moneyLabel(minimumWageInfo.minimumHourlyWage)}</strong>
                                                    {minimumWageInfo.sourceId ? sourceButton(minimumWageInfo.sourceId, "1") : sourceButton("loontabel-2026-01-01", "1")}
                                                </div>
                                                <div>
                                                    <span>Holiday allowance</span>
                                                    <strong>
                                                        {holidayAllowancePct}%{" "}
                                                        {contractDraft.holidayAllowanceMode === "RESERVED"
                                                            ? "reserved"
                                                            : "paid each period"}
                                                    </strong>
                                                    {sourceButton("horeca-cao-2025-2026", "32")}
                                                </div>
                                                <div>
                                                    <span>Vacation buildup</span>
                                                    <strong>{vacationBuildUpRate} vacation hour per paid hour</strong>
                                                    {sourceButton("horeca-cao-2025-2026", "23")}
                                                </div>
                                                <div>
                                                    <span>Pension premium</span>
                                                    <strong>
                                                        {pensionEmployeePct + pensionEmployerPct}% total, {pensionEmployeePct}% employee and{" "}
                                                        {pensionEmployerPct}% employer
                                                    </strong>
                                                    {sourceButton("phenc-pensioenpremie", "Web page")}
                                                </div>
                                            </div>
                                            {contractValidation.blockingErrors.length || contractValidationWarnings.length ? (
                                                <div className="reviewRulesValidation">
                                                    {contractValidation.blockingErrors.map((item) => (
                                                        <div key={item} className="reviewInlineError">
                                                            {item}
                                                        </div>
                                                    ))}
                                                    {contractValidationWarnings.map((item) => (
                                                        <div key={item} className="reviewInlineWarn">
                                                            {item}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                            <div className="reviewSourceDetailsSection">
                                                <h3>Source details</h3>
                                                <p>
                                                    The contract preview uses employee identity fields from the employee profile and legal
                                                    employment fields from the admin selections above. Wage, holiday allowance, vacation,
                                                    payroll tax, pension, and employer premium values come from the official source labels
                                                    shown next to each value.
                                                </p>
                                            </div>
                                            {selectedSource ? (
                                                <aside className="reviewSourcePanel" aria-label="Source details">
                                                    <div className="reviewSourcePanelHeader">
                                                        <h3>{selectedSource.documentName}</h3>
                                                        <button
                                                            type="button"
                                                            className="button buttonSecondary"
                                                            onClick={() => setSelectedSourceId(null)}
                                                        >
                                                            Close source
                                                        </button>
                                                    </div>
                                                    <div className="reviewRows">
                                                        <div className="reviewRow">
                                                            <div className="reviewLabel">Document URL</div>
                                                            <div className="reviewValue">
                                                                <a href={selectedSource.sourceUrl} target="_blank" rel="noreferrer">
                                                                    {selectedSource.sourceUrl}
                                                                </a>
                                                            </div>
                                                        </div>
                                                        <div className="reviewRow">
                                                            <div className="reviewLabel">Page number</div>
                                                            <div className="reviewValue">{selectedSource.pageNumber}</div>
                                                        </div>
                                                        <div className="reviewRow">
                                                            <div className="reviewLabel">Effective date</div>
                                                            <div className="reviewValue">
                                                                {selectedSource.effectiveFrom}
                                                                {selectedSource.effectiveTo ? ` to ${selectedSource.effectiveTo}` : ""}
                                                            </div>
                                                        </div>
                                                        <div className="reviewRow">
                                                            <div className="reviewLabel">Explanation</div>
                                                            <div className="reviewValue">{selectedSource.sourceNote}</div>
                                                        </div>
                                                    </div>
                                                </aside>
                                            ) : null}
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
                                            <div className="reviewField reviewFieldCheckbox">
                                                <label className="reviewChecklistToggle reviewChecklistToggle--inline">
                                                    <input
                                                        type="checkbox"
                                                        checked={contractDraft.employerAgreementChecked}
                                                        onChange={(event) =>
                                                            setContractDraft((prev) => ({
                                                                ...prev,
                                                                employerAgreementChecked: event.target.checked,
                                                            }))
                                                        }
                                                        disabled={savingReview || actionLoading}
                                                    />
                                                    <span className="reviewChecklistLabel">{EMPLOYER_AGREEMENT_TEXT}</span>
                                                </label>
                                            </div>
                                            <label className="reviewField">
                                                <span className="reviewFieldLabel">Employer full legal name</span>
                                                <input
                                                    className="uiSelect"
                                                    value={contractDraft.employerTypedSignatureName}
                                                    onChange={(event) =>
                                                        setContractDraft((prev) => ({
                                                            ...prev,
                                                            employerTypedSignatureName: event.target.value,
                                                        }))
                                                    }
                                                    placeholder={formatEmployerSignaturePlaceholder(managerName)}
                                                    disabled={savingReview || actionLoading}
                                                />
                                            </label>
                                            <div className="reviewField">
                                                <span className="reviewFieldLabel">Optional employer drawn signature</span>
                                                <canvas
                                                    ref={employerSignatureCanvasRef}
                                                    className="contractSignatureCanvas"
                                                    width={520}
                                                    height={180}
                                                    onPointerDown={beginEmployerDrawing}
                                                    onPointerMove={drawEmployerSignature}
                                                    onPointerUp={endEmployerDrawing}
                                                    onPointerCancel={endEmployerDrawing}
                                                    aria-label="Employer drawn signature box"
                                                />
                                                <div className="reviewActions reviewActions--download">
                                                    <button
                                                        type="button"
                                                        className="button buttonSecondary"
                                                        onClick={clearEmployerSignature}
                                                        disabled={savingReview || actionLoading || !contractDraft.employerDrawnSignatureImage}
                                                    >
                                                        Clear employer signature
                                                    </button>
                                                </div>
                                                <span className="reviewFieldHelp">
                                                    This signature will be shown to the employee and used to finalize the contract automatically after the employee signs.
                                                </span>
                                            </div>

                                            {actionError ? <pre className="reviewActionError">{actionError}</pre> : null}
                                            {actionSuccess ? <div className="helperText">{actionSuccess}</div> : null}
                                            <ReviewContractDownloadAction
                                                currentContract={currentContract}
                                                actionLoading={downloadingContractPdf}
                                                onDownload={() => void handleDownloadContractPdf()}
                                            />

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
                                                    {actionLoading ? "Working..." : contractDraftActionLabel}
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

function canvasPoint(canvas: HTMLCanvasElement, event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: ((event.clientX - rect.left) / rect.width) * canvas.width,
        y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
}

async function buildEmployerDocumentHash(
    contract: ContractResponseDTO,
    typedSignatureName: string
): Promise<string | null> {
    if (!crypto.subtle) return null;
    const source = JSON.stringify({
        contractVersion: CONTRACT_VERSION,
        contractId: contract.contractId,
        userId: contract.userId,
        employerTypedSignatureName: typedSignatureName.trim(),
        employeeTypedSignatureName: contract.typedSignatureName,
        employeeSignedAt: contract.employeeSignedAt,
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
