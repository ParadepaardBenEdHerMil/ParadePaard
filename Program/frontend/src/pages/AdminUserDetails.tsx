import { type FormEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Spinner from "../components/Spinner";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import { useAuth } from "../context/AuthContext";
import { AuthServices, type RoleResponseDTO } from "../services/auth-service/AuthServices";
import {
    UserServices,
    type ContractResponseDTO,
    type CreateContractRequestDTO,
    type FunctionResponseDTO,
    type PlanningProjectDTO,
    type TimesheetRow,
    type UserResponseDTO,
} from "../services/user-service/UserServices";
// Onboarding restart on this page issues a fresh password reset link via the
// auth admin endpoint and pairs that with putting the user back into the
// CHANGES_REQUESTED state so they re-enter the onboarding form when they log
// in next.

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/GeneralInfo.css";
import "../stylesheets/PayslipDetails.css";
import "../stylesheets/Profile.css";
import "../stylesheets/UserDashboard.css";
import "../stylesheets/WorkHistory.css";
import "../stylesheets/AdminUserDetails.css";
import { formatDate, formatMaybeDateTime } from "../utils/dateFormat";
import { normalizeDateInput, parseDisplayDate } from "../utils/dateInput";
import {
    buildTimeframeOptions,
    filterTimesheetsByTimeframe,
    getIsoWeek,
    sumHours,
    timeframeLabel,
    type Timeframe,
} from "../utils/hoursSummary";
import { flattenPlanningProjects, type PlanningExplorerRow } from "../utils/planningExplorer";
import { getAllocationStatusLabel, getAllocationStatusTone } from "../utils/planningSummary";
import { BILLING_RATE_PERMISSIONS, canDeleteUsers, hasAnyPermission } from "../utils/permissionPolicy";
import { formatEmployerSignaturePlaceholder } from "../utils/employerSignature";
import AdminUserBillingRates from "./AdminUserBillingRates";

const normalizeRoleName = (value: string) => value.trim().toUpperCase();
const moneyFormatter = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const EMPLOYER_AGREEMENT_TEXT = "I have reviewed the signed employment contract and approve it for ParadePaard.";
const CONTRACT_VERSION = "2026-05-employment-v1";
const USER_DETAILS_TABS = [
    { key: "profile", label: "Profile" },
    { key: "timesheets", label: "Timesheets" },
    { key: "planning", label: "Planning" },
    { key: "billingRates", label: "Billing rates" },
] as const;

type UserDetailsTab = (typeof USER_DETAILS_TABS)[number]["key"];

type EmployerSignatureValidationState = {
    contractLoaded: boolean;
    alreadyFinalized: boolean;
    agreementChecked: boolean;
    typedName: string;
};

type ContractDraftFormState = {
    functionName: string;
    functionGroup: string;
    contractType: string;
    startDate: string;
    endDate: string;
    grossHourlyWage: string;
    paymentFrequency: string;
    travelAllowance: boolean;
};

type ContractDraftPayloadInput = {
    userId: string;
    functionId: string;
    fallbackFunctionName?: string | null;
    functions: FunctionResponseDTO[];
    draft: ContractDraftFormState;
};

type ContractDraftVisibilityState = {
    canManageContracts: boolean;
    contractLoading: boolean;
    currentContract: Pick<ContractResponseDTO, "contractId" | "userId"> | null;
    userStatus?: string | null;
};

type DeleteUserActionState = {
    permissions: readonly string[] | null | undefined;
    currentManagerUserId?: string | null;
    viewedUserId?: string | null;
};

export function canSubmitEmployerContractSignature(state: EmployerSignatureValidationState): boolean {
    if (!state.contractLoaded || state.alreadyFinalized || !state.agreementChecked) return false;
    return state.typedName.trim().replace(/\s+/g, " ").length > 0;
}

export function canShowCreateContractDraft(state: ContractDraftVisibilityState): boolean {
    if (!state.canManageContracts || state.contractLoading || state.currentContract) return false;
    return Boolean(state.userStatus);
}

export function canShowDeleteUserAction(state: DeleteUserActionState): boolean {
    if (!canDeleteUsers(state.permissions)) return false;
    if (!state.currentManagerUserId || !state.viewedUserId) return false;
    return state.currentManagerUserId !== state.viewedUserId;
}

export function buildContractDraftPayload(input: ContractDraftPayloadInput): CreateContractRequestDTO {
    const selectedFunction = input.functions.find((item) => item.functionId === input.functionId);
    const functionName = selectedFunction?.functionName
        || input.draft.functionName.trim()
        || input.fallbackFunctionName
        || "";
    const wageSource = selectedFunction?.hourlyWage ?? Number(input.draft.grossHourlyWage);
    if (!functionName.trim()) {
        throw new Error("Role/function is required.");
    }
    if (!input.draft.startDate) {
        throw new Error("Start date is required.");
    }
    if (!Number.isFinite(wageSource) || wageSource <= 0) {
        throw new Error("Gross hourly wage is required.");
    }
    return {
        userId: input.userId,
        functionId: selectedFunction?.functionId ?? null,
        functionName: functionName.trim(),
        contractType: input.draft.contractType,
        startDate: input.draft.startDate,
        endDate: input.draft.endDate.trim() ? input.draft.endDate : null,
        grossHourlyWage: Number(wageSource),
        paymentFrequency: input.draft.paymentFrequency,
        travelAllowance: input.draft.travelAllowance,
    };
}

const CONTRACT_REVIEW_STATUS_PRIORITY: Record<string, number> = {
    EMPLOYEE_SIGNED: 0,
    SIGNED: 1,
    SENT_TO_EMPLOYEE: 2,
    DRAFT: 3,
    REJECTED: 4,
    FINALIZED: 5,
};

export function selectContractForReview(contracts: ContractResponseDTO[]): ContractResponseDTO | null {
    if (contracts.length === 0) return null;
    return [...contracts].sort((left, right) => {
        const leftStatus = (left.status ?? "").toUpperCase();
        const rightStatus = (right.status ?? "").toUpperCase();
        const statusSort = (CONTRACT_REVIEW_STATUS_PRIORITY[leftStatus] ?? 99)
            - (CONTRACT_REVIEW_STATUS_PRIORITY[rightStatus] ?? 99);
        if (statusSort !== 0) return statusSort;
        return (right.startDate ?? "").localeCompare(left.startDate ?? "");
    })[0] ?? null;
}

function formatValue(value: string | number | boolean | null | undefined): string | number {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        return formatMaybeDateTime(value);
    }
    return value;
}

function formatPosition(value: string | null | undefined): string {
    if (!value || value.trim() === "") return "-";
    const normalized = value.trim().toUpperCase();
    if (normalized === "BAR") return "Bar";
    if (normalized === "RUNNER") return "Runner";
    return value;
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
        case "EVERY_5_MINUTES":
            return "Test only";
        case "EVERY_10_MINUTES":
            return "10 minutes (testing)";
        default:
            return value ?? "-";
    }
}

function formatLocation(user: UserResponseDTO | null): string {
    if (!user) return "-";
    const parts = [user.city, user.country].map((part) => (part ?? "").trim()).filter(Boolean);
    return parts.join(", ") || "-";
}

function formatDateWithSlashes(value?: string | null): string {
    return formatDate(value);
}

function toDateTime(shiftDate: string, value: string): Date | null {
    if (!value) return null;
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) return direct;

    const timePart = value.includes("T") ? value.split("T")[1] ?? "" : value;
    const normalizedTime = timePart.trim().slice(0, 5);
    if (!normalizedTime) return null;

    const combined = new Date(`${shiftDate}T${normalizedTime}`);
    return Number.isNaN(combined.getTime()) ? null : combined;
}

function formatTimeLabel(value: string): string {
    if (!value) return "-";
    const timePart = value.includes("T") ? value.split("T")[1] ?? "" : value;
    const normalizedTime = timePart.trim();
    return normalizedTime ? normalizedTime.slice(0, 5) : "-";
}

function formatPlanningTimeRange(row: PlanningExplorerRow): string {
    return `${formatTimeLabel(row.startTime)} - ${formatTimeLabel(row.endTime)}`;
}

function sortPlanningRowsAsc(rows: PlanningExplorerRow[]): PlanningExplorerRow[] {
    return [...rows].sort((left, right) => {
        return (
            left.shiftDate.localeCompare(right.shiftDate) ||
            left.startTime.localeCompare(right.startTime) ||
            left.projectName.localeCompare(right.projectName)
        );
    });
}

function sortPlanningRowsDesc(rows: PlanningExplorerRow[]): PlanningExplorerRow[] {
    return [...rows].sort((left, right) => {
        return (
            right.shiftDate.localeCompare(left.shiftDate) ||
            right.startTime.localeCompare(left.startTime) ||
            left.projectName.localeCompare(right.projectName)
        );
    });
}

function getStatusTone(status: string): "success" | "warning" | "danger" | "neutral" {
    const normalized = status.trim().toUpperCase();
    if (normalized === "ACTIVE") return "success";
    if (normalized === "PENDING_SETUP") return "warning";
    if (normalized.includes("CANCEL") || normalized.includes("INACTIVE")) return "danger";
    return "neutral";
}

export default function AdminUserDetails() {
    const navigate = useNavigate();
    const location = useLocation();
    const { userId } = useParams<{ userId: string }>();
    const { permissions, permissionsLoading, permissionsError } = useAuth();
    const employerSignatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const employerDrawingRef = useRef(false);
    const [activeTab, setActiveTab] = useState<UserDetailsTab>(
        location.pathname.endsWith("/billing-rates") ? "billingRates" : "profile"
    );

    const [currentManager, setCurrentManager] = useState<UserResponseDTO | null>(null);
    const [user, setUser] = useState<UserResponseDTO | null>(null);
    const [userLoading, setUserLoading] = useState(true);
    const [userError, setUserError] = useState<string | null>(null);

    const [timesheets, setTimesheets] = useState<TimesheetRow[]>([]);
    const [timesheetLoading, setTimesheetLoading] = useState(true);
    const [timesheetError, setTimesheetError] = useState<string | null>(null);
    const [timeframe, setTimeframe] = useState<Timeframe>({ kind: "all" });
    const [timeframeInitialized, setTimeframeInitialized] = useState(false);

    const [planningProjects, setPlanningProjects] = useState<PlanningProjectDTO[]>([]);
    const [planningLoading, setPlanningLoading] = useState(false);
    const [planningError, setPlanningError] = useState<string | null>(null);
    const [currentContract, setCurrentContract] = useState<ContractResponseDTO | null>(null);
    const [contractLoading, setContractLoading] = useState(true);
    const [contractError, setContractError] = useState<string | null>(null);
    const [contractActionLoading, setContractActionLoading] = useState(false);
    const [contractActionSuccess, setContractActionSuccess] = useState<string | null>(null);
    const [contractRejectComment, setContractRejectComment] = useState("");
    const [employerAgreementChecked, setEmployerAgreementChecked] = useState(false);
    const [employerTypedName, setEmployerTypedName] = useState("");
    const [employerSignatureImage, setEmployerSignatureImage] = useState<string | null>(null);
    // Onboarding-restart action state. Used by the "Send onboarding invite"
    // button shown in the Active contract card when no contract exists yet.
    const [restartOnboardingLoading, setRestartOnboardingLoading] = useState(false);
    const [restartOnboardingError, setRestartOnboardingError] = useState<string | null>(null);
    const [restartOnboardingSuccess, setRestartOnboardingSuccess] = useState<string | null>(null);

    const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
    const [profilePictureLoading, setProfilePictureLoading] = useState(false);
    const [profilePictureError, setProfilePictureError] = useState<string | null>(null);
    const [idDocumentLoading, setIdDocumentLoading] = useState(false);
    const [idDocumentError, setIdDocumentError] = useState<string | null>(null);
    const [idDocumentNoFile, setIdDocumentNoFile] = useState(false);

    const [userRoles, setUserRoles] = useState<string[]>([]);
    const [rolesLoading, setRolesLoading] = useState(false);
    const [rolesError, setRolesError] = useState<string | null>(null);
    const [roleOptions, setRoleOptions] = useState<RoleResponseDTO[]>([]);
    const [roleOptionsLoading, setRoleOptionsLoading] = useState(false);
    const [roleOptionsError, setRoleOptionsError] = useState<string | null>(null);
    const [roleSaveError, setRoleSaveError] = useState<string | null>(null);
    const [roleSaveSuccess, setRoleSaveSuccess] = useState<string | null>(null);
    const [roleSaving, setRoleSaving] = useState(false);
    const [showRolePicker, setShowRolePicker] = useState(false);
    const rolePickerRef = useRef<HTMLDivElement | null>(null);
    const [deleteUserModalOpen, setDeleteUserModalOpen] = useState(false);
    const [deleteUserLoading, setDeleteUserLoading] = useState(false);
    const [deleteUserError, setDeleteUserError] = useState<string | null>(null);

    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const currentMoment = useMemo(() => new Date(), []);
    const [dateOfIssue, setDateOfIssue] = useState(formatDateWithSlashes(today));
    const [functionName, setFunctionName] = useState("");
    const [hoursWorked, setHoursWorked] = useState("");
    const [travelExpenses, setTravelExpenses] = useState("");
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const uniqueRoles = useCallback((roles: string[]) => {
        const map = new Map<string, string>();
        roles.forEach((role) => {
            const key = normalizeRoleName(role);
            if (!key || map.has(key)) return;
            map.set(key, role);
        });
        return Array.from(map.values());
    }, []);

    const loadUser = useCallback(async () => {
        if (!userId) {
            setUserError("Missing user id.");
            setUserLoading(false);
            return;
        }
        try {
            setUserLoading(true);
            setUserError(null);
            const data = await UserServices.getUserById(userId);
            setUser(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load user profile.";
            setUserError(message);
        } finally {
            setUserLoading(false);
        }
    }, [userId]);

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

    const loadTimesheets = useCallback(async () => {
        if (!userId) return;
        try {
            setTimesheetLoading(true);
            setTimesheetError(null);
            const data = await UserServices.getTimesheets();
            setTimesheets(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load timesheets.";
            setTimesheetError(message);
        } finally {
            setTimesheetLoading(false);
        }
    }, [userId]);

    const loadPlanning = useCallback(async () => {
        if (!userId) return;
        try {
            setPlanningLoading(true);
            setPlanningError(null);
            const company = await UserServices.getMyCompany();
            const data = await UserServices.getPlanningOverview(company.companyId);
            setPlanningProjects(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load planning.";
            setPlanningError(message);
        } finally {
            setPlanningLoading(false);
        }
    }, [userId]);

    const loadCurrentContract = useCallback(async () => {
        if (!userId) return;
        try {
            setContractLoading(true);
            setContractError(null);
            const contracts = await UserServices.getContractsForUser(userId);
            setCurrentContract(selectContractForReview(contracts));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load contracts.";
            setContractError(message);
        } finally {
            setContractLoading(false);
        }
    }, [userId]);

    const loadUserRoles = useCallback(async () => {
        if (!userId) return;
        try {
            setRolesLoading(true);
            setRolesError(null);
            const data = await AuthServices.getUserRoles([userId]);
            const roles = data[0]?.roles ?? [];
            setUserRoles(uniqueRoles(roles));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load user roles.";
            setRolesError(message);
        } finally {
            setRolesLoading(false);
        }
    }, [uniqueRoles, userId]);

    const loadRoleOptions = useCallback(async () => {
        try {
            setRoleOptionsLoading(true);
            setRoleOptionsError(null);
            const data = await AuthServices.getRoles();
            setRoleOptions(data ?? []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load roles.";
            setRoleOptionsError(message);
        } finally {
            setRoleOptionsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadUser();
    }, [loadUser]);

    useEffect(() => {
        void loadTimesheets();
    }, [loadTimesheets]);

    useEffect(() => {
        void loadPlanning();
    }, [loadPlanning]);

    useEffect(() => {
        void loadCurrentContract();
    }, [loadCurrentContract]);

    useEffect(() => {
        void loadUserRoles();
    }, [loadUserRoles]);

    useEffect(() => {
        void loadRoleOptions();
    }, [loadRoleOptions]);

    useEffect(() => {
        setActiveTab(location.pathname.endsWith("/billing-rates") ? "billingRates" : "profile");
    }, [location.pathname]);

    useEffect(() => {
        setRoleSaveError(null);
        setRoleSaveSuccess(null);
    }, [userId]);

    const handleDeleteUser = async () => {
        if (!user) return;
        try {
            setDeleteUserLoading(true);
            setDeleteUserError(null);
            await UserServices.deleteUser(user.userId);
            setDeleteUserModalOpen(false);
            navigate("/management/users");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to delete user.";
            setDeleteUserError(message);
        } finally {
            setDeleteUserLoading(false);
        }
    };

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        let objectUrl: string | null = null;

        setProfilePictureLoading(true);
        setProfilePictureError(null);
        setProfilePictureUrl(null);

        UserServices.getUserProfilePicture(userId)
            .then((blob) => {
                if (cancelled) return;
                if (blob) {
                    objectUrl = URL.createObjectURL(blob);
                    setProfilePictureUrl(objectUrl);
                } else {
                    setProfilePictureUrl(null);
                }
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : "Failed to load profile picture.";
                setProfilePictureError(message);
                setProfilePictureUrl(null);
            })
            .finally(() => {
                if (!cancelled) setProfilePictureLoading(false);
            });

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [userId]);

    useEffect(() => {
        setTimeframe({ kind: "all" });
        setTimeframeInitialized(false);
    }, [userId]);

    const displayName = useMemo(() => {
        if (!user) return "";
        const parts = [user.firstNames, user.middleNamePrefix, user.lastName]
            .map((part) => (part ?? "").trim())
            .filter(Boolean);
        if (parts.length > 0) return parts.join(" ");
        const preferred = (user.preferredName ?? "").trim();
        return preferred || user.email;
    }, [user]);

    const defaultAvatarLetter = useMemo(() => {
        const trimmed = displayName.trim();
        return (trimmed[0] ?? "?").toUpperCase();
    }, [displayName]);

    const canAssignRoles = permissions.includes("CAN_ASSIGN_ROLES");
    const canRemoveRoles = permissions.includes("CAN_REMOVE_ROLES");
    const canManageContracts = permissions.includes("CAN_MANAGE_CONTRACTS");
    const canReviewContracts = permissions.includes("CAN_REVIEW_CONTRACTS");
    const canFinalizeContracts = permissions.includes("CAN_FINALIZE_CONTRACT");
    // Gates the BSN and ID document fields. Admins without it still see the
    // employee profile and contract but the actual ID values are masked.
    const canViewIdentification = permissions.includes("CAN_VIEW_EMPLOYEE_IDENTIFICATION");
    const maskedIdentificationValue = "•••••";
    const maskIdentification = (value: string | number): string | number => {
        if (canViewIdentification) return value;
        // Preserve the empty-state "-" placeholder so the row still reads as
        // missing rather than masked when there's actually no value to hide.
        return value === "-" ? value : maskedIdentificationValue;
    };
    const canDeleteViewedUser = canShowDeleteUserAction({
        permissions,
        currentManagerUserId: currentManager?.userId ?? null,
        viewedUserId: user?.userId ?? userId ?? null,
    });

    const sortedUserRoles = useMemo(() => {
        const list = uniqueRoles(userRoles);
        return [...list].sort((left, right) => left.localeCompare(right));
    }, [uniqueRoles, userRoles]);

    const availableRoles = useMemo(() => {
        const assigned = new Set(sortedUserRoles.map((role) => normalizeRoleName(role)));
        return roleOptions
            .map((role) => role.name)
            .filter((role) => !assigned.has(normalizeRoleName(role)))
            .sort((left, right) => left.localeCompare(right));
    }, [roleOptions, sortedUserRoles]);

    useEffect(() => {
        if (availableRoles.length === 0 && showRolePicker) {
            setShowRolePicker(false);
        }
    }, [availableRoles.length, showRolePicker]);

    const userTimesheets = useMemo(
        () => timesheets.filter((timesheet) => timesheet.userId === userId),
        [timesheets, userId]
    );

    const timeframeOptions = useMemo(() => buildTimeframeOptions(userTimesheets), [userTimesheets]);

    const yearOptions = useMemo(() => {
        const nowYear = new Date().getFullYear();
        const years = new Set<number>(timeframeOptions.years);
        years.add(nowYear);
        for (let index = 1; index <= 5; index += 1) years.add(nowYear - index);
        return [...years].sort((left, right) => right - left);
    }, [timeframeOptions.years]);

    useEffect(() => {
        if (timeframeInitialized) return;
        if (userTimesheets.length === 0) return;
        if (timeframeOptions.weeks.length > 0) {
            setTimeframe({ kind: "week", ...timeframeOptions.weeks[0] });
            setTimeframeInitialized(true);
            return;
        }
        if (timeframeOptions.months.length > 0) {
            setTimeframe({ kind: "month", ...timeframeOptions.months[0] });
            setTimeframeInitialized(true);
            return;
        }
        if (timeframeOptions.years.length > 0) {
            setTimeframe({ kind: "year", year: timeframeOptions.years[0] });
            setTimeframeInitialized(true);
        }
    }, [
        timeframeInitialized,
        timeframeOptions.months,
        timeframeOptions.weeks,
        timeframeOptions.years,
        userTimesheets.length,
    ]);

    const filteredTimesheets = useMemo(() => {
        const filtered = filterTimesheetsByTimeframe(userTimesheets, timeframe);
        return [...filtered].sort((left, right) => {
            return (right.dateOfIssue ?? "").localeCompare(left.dateOfIssue ?? "");
        });
    }, [timeframe, userTimesheets]);

    const totalHours = useMemo(() => sumHours(filteredTimesheets), [filteredTimesheets]);
    const totalLoggedHours = useMemo(() => sumHours(userTimesheets), [userTimesheets]);
    const totalTravelExpenses = useMemo(() => {
        return userTimesheets.reduce((sum, timesheet) => sum + Number(timesheet.travelExpenses ?? 0), 0);
    }, [userTimesheets]);
    const averageTimesheetHours = useMemo(() => {
        if (userTimesheets.length === 0) return 0;
        return totalLoggedHours / userTimesheets.length;
    }, [totalLoggedHours, userTimesheets.length]);
    const latestTimesheet = useMemo(() => filteredTimesheets[0] ?? userTimesheets[0] ?? null, [
        filteredTimesheets,
        userTimesheets,
    ]);

    const planningRows = useMemo(() => {
        if (!userId) return [];
        return flattenPlanningProjects(planningProjects).filter((row) => row.employeeId === userId);
    }, [planningProjects, userId]);

    const activePlanningRows = useMemo(() => {
        return sortPlanningRowsAsc(
            planningRows.filter((row) => {
                if (row.status === "CANCELLED") return false;
                const start = toDateTime(row.shiftDate, row.startTime);
                const end = toDateTime(row.shiftDate, row.endTime);
                if (!start || !end) return row.shiftDate === today;
                return start <= currentMoment && end >= currentMoment;
            })
        );
    }, [currentMoment, planningRows, today]);

    const upcomingPlanningRows = useMemo(() => {
        return sortPlanningRowsAsc(
            planningRows.filter((row) => {
                if (row.status === "CANCELLED") return false;
                const start = toDateTime(row.shiftDate, row.startTime);
                if (!start) return row.shiftDate > today;
                return start > currentMoment;
            })
        );
    }, [currentMoment, planningRows, today]);

    const pastPlanningRows = useMemo(() => {
        return sortPlanningRowsDesc(
            planningRows.filter((row) => {
                if (row.status === "CANCELLED") return true;
                const end = toDateTime(row.shiftDate, row.endTime);
                if (!end) return row.shiftDate < today;
                return end < currentMoment;
            })
        );
    }, [currentMoment, planningRows, today]);

    const acceptedPlanningCount = useMemo(() => {
        return planningRows.filter((row) => row.status === "CONFIRMED").length;
    }, [planningRows]);

    const handleCreateTimesheet = async (event: FormEvent) => {
        event.preventDefault();
        if (!user || !userId) return;

        const parsedDateOfIssue = parseDisplayDate(dateOfIssue);
        const hours = Number(hoursWorked);
        const travel = travelExpenses.trim() === "" ? 0 : Number(travelExpenses);

        if (!parsedDateOfIssue) {
            setSaveError("Please enter a valid date in dd/mm/yyyy format.");
            return;
        }
        if (!functionName.trim()) {
            setSaveError("Please enter a function name.");
            return;
        }
        if (!Number.isFinite(hours) || hours <= 0) {
            setSaveError("Please enter a valid number of hours.");
            return;
        }
        if (!Number.isFinite(travel) || travel < 0) {
            setSaveError("Please enter a valid travel expense.");
            return;
        }

        try {
            setSaving(true);
            setSaveError(null);
            setSaveSuccess(null);
            await UserServices.createTimesheet({
                userId,
                name: displayName,
                dateOfIssue: parsedDateOfIssue,
                function: functionName.trim(),
                hoursWorked: hours,
                travelExpenses: travel,
            });
            setHoursWorked("");
            setTravelExpenses("");
            setFunctionName("");
            setSaveSuccess("Timesheet added.");
            await loadTimesheets();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to create timesheet.";
            setSaveError(message);
        } finally {
            setSaving(false);
        }
    };

    const updateUserRoles = async (nextRoles: string[], successMessage: string) => {
        if (!userId) return;
        try {
            setRoleSaving(true);
            setRoleSaveError(null);
            setRoleSaveSuccess(null);
            await AuthServices.setUserRoles(userId, nextRoles);
            setUserRoles(uniqueRoles(nextRoles));
            setRoleSaveSuccess(successMessage);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to update roles.";
            setRoleSaveError(message);
        } finally {
            setRoleSaving(false);
        }
    };

    const handleRemoveRole = async (roleName: string) => {
        if (!canRemoveRoles) return;
        const normalized = normalizeRoleName(roleName);
        const nextRoles = sortedUserRoles.filter((role) => normalizeRoleName(role) !== normalized);
        if (nextRoles.length === sortedUserRoles.length) return;
        await updateUserRoles(nextRoles, "Role removed.");
    };

    const handleAddRole = async (roleName: string) => {
        if (!canAssignRoles || !roleName) return;
        const nextRoles = uniqueRoles([...sortedUserRoles, roleName]);
        await updateUserRoles(nextRoles, "Role added.");
    };

    const downloadContractPdf = async () => {
        if (!currentContract) return;
        try {
            setContractError(null);
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
            setContractError(message);
        }
    };

    const handleSendContract = async () => {
        if (!currentContract) return;
        try {
            setContractActionLoading(true);
            setContractError(null);
            setContractActionSuccess(null);
            const updated = await UserServices.sendContract(currentContract.contractId);
            setCurrentContract(updated);
            setContractActionSuccess("Contract email sent to employee.");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to send contract.";
            setContractError(message);
        } finally {
            setContractActionLoading(false);
        }
    };

    // Restart onboarding from the user-details page: when there is no
    // contract yet, the recommended way to start one is to send the employee
    // back through the onboarding form. This sets the user's status back to
    // CHANGES_REQUESTED (so the onboarding form is what they see at next
    // login) and emails them a fresh account-setup link. After they submit,
    // the admin can review and create the contract from the onboarding
    // review page.
    const handleSendOnboardingInvite = async () => {
        if (!userId) return;
        try {
            setRestartOnboardingLoading(true);
            setRestartOnboardingError(null);
            setRestartOnboardingSuccess(null);
            const updated = await UserServices.updateOnboardingReview(userId, {
                decision: "NEEDS_CHANGES",
                note: "Onboarding restarted by admin from the user details page.",
                status: "CHANGES_REQUESTED",
            });
            setUser(updated);
            await AuthServices.resendOnboardingEmail(userId);
            setRestartOnboardingSuccess(
                "Onboarding invitation sent. The employee will be asked to review or update their details and submit them for review."
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to send onboarding invitation.";
            setRestartOnboardingError(message);
        } finally {
            setRestartOnboardingLoading(false);
        }
    };

    const handleOpenIdDocumentImage = async () => {
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

    const handleFinalizeContract = async () => {
        if (!currentContract) return;
        try {
            setContractActionLoading(true);
            setContractError(null);
            setContractActionSuccess(null);
            const documentHash = await buildEmployerDocumentHash(currentContract, employerTypedName);
            const updated = await UserServices.finalizeContract(currentContract.contractId, {
                typedSignatureName: employerTypedName.trim(),
                drawnSignatureImage: employerSignatureImage,
                agreementCheckboxText: EMPLOYER_AGREEMENT_TEXT,
                contractVersion: CONTRACT_VERSION,
                documentHash,
                browserUserAgent: navigator.userAgent,
            });
            setCurrentContract(updated);
            setEmployerAgreementChecked(false);
            setEmployerTypedName("");
            clearEmployerSignature();
            setContractActionSuccess("Contract finalized.");
            void loadUser();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to finalize contract.";
            setContractError(message);
        } finally {
            setContractActionLoading(false);
        }
    };

    const beginEmployerDrawing = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (contractActionLoading) return;
        const canvas = employerSignatureCanvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        canvas.setPointerCapture(event.pointerId);
        employerDrawingRef.current = true;
        const point = canvasPoint(canvas, event);
        context.beginPath();
        context.moveTo(point.x, point.y);
    }, [contractActionLoading]);

    const drawEmployerSignature = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!employerDrawingRef.current || contractActionLoading) return;
        const canvas = employerSignatureCanvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        const point = canvasPoint(canvas, event);
        context.lineWidth = 2;
        context.lineCap = "round";
        context.strokeStyle = "#111827";
        context.lineTo(point.x, point.y);
        context.stroke();
    }, [contractActionLoading]);

    const endEmployerDrawing = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
        const canvas = employerSignatureCanvasRef.current;
        if (canvas?.hasPointerCapture(event.pointerId)) {
            canvas.releasePointerCapture(event.pointerId);
        }
        if (!employerDrawingRef.current || !canvas) return;
        employerDrawingRef.current = false;
        setEmployerSignatureImage(canvas.toDataURL("image/png"));
    }, []);

    const clearEmployerSignature = () => {
        const canvas = employerSignatureCanvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        setEmployerSignatureImage(null);
    };

    const handleRejectContract = async () => {
        if (!currentContract) return;
        const comment = contractRejectComment.trim();
        if (!comment) {
            setContractError("Add a review comment before rejecting the contract.");
            return;
        }
        try {
            setContractActionLoading(true);
            setContractError(null);
            setContractActionSuccess(null);
            const updated = await UserServices.rejectContract(currentContract.contractId, comment);
            setCurrentContract(updated);
            setContractRejectComment("");
            setContractActionSuccess("Contract sent back with comment.");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to reject contract.";
            setContractError(message);
        } finally {
            setContractActionLoading(false);
        }
    };

    useEffect(() => {
        if (!showRolePicker) return;
        const handleClick = (event: MouseEvent) => {
            if (!rolePickerRef.current) return;
            const target = event.target as Node;
            if (!rolePickerRef.current.contains(target)) {
                setShowRolePicker(false);
            }
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setShowRolePicker(false);
        };
        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKey);
        };
    }, [showRolePicker]);

    const getAdminShiftPath = (row: PlanningExplorerRow) => {
        return `/management/planning/projects/${encodeURIComponent(row.projectId)}?shift=${encodeURIComponent(row.shiftId)}`;
    };

    const renderPlanningList = (rows: PlanningExplorerRow[], emptyMessage: string, linkToShift = false) => {
        if (rows.length === 0) {
            return <div className="adminUserPlanningEmpty">{emptyMessage}</div>;
        }

        return (
            <div className="adminUserPlanningList">
                {rows.map((row) => {
                    const tone = getAllocationStatusTone(row.status);
                    const itemContent = (
                        <>
                            <div className="adminUserPlanningItemMain">
                                <div className="adminUserPlanningItemTitle">{row.projectName}</div>
                                <div className="adminUserPlanningItemMeta">
                                    {formatDate(row.shiftDate)} · {formatPlanningTimeRange(row)}
                                </div>
                                <div className="adminUserPlanningItemMeta">
                                    {row.functionName} · {row.finalized ? "Finalized" : "Open planning"}
                                </div>
                            </div>
                            <div className="adminUserPlanningItemAside">
                                <span className={`adminUserDetailsBadge adminUserDetailsBadge--${tone}`}>
                                    {getAllocationStatusLabel(row.status)}
                                </span>
                                <span className="adminUserPlanningItemDay">{formatDate(row.shiftDate)}</span>
                            </div>
                        </>
                    );

                    if (linkToShift) {
                        return (
                            <Link
                                key={row.rowId}
                                className="adminUserPlanningItem adminUserPlanningItem--link"
                                to={getAdminShiftPath(row)}
                                aria-label={`Open ${row.projectName} shift on ${formatDate(row.shiftDate)}`}
                            >
                                {itemContent}
                            </Link>
                        );
                    }

                    return (
                        <article key={row.rowId} className="adminUserPlanningItem">
                            {itemContent}
                        </article>
                    );
                })}
            </div>
        );
    };

    const pageContent = (() => {
        const visibleTabs = USER_DETAILS_TABS.filter((tab) =>
            tab.key === "billingRates" ? hasAnyPermission(permissions, BILLING_RATE_PERMISSIONS) : true
        );

        if (!userId) {
            return <div className="workHistoryError">Missing user id.</div>;
        }

        const identityMetrics = [
            { label: "Roles", value: String(sortedUserRoles.length) },
            { label: "Recorded hours", value: `${totalLoggedHours.toFixed(1)} h` },
            { label: "Upcoming shifts", value: String(upcomingPlanningRows.length) },
            { label: "Last timesheet", value: latestTimesheet ? formatDateWithSlashes(latestTimesheet.dateOfIssue) : "-" },
        ];

        const profilePersonalRows = [
            ["Full name", displayName],
            ["Preferred name", formatValue(user?.preferredName)],
            ["First names", formatValue(user?.firstNames)],
            ["Middle name prefix", formatValue(user?.middleNamePrefix)],
            ["Last name", formatValue(user?.lastName)],
            ["Gender", formatValue(user?.gender)],
            ["Date of birth", formatValue(user?.dateOfBirth)],
            ["Nationality", formatValue(user?.nationality)],
            ["Email", formatValue(user?.email)],
            ["Mobile", formatValue(user?.mobileNumber)],
        ] as const;

        const profileWorkRows = [
            ["Status", formatValue(user?.status)],
            ["Position", currentContract?.functionName ?? formatPosition(user?.position)],
            ["Worked for us before", formatValue(user?.workedForUsBefore)],
            ["Registered", formatValue(user?.registeredDate)],
            ["Contract payment frequency", formatPaymentFrequency(currentContract?.paymentFrequency)],
            ["Company ID", formatValue(user?.companyId)],
        ] as const;

        const profileTaxRows = [
            ["BSN", maskIdentification(formatValue(user?.employeeTaxProfile?.bsn))],
            ["Apply loonheffingskorting", formatValue(user?.employeeTaxProfile?.applyLoonheffingskorting)],
            ["Pension participant", formatValue(user?.employeeTaxProfile?.pensionParticipant)],
            ["Special employee Zvw contribution", formatValue(user?.employeeTaxProfile?.specialZvwContribution)],
            ["Payroll notes", formatValue(user?.employeeTaxProfile?.payrollNotes)],
        ] as const;

        const profileContractRows = [
            ["Contract position", currentContract?.functionName ?? "-"],
            [
                "Gross hourly wage",
                currentContract?.grossHourlyWage != null
                    ? moneyFormatter.format(Number(currentContract.grossHourlyWage))
                    : "-",
            ],
            ["Contract type", formatValue(currentContract?.contractType)],
            ["Contract status", formatValue(currentContract?.status)],
            ["Payment frequency", formatPaymentFrequency(currentContract?.paymentFrequency)],
            ["Start date", formatValue(currentContract?.startDate)],
            ["End date", currentContract ? (currentContract.endDate ? formatValue(currentContract.endDate) : "Open-ended") : "-"],
            [
                "Holiday allowance",
                currentContract?.holidayAllowancePercentage != null
                    ? `${currentContract.holidayAllowancePercentage}%`
                    : "-",
            ],
            ["Weekly hours", formatValue(currentContract?.weeklyHours)],
            ["Sent to employee", formatValue(currentContract?.sentToEmployeeAt)],
            ["Employee signed", formatValue(currentContract?.employeeSignedAt)],
            ["Finalized", formatValue(currentContract?.finalizedAt)],
            ["Employer signature", formatValue(currentContract?.employerTypedSignatureName)],
            ["Review comment", formatValue(currentContract?.reviewComment)],
        ] as const;

        const canSendCurrentContract = canManageContracts
            && (currentContract?.status === "DRAFT" || currentContract?.status === "SENT_TO_EMPLOYEE");
        const sendContractButtonLabel = currentContract?.status === "SENT_TO_EMPLOYEE"
            ? "Resend contract"
            : "Send contract";
        const canFinalizeCurrentContract = canFinalizeContracts
            && (currentContract?.status === "EMPLOYEE_SIGNED" || currentContract?.status === "SIGNED");
        const canRejectCurrentContract = canReviewContracts
            && (currentContract?.status === "EMPLOYEE_SIGNED" || currentContract?.status === "SIGNED");
        const canCreateContractDraft = canShowCreateContractDraft({
            canManageContracts,
            contractLoading,
            currentContract,
            userStatus: user?.status,
        });
        const managerName = currentManager ? personFullName(currentManager) : "";
        const canSubmitEmployerSignature = canSubmitEmployerContractSignature({
            contractLoaded: Boolean(currentContract),
            alreadyFinalized: currentContract?.status === "FINALIZED",
            agreementChecked: employerAgreementChecked,
            typedName: employerTypedName,
        });

        const addressRows = [
            ["Street", formatValue(user?.street)],
            ["House number", formatValue(user?.houseNumber)],
            ["House number suffix", formatValue(user?.houseNumberSuffix)],
            ["Postal code", formatValue(user?.postalCode)],
            ["City", formatValue(user?.city)],
            ["Country", formatValue(user?.country)],
        ] as const;

        const idDocumentRows = [
            ["Document type", maskIdentification(formatValue(user?.idDocumentType))],
            ["Document number", maskIdentification(formatValue(user?.idDocumentNumber))],
            ["Issue date", maskIdentification(formatValue(user?.idIssueDate))],
            ["Expiration date", maskIdentification(formatValue(user?.idExpirationDate))],
            ["Issuing country", maskIdentification(formatValue(user?.idIssuingCountry))],
        ] as const;

        const emergencyContactRows = [
            ["Contact name", formatValue(user?.emergencyContactName)],
            ["Relationship", formatValue(user?.emergencyContactRelationship)],
            ["Phone", formatValue(user?.emergencyContactPhone)],
            ["Email", formatValue(user?.emergencyContactEmail)],
        ] as const;

        return (
            <>
                <section className="adminUserDetailsHero">
                    <div className="adminUserDetailsHeaderTop">
                        <PageBack to="/management/users" />
                        <div className="adminUserDetailsHeaderRow">
                            <div className="pageHeader adminUserDetailsHeader">
                                <h1 className="pageTitle">User Details</h1>
                                <p className="pageSubtitle">
                                    Profile, timesheets, and planning in one consistent workspace.
                                </p>
                            </div>
                            {canDeleteViewedUser ? (
                                <button
                                    type="button"
                                    className="button buttonDanger adminUserDetailsDeleteButton"
                                    onClick={() => {
                                        setDeleteUserError(null);
                                        setDeleteUserModalOpen(true);
                                    }}
                                    disabled={deleteUserLoading}
                                >
                                    Delete user
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <nav className="adminUserDetailsTabs" aria-label="User detail tabs">
                        {visibleTabs.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                className={[
                                    "adminUserDetailsTab",
                                    activeTab === tab.key ? "adminUserDetailsTab--active" : "",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                                onClick={() => {
                                    setActiveTab(tab.key);
                                    if (tab.key === "billingRates") {
                                        navigate(`/management/users/${userId ?? ""}/billing-rates`);
                                    } else if (location.pathname.endsWith("/billing-rates")) {
                                        navigate(`/management/users/${userId ?? ""}`);
                                    }
                                }}
                                aria-pressed={activeTab === tab.key}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>

                    {userLoading ? (
                        <div className="adminUserDetailsHeroState">
                            <Spinner text="Loading user profile" />
                        </div>
                    ) : userError ? (
                        <div className="workHistoryError">{userError}</div>
                    ) : user ? (
                        <div className="adminUserIdentity">
                            <div
                                className={`profile_avatar_circle adminUserIdentityAvatar ${
                                    profilePictureUrl ? "profile_avatar_circle--image" : "profile_avatar_circle--default"
                                }`}
                                aria-label="Profile picture"
                            >
                                {profilePictureUrl ? (
                                    <img className="profile_avatar_img" src={profilePictureUrl} alt="Profile" />
                                ) : (
                                    <span className="profile_avatar_letter">{defaultAvatarLetter}</span>
                                )}
                            </div>

                            <div className="adminUserIdentityMain">
                                <div className="adminUserIdentityNameRow">
                                    <h2 className="adminUserIdentityName">{displayName}</h2>
                                    <span
                                        className={`adminUserDetailsBadge adminUserDetailsBadge--${getStatusTone(user.status)}`}
                                    >
                                        {formatValue(user.status)}
                                    </span>
                                </div>
                                <p className="adminUserIdentityEmail">{user.email}</p>
                                <div className="adminUserIdentityMeta">
                                    <span>{currentContract?.functionName ?? formatPosition(user.position)}</span>
                                    <span>{formatLocation(user)}</span>
                                </div>
                                <div className="adminUserIdentityRoles">
                                    {rolesLoading ? <span className="profile_role_hint">Loading roles...</span> : null}
                                    {rolesError ? <span className="profile_role_error">{rolesError}</span> : null}
                                    {roleOptionsError ? <span className="profile_role_error">{roleOptionsError}</span> : null}
                                    {permissionsError ? <span className="profile_role_error">{permissionsError}</span> : null}
                                    <div className="profile_role_list">
                                        {sortedUserRoles.length === 0 ? (
                                            <span className="profile_role_empty">No roles assigned.</span>
                                        ) : (
                                            sortedUserRoles.map((role) => {
                                                const match = roleOptions.find((option) => {
                                                    return normalizeRoleName(option.name) === normalizeRoleName(role);
                                                });
                                                const color = match?.color ?? "#9ca3af";
                                                return (
                                                    <div key={role} className="profile_role_item">
                                                        <button
                                                            type="button"
                                                            className="profile_role_dot_button"
                                                            style={{ backgroundColor: color }}
                                                            onClick={() => void handleRemoveRole(role)}
                                                            disabled={!canRemoveRoles || roleSaving}
                                                            aria-label={`Remove role ${role}`}
                                                        >
                                                            <span className="profile_role_dot_cross" aria-hidden="true">
                                                                x
                                                            </span>
                                                        </button>
                                                        <span className="profile_role_name">{role}</span>
                                                    </div>
                                                );
                                            })
                                        )}
                                        {canAssignRoles ? (
                                            <div className="profile_role_add_wrap" ref={rolePickerRef}>
                                                <button
                                                    type="button"
                                                    className="profile_role_add_icon"
                                                    onClick={() => setShowRolePicker((open) => !open)}
                                                    disabled={roleSaving || roleOptionsLoading || availableRoles.length === 0}
                                                    aria-label="Add role"
                                                >
                                                    +
                                                </button>
                                                {showRolePicker && availableRoles.length > 0 ? (
                                                    <div className="profile_role_menu" role="listbox" aria-label="Available roles">
                                                        {availableRoles.map((role) => (
                                                            <button
                                                                key={role}
                                                                type="button"
                                                                className="profile_role_menu_item"
                                                                onClick={() => {
                                                                    void handleAddRole(role);
                                                                    setShowRolePicker(false);
                                                                }}
                                                                role="option"
                                                            >
                                                                {role}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </div>
                                    {!permissionsLoading && !canAssignRoles && !canRemoveRoles ? (
                                        <div className="profile_role_hint">
                                            You do not have permission to manage roles.
                                        </div>
                                    ) : null}
                                    {roleSaveError ? <div className="profile_role_error">{roleSaveError}</div> : null}
                                    {roleSaveSuccess ? <div className="profile_role_hint">{roleSaveSuccess}</div> : null}
                                </div>
                                {profilePictureError ? (
                                    <div className="profile_avatar_error adminUserIdentityError">
                                        {profilePictureError}
                                    </div>
                                ) : profilePictureLoading ? (
                                    <div className="profile_avatar_hint adminUserIdentityHint">
                                        Loading profile picture...
                                    </div>
                                ) : null}
                            </div>

                            <div className="adminUserIdentityMetrics">
                                {identityMetrics.map((metric) => (
                                    <div key={metric.label} className="adminUserIdentityMetric">
                                        <div className="adminUserIdentityMetricLabel">{metric.label}</div>
                                        <div className="adminUserIdentityMetricValue">{metric.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </section>

                {activeTab === "profile" ? (
                    <section className="adminUserDetailsTabPanel">
                        <div className="adminUserDetailsGrid">
                            <Card title="Personal information" className="adminUserDetailsPanel">
                                <div className="generalInfoRows">
                                    {profilePersonalRows.map(([label, value]) => (
                                        <div key={label} className="profile_info_row">
                                            <span className="profile_info_label">{label}</span>
                                            <span className="profile_info_value">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            <Card title="Work details" className="adminUserDetailsPanel">
                                <div className="generalInfoRows">
                                    {profileWorkRows.map(([label, value]) => (
                                        <div key={label} className="profile_info_row">
                                            <span className="profile_info_label">{label}</span>
                                            <span className="profile_info_value">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            <Card title="Active contract" className="adminUserDetailsPanel">
                                {contractLoading ? (
                                    <div className="profile_role_hint">Loading contract...</div>
                                ) : currentContract ? (
                                    <>
                                        <div className="generalInfoRows">
                                            {profileContractRows.map(([label, value]) => (
                                                <div key={label} className="profile_info_row">
                                                    <span className="profile_info_label">{label}</span>
                                                    <span className="profile_info_value">{value}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {canRejectCurrentContract ? (
                                            <div className="contractReviewBox">
                                                <label className="payslipDetailFieldLabel" htmlFor="contract-review-comment">
                                                    Review comment
                                                </label>
                                                <textarea
                                                    id="contract-review-comment"
                                                    className="uiSelect contractReviewTextarea"
                                                    value={contractRejectComment}
                                                    onChange={(event) => setContractRejectComment(event.target.value)}
                                                    disabled={contractActionLoading}
                                                />
                                            </div>
                                        ) : null}
                                        {canFinalizeCurrentContract ? (
                                            <div className="contractReviewBox contractEmployerSigningBox">
                                                <label className="contractAgreement">
                                                    <input
                                                        type="checkbox"
                                                        checked={employerAgreementChecked}
                                                        onChange={(event) => setEmployerAgreementChecked(event.target.checked)}
                                                        disabled={contractActionLoading}
                                                    />
                                                    <span>{EMPLOYER_AGREEMENT_TEXT}</span>
                                                </label>

                                                <label className="contractSignatureLabel" htmlFor="employer-signature-name">
                                                    Employer full legal name
                                                </label>
                                                <input
                                                    id="employer-signature-name"
                                                    className="uiSelect contractTypedInput"
                                                    value={employerTypedName}
                                                    onChange={(event) => setEmployerTypedName(event.target.value)}
                                                    placeholder={formatEmployerSignaturePlaceholder(managerName)}
                                                    disabled={contractActionLoading}
                                                />

                                                <div className="contractSignatureLabel">Optional drawn employer signature</div>
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
                                                <button
                                                    type="button"
                                                    className="button buttonSecondary"
                                                    onClick={clearEmployerSignature}
                                                    disabled={contractActionLoading || !employerSignatureImage}
                                                >
                                                    Clear employer signature
                                                </button>
                                            </div>
                                        ) : null}
                                        {contractActionSuccess ? <p className="helperText">{contractActionSuccess}</p> : null}
                                        <div className="cardFooter contractReviewActions">
                                            <button
                                                className="button buttonSecondary"
                                                type="button"
                                                onClick={() => void downloadContractPdf()}
                                                disabled={contractActionLoading}
                                            >
                                                Download contract PDF
                                            </button>
                                            {canSendCurrentContract ? (
                                                <button
                                                    className="button"
                                                    type="button"
                                                    onClick={() => void handleSendContract()}
                                                    disabled={contractActionLoading}
                                                >
                                                    {sendContractButtonLabel}
                                                </button>
                                            ) : null}
                                            {canFinalizeCurrentContract ? (
                                                <button
                                                    className="button"
                                                    type="button"
                                                    onClick={() => void handleFinalizeContract()}
                                                    disabled={contractActionLoading || !canSubmitEmployerSignature}
                                                >
                                                    {contractActionLoading ? "Finalizing..." : "Finalize and sign contract"}
                                                </button>
                                            ) : null}
                                            {canRejectCurrentContract ? (
                                                <button
                                                    className="button buttonSecondary"
                                                    type="button"
                                                    onClick={() => void handleRejectContract()}
                                                    disabled={contractActionLoading}
                                                >
                                                    Reject contract
                                                </button>
                                            ) : null}
                                        </div>
                                    </>
                                ) : canCreateContractDraft ? (
                                    <div className="contractRestartBox">
                                        <p className="contractRestartIntro">
                                            No active contract found for this employee.
                                        </p>
                                        <p className="contractRestartBody">
                                            To set up a contract, restart the onboarding flow. The employee will
                                            receive an email with a fresh setup link; any details they have
                                            already filled in will be pre-filled so they only need to confirm
                                            or update them. Once they submit, you can review the information
                                            and create the contract from the onboarding review page.
                                        </p>
                                        <ol className="contractRestartSteps">
                                            <li>Send the onboarding invitation.</li>
                                            <li>The employee reviews and updates their details, then submits.</li>
                                            <li>You review the submission and create the contract.</li>
                                        </ol>
                                        {restartOnboardingError ? (
                                            <p className="errorText">{restartOnboardingError}</p>
                                        ) : null}
                                        {restartOnboardingSuccess ? (
                                            <p className="helperText">{restartOnboardingSuccess}</p>
                                        ) : null}
                                        <div className="cardFooter contractReviewActions contractRestartActions">
                                            <Link
                                                className="button buttonSecondary"
                                                to={`/management/onboarding-review/${userId}`}
                                            >
                                                Open onboarding review
                                            </Link>
                                            <button
                                                className="button"
                                                type="button"
                                                onClick={() => void handleSendOnboardingInvite()}
                                                disabled={restartOnboardingLoading}
                                            >
                                                {restartOnboardingLoading
                                                    ? "Sending..."
                                                    : "Send onboarding invitation"}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="contractRestartBox">
                                        <p className="contractRestartIntro">
                                            No active contract found for this employee.
                                        </p>
                                        {canManageContracts ? (
                                            <p className="contractRestartBody">
                                                The employee has not finished onboarding yet. They will appear in
                                                the onboarding review queue once they submit their details.
                                            </p>
                                        ) : null}
                                    </div>
                                )}
                                {contractError ? <p className="errorText">{contractError}</p> : null}
                            </Card>

                            <Card title="Employee tax profile" className="adminUserDetailsPanel">
                                <div className="generalInfoRows">
                                    {profileTaxRows.map(([label, value]) => (
                                        <div key={label} className="profile_info_row">
                                            <span className="profile_info_label">{label}</span>
                                            <span className="profile_info_value">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            <Card title="Address" className="adminUserDetailsPanel">
                                <div className="generalInfoRows">
                                    {addressRows.map(([label, value]) => (
                                        <div key={label} className="profile_info_row">
                                            <span className="profile_info_label">{label}</span>
                                            <span className="profile_info_value">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            <Card title="Onboarding evidence" className="adminUserDetailsPanel">
                                <div className="generalInfoRows">
                                    {idDocumentRows.map(([label, value]) => (
                                        <div key={label} className="profile_info_row">
                                            <span className="profile_info_label">{label}</span>
                                            <span className="profile_info_value">{value}</span>
                                        </div>
                                    ))}
                                    <div className="profile_info_row">
                                        <span className="profile_info_label">ID document image</span>
                                        <span className="profile_info_value">
                                            {canViewIdentification
                                                ? idDocumentLoading
                                                    ? "Loading..."
                                                    : idDocumentNoFile
                                                        ? "No file uploaded"
                                                        : "Available when uploaded"
                                                : maskedIdentificationValue}
                                        </span>
                                    </div>
                                </div>
                                {canViewIdentification ? (
                                    <>
                                        {idDocumentError ? <p className="errorText">{idDocumentError}</p> : null}
                                        {idDocumentNoFile ? (
                                            <p className="helperText">No ID document image has been uploaded for this user.</p>
                                        ) : null}
                                        <div className="cardFooter contractReviewActions">
                                            <button
                                                className="button buttonSecondary"
                                                type="button"
                                                onClick={() => void handleOpenIdDocumentImage()}
                                                disabled={idDocumentLoading}
                                            >
                                                {idDocumentLoading ? "Opening..." : "Open ID document image"}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <p className="helperText">
                                        You do not have permission to view this employee&apos;s ID document image.
                                    </p>
                                )}
                            </Card>

                            <Card title="Emergency contact" className="adminUserDetailsPanel">
                                <div className="generalInfoRows">
                                    {emergencyContactRows.map(([label, value]) => (
                                        <div key={label} className="profile_info_row">
                                            <span className="profile_info_label">{label}</span>
                                            <span className="profile_info_value">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            <Card title="Bank details" className="adminUserDetailsPanel">
                                <div className="generalInfoRows">
                                    <div className="profile_info_row">
                                        <span className="profile_info_label">Account holder</span>
                                        <span className="profile_info_value">{formatValue(user?.bankAccountHolderName)}</span>
                                    </div>
                                    <div className="profile_info_row">
                                        <span className="profile_info_label">IBAN</span>
                                        <span className="profile_info_value">{formatValue(user?.iban)}</span>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </section>
                ) : null}

                {activeTab === "timesheets" ? (
                    <section className="adminUserDetailsTabPanel">
                        <div className="adminUserDetailsSummaryRow">
                            <div className="adminUserDetailsSummaryCard">
                                <div className="adminUserDetailsSummaryLabel">Total hours</div>
                                <div className="adminUserDetailsSummaryValue">{totalLoggedHours.toFixed(1)} h</div>
                            </div>
                            <div className="adminUserDetailsSummaryCard">
                                <div className="adminUserDetailsSummaryLabel">Entries</div>
                                <div className="adminUserDetailsSummaryValue">{userTimesheets.length}</div>
                            </div>
                            <div className="adminUserDetailsSummaryCard">
                                <div className="adminUserDetailsSummaryLabel">Average entry</div>
                                <div className="adminUserDetailsSummaryValue">{averageTimesheetHours.toFixed(1)} h</div>
                            </div>
                            <div className="adminUserDetailsSummaryCard">
                                <div className="adminUserDetailsSummaryLabel">Travel expenses</div>
                                <div className="adminUserDetailsSummaryValue">{moneyFormatter.format(totalTravelExpenses)}</div>
                            </div>
                        </div>

                        <div className="adminUserTimesheetLayout">
                            <Card title="Log worked hours" className="adminUserDetailsPanel">
                                <form onSubmit={handleCreateTimesheet} className="adminUserTimesheetForm">
                                    <div className="generalInfoRows">
                                        <div className="generalInfoRow">
                                            <label className="generalInfoLabel" htmlFor="admin-ts-date">Date</label>
                                            <input
                                                id="admin-ts-date"
                                                className="uiSelect"
                                                type="text"
                                                value={dateOfIssue}
                                                onChange={(event) => setDateOfIssue(normalizeDateInput(event.target.value))}
                                                inputMode="numeric"
                                                placeholder="dd/mm/yyyy"
                                                maxLength={10}
                                                disabled={saving}
                                            />
                                        </div>
                                        <div className="generalInfoRow">
                                            <label className="generalInfoLabel" htmlFor="admin-ts-function">Function</label>
                                            <input
                                                id="admin-ts-function"
                                                className="uiSelect"
                                                type="text"
                                                value={functionName}
                                                onChange={(event) => setFunctionName(event.target.value)}
                                                placeholder="Runner shift"
                                                disabled={saving}
                                            />
                                        </div>
                                        <div className="generalInfoRow">
                                            <label className="generalInfoLabel" htmlFor="admin-ts-hours">Hours worked</label>
                                            <input
                                                id="admin-ts-hours"
                                                className="uiSelect"
                                                type="number"
                                                min="0"
                                                step="0.25"
                                                value={hoursWorked}
                                                onChange={(event) => setHoursWorked(event.target.value)}
                                                placeholder="0.0"
                                                disabled={saving}
                                            />
                                        </div>
                                        <div className="generalInfoRow">
                                            <label className="generalInfoLabel" htmlFor="admin-ts-travel">Travel expenses</label>
                                            <input
                                                id="admin-ts-travel"
                                                className="uiSelect"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={travelExpenses}
                                                onChange={(event) => setTravelExpenses(event.target.value)}
                                                placeholder="0.00"
                                                disabled={saving}
                                            />
                                        </div>
                                    </div>

                                    {saveError ? <p className="errorText">{saveError}</p> : null}
                                    {saveSuccess ? <p className="helperText">{saveSuccess}</p> : null}

                                    <div className="cardFooter">
                                        <button className="button" type="submit" disabled={saving || !user}>
                                            {saving ? "Saving..." : "Add timesheet"}
                                        </button>
                                    </div>
                                </form>
                            </Card>

                            <Card
                                title={`Timesheet history (${timeframeLabel(timeframe)})`}
                                className="workHistoryCard adminUserDetailsPanel"
                                right={
                                    <div className="workHistoryFilters">
                                        <select
                                            className="workHistorySelect"
                                            value={timeframe.kind}
                                            onChange={(event) => {
                                                const kind = event.target.value as Timeframe["kind"];
                                                if (kind === "all") {
                                                    setTimeframe({ kind });
                                                    return;
                                                }
                                                if (kind === "week") {
                                                    const latest = timeframeOptions.weeks[0];
                                                    const fallback = getIsoWeek(new Date());
                                                    setTimeframe(latest ? { kind, ...latest } : { kind, ...fallback });
                                                    return;
                                                }
                                                if (kind === "month") {
                                                    const latest = timeframeOptions.months[0];
                                                    const now = new Date();
                                                    setTimeframe(
                                                        latest
                                                            ? { kind, ...latest }
                                                            : { kind, year: now.getFullYear(), month: now.getMonth() + 1 }
                                                    );
                                                    return;
                                                }
                                                const latest = timeframeOptions.years[0];
                                                const nowYear = new Date().getFullYear();
                                                setTimeframe({ kind, year: typeof latest === "number" ? latest : nowYear });
                                            }}
                                            disabled={userTimesheets.length === 0}
                                            aria-label="Select timeframe type"
                                        >
                                            <option value="week">Week</option>
                                            <option value="month">Month</option>
                                            <option value="year">Year</option>
                                            <option value="all">All</option>
                                        </select>

                                        {timeframe.kind === "week" ? (
                                            <>
                                                <select
                                                    className="workHistorySelect"
                                                    value={String(timeframe.weekBasedYear)}
                                                    onChange={(event) =>
                                                        setTimeframe({
                                                            kind: "week",
                                                            weekBasedYear: Number(event.target.value),
                                                            weekNumber: timeframe.weekNumber,
                                                        })
                                                    }
                                                    aria-label="Select week-based year"
                                                >
                                                    {yearOptions.map((year) => (
                                                        <option key={year} value={String(year)}>{year}</option>
                                                    ))}
                                                </select>
                                                <select
                                                    className="workHistorySelect"
                                                    value={String(timeframe.weekNumber)}
                                                    onChange={(event) =>
                                                        setTimeframe({
                                                            kind: "week",
                                                            weekBasedYear: timeframe.weekBasedYear,
                                                            weekNumber: Number(event.target.value),
                                                        })
                                                    }
                                                    aria-label="Select week number"
                                                >
                                                    {Array.from({ length: 53 }, (_, index) => index + 1).map((week) => (
                                                        <option key={week} value={String(week)}>
                                                            Week {week}
                                                        </option>
                                                    ))}
                                                </select>
                                            </>
                                        ) : null}

                                        {timeframe.kind === "month" ? (
                                            <>
                                                <select
                                                    className="workHistorySelect"
                                                    value={String(timeframe.year)}
                                                    onChange={(event) =>
                                                        setTimeframe({
                                                            kind: "month",
                                                            year: Number(event.target.value),
                                                            month: timeframe.month,
                                                        })
                                                    }
                                                    aria-label="Select year"
                                                >
                                                    {yearOptions.map((year) => (
                                                        <option key={year} value={String(year)}>{year}</option>
                                                    ))}
                                                </select>
                                                <select
                                                    className="workHistorySelect"
                                                    value={String(timeframe.month)}
                                                    onChange={(event) =>
                                                        setTimeframe({
                                                            kind: "month",
                                                            year: timeframe.year,
                                                            month: Number(event.target.value),
                                                        })
                                                    }
                                                    aria-label="Select month"
                                                >
                                                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                                                        <option key={month} value={String(month)}>
                                                            Month {String(month).padStart(2, "0")}
                                                        </option>
                                                    ))}
                                                </select>
                                            </>
                                        ) : null}

                                        {timeframe.kind === "year" ? (
                                            <select
                                                className="workHistorySelect"
                                                value={String(timeframe.year)}
                                                onChange={(event) => setTimeframe({ kind: "year", year: Number(event.target.value) })}
                                                aria-label="Select year"
                                            >
                                                {yearOptions.map((year) => (
                                                    <option key={year} value={String(year)}>
                                                        Year {year}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : null}
                                    </div>
                                }
                            >
                                {timesheetLoading ? (
                                    <div className="workHistoryLoading">
                                        <Spinner text="Loading work history" />
                                    </div>
                                ) : timesheetError ? (
                                    <div className="workHistoryError">{timesheetError}</div>
                                ) : (
                                    <div className="workHistoryTableWrap">
                                        <table className="workHistoryTable adminUserTimesheetTable">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Function</th>
                                                    <th>Week</th>
                                                    <th className="workHistoryHoursCol">Hours</th>
                                                    <th className="workHistoryHoursCol">Travel</th>
                                                    <th>Status</th>
                                                    <th>Approval</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredTimesheets.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="workHistoryEmpty">
                                                            No timesheets found for {timeframeLabel(timeframe)}.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredTimesheets.map((timesheet) => (
                                                        <tr key={timesheet.timesheetId}>
                                                            <td>{formatDateWithSlashes(timesheet.dateOfIssue)}</td>
                                                            <td>{timesheet.function}</td>
                                                            <td>
                                                                {timesheet.weekNumber && timesheet.weekBasedYear
                                                                    ? `W${timesheet.weekNumber} / ${timesheet.weekBasedYear}`
                                                                    : "-"}
                                                            </td>
                                                            <td className="workHistoryHoursCol">{timesheet.hoursWorked.toFixed(1)}</td>
                                                            <td className="workHistoryHoursCol">
                                                                {moneyFormatter.format(Number(timesheet.travelExpenses ?? 0))}
                                                            </td>
                                                            <td>
                                                                <span className="adminUserDetailsBadge adminUserDetailsBadge--info">
                                                                    Recorded
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className="adminUserDetailsBadge adminUserDetailsBadge--neutral">
                                                                    On file
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                            <tfoot>
                                                <tr className="workHistoryTotalRow">
                                                    <td colSpan={3}>Total</td>
                                                    <td className="workHistoryHoursCol">{totalHours.toFixed(1)}</td>
                                                    <td className="workHistoryHoursCol">
                                                        {moneyFormatter.format(
                                                            filteredTimesheets.reduce((sum, timesheet) => {
                                                                return sum + Number(timesheet.travelExpenses ?? 0);
                                                            }, 0)
                                                        )}
                                                    </td>
                                                    <td colSpan={2}>Filtered entries</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}
                            </Card>
                        </div>
                    </section>
                ) : null}

                {activeTab === "planning" ? (
                    <section className="adminUserDetailsTabPanel">
                        <div className="adminUserDetailsSummaryRow">
                            <div className="adminUserDetailsSummaryCard">
                                <div className="adminUserDetailsSummaryLabel">Active now</div>
                                <div className="adminUserDetailsSummaryValue">{activePlanningRows.length}</div>
                            </div>
                            <div className="adminUserDetailsSummaryCard">
                                <div className="adminUserDetailsSummaryLabel">Upcoming</div>
                                <div className="adminUserDetailsSummaryValue">{upcomingPlanningRows.length}</div>
                            </div>
                            <div className="adminUserDetailsSummaryCard">
                                <div className="adminUserDetailsSummaryLabel">Accepted</div>
                                <div className="adminUserDetailsSummaryValue">{acceptedPlanningCount}</div>
                            </div>
                            <div className="adminUserDetailsSummaryCard">
                                <div className="adminUserDetailsSummaryLabel">Past</div>
                                <div className="adminUserDetailsSummaryValue">{pastPlanningRows.length}</div>
                            </div>
                        </div>

                        {planningLoading ? (
                            <div className="workHistoryLoading">
                                <Spinner text="Loading planning" />
                            </div>
                        ) : planningError ? (
                            <div className="workHistoryError">{planningError}</div>
                        ) : (
                            <div className="adminUserPlanningGrid">
                                <Card
                                    title="Active shifts"
                                    className="adminUserDetailsPanel adminUserPlanningPanel"
                                    right={
                                        <span className="adminUserPlanningCount">
                                            {activePlanningRows.length} shift{activePlanningRows.length === 1 ? "" : "s"}
                                        </span>
                                    }
                                >
                                    {renderPlanningList(activePlanningRows, "No active shifts right now.")}
                                </Card>

                                <Card
                                    title="Upcoming shifts"
                                    className="adminUserDetailsPanel adminUserPlanningPanel"
                                    right={
                                        <span className="adminUserPlanningCount">
                                            {upcomingPlanningRows.length} shift{upcomingPlanningRows.length === 1 ? "" : "s"}
                                        </span>
                                    }
                                >
                                    {renderPlanningList(upcomingPlanningRows, "No upcoming shifts scheduled.")}
                                </Card>

                                <Card
                                    title="Past shifts"
                                    className="adminUserDetailsPanel adminUserPlanningPanel"
                                    right={
                                        <span className="adminUserPlanningCount">
                                            {pastPlanningRows.length} shift{pastPlanningRows.length === 1 ? "" : "s"}
                                        </span>
                                    }
                                >
                                    {renderPlanningList(pastPlanningRows, "No past shifts available yet.", true)}
                                </Card>
                            </div>
                        )}
                    </section>
                ) : null}

                {activeTab === "billingRates" ? <AdminUserBillingRates /> : null}
            </>
        );
    })();

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <div className="adminDashboardCard adminUserDetailsPage">{pageContent}</div>
                    </div>
                </div>
            </div>
            <Modal
                open={deleteUserModalOpen}
                title="Delete user"
                onClose={() => {
                    if (deleteUserLoading) return;
                    setDeleteUserError(null);
                    setDeleteUserModalOpen(false);
                }}
                footer={
                    <>
                        <button
                            type="button"
                            className="button buttonSecondary"
                            onClick={() => {
                                setDeleteUserError(null);
                                setDeleteUserModalOpen(false);
                            }}
                            disabled={deleteUserLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="button buttonDanger"
                            onClick={() => void handleDeleteUser()}
                            disabled={deleteUserLoading}
                        >
                            {deleteUserLoading ? "Deleting..." : "Delete user"}
                        </button>
                    </>
                }
            >
                <div className="adminUserDeleteModal">
                    <p className="adminUserDeleteModalText">
                        Delete <strong>{user ? personFullName(user) : "this user"}</strong> permanently.
                    </p>
                    <p className="adminUserDeleteModalWarning">
                        This action is irreversible. The user account and its stored profile data will be removed.
                    </p>
                    {deleteUserError ? <div className="workHistoryError">{deleteUserError}</div> : null}
                </div>
            </Modal>
        </>
    );
}

function personFullName(user: UserResponseDTO): string {
    const parts = [user.firstNames, user.middleNamePrefix, user.lastName]
        .map((part) => (part ?? "").trim())
        .filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : (user.preferredName ?? user.email ?? "").trim();
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
