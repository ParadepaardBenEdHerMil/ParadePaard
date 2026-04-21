import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Spinner from "../components/Spinner";
import Card from "../components/common/Card";
import { AuthServices, type RoleResponseDTO } from "../services/auth-service/AuthServices";
import {
    UserServices,
    type EmployeeTaxProfileDTO,
    type PlanningEventDTO,
    type TimesheetRow,
    type UserResponseDTO,
} from "../services/user-service/UserServices";
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
import { flattenPlanningEvents, type PlanningExplorerRow } from "../utils/planningExplorer";
import { getAllocationStatusLabel, getAllocationStatusTone } from "../utils/planningSummary";

const normalizeRoleName = (value: string) => value.trim().toUpperCase();
const moneyFormatter = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const USER_DETAILS_TABS = [
    { key: "profile", label: "Profile" },
    { key: "timesheets", label: "Timesheets" },
    { key: "planning", label: "Planning" },
] as const;

type UserDetailsTab = (typeof USER_DETAILS_TABS)[number]["key"];

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

function formatPayslipFrequency(minutes: number | null | undefined): string {
    if (!minutes || minutes <= 0) return "-";
    const frequencyMap = new Map<number, string>([
        [60 * 24 * 7, "Weekly"],
        [60 * 24 * 14, "Bi-weekly"],
        [60 * 24 * 30, "Monthly"],
    ]);
    const preset = frequencyMap.get(minutes);
    if (preset) return preset;
    if (minutes % (60 * 24) === 0) {
        const days = minutes / (60 * 24);
        return `Every ${days} day${days === 1 ? "" : "s"}`;
    }
    if (minutes % 60 === 0) {
        const hours = minutes / 60;
        return `Every ${hours} hour${hours === 1 ? "" : "s"}`;
    }
    return `Every ${minutes} minutes`;
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
            left.eventName.localeCompare(right.eventName)
        );
    });
}

function sortPlanningRowsDesc(rows: PlanningExplorerRow[]): PlanningExplorerRow[] {
    return [...rows].sort((left, right) => {
        return (
            right.shiftDate.localeCompare(left.shiftDate) ||
            right.startTime.localeCompare(left.startTime) ||
            left.eventName.localeCompare(right.eventName)
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
    const { userId } = useParams<{ userId: string }>();
    const [activeTab, setActiveTab] = useState<UserDetailsTab>("profile");

    const [user, setUser] = useState<UserResponseDTO | null>(null);
    const [userLoading, setUserLoading] = useState(true);
    const [userError, setUserError] = useState<string | null>(null);

    const [timesheets, setTimesheets] = useState<TimesheetRow[]>([]);
    const [timesheetLoading, setTimesheetLoading] = useState(true);
    const [timesheetError, setTimesheetError] = useState<string | null>(null);
    const [timeframe, setTimeframe] = useState<Timeframe>({ kind: "all" });
    const [timeframeInitialized, setTimeframeInitialized] = useState(false);

    const [planningEvents, setPlanningEvents] = useState<PlanningEventDTO[]>([]);
    const [planningLoading, setPlanningLoading] = useState(false);
    const [planningError, setPlanningError] = useState<string | null>(null);

    const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
    const [profilePictureLoading, setProfilePictureLoading] = useState(false);
    const [profilePictureError, setProfilePictureError] = useState<string | null>(null);

    const [permissions, setPermissions] = useState<string[]>([]);
    const [permissionsLoading, setPermissionsLoading] = useState(true);
    const [permissionsError, setPermissionsError] = useState<string | null>(null);
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

    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const currentMoment = useMemo(() => new Date(), []);
    const [dateOfIssue, setDateOfIssue] = useState(formatDateWithSlashes(today));
    const [functionName, setFunctionName] = useState("");
    const [hoursWorked, setHoursWorked] = useState("");
    const [travelExpenses, setTravelExpenses] = useState("");
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [employeeTaxProfileDraft, setEmployeeTaxProfileDraft] = useState<EmployeeTaxProfileDTO>({
        bsn: "",
        applyLoonheffingskorting: false,
        pensionParticipant: false,
        specialZvwContribution: false,
        payrollNotes: "",
    });
    const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
    const [profileSaveSuccess, setProfileSaveSuccess] = useState<string | null>(null);
    const [profileSaving, setProfileSaving] = useState(false);

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
            setPlanningEvents(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load planning.";
            setPlanningError(message);
        } finally {
            setPlanningLoading(false);
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
        let cancelled = false;
        setPermissionsLoading(true);
        setPermissionsError(null);

        AuthServices.getPermissions()
            .then((data) => {
                if (!cancelled) setPermissions(data ?? []);
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : "Failed to load permissions.";
                if (!cancelled) setPermissionsError(message);
            })
            .finally(() => {
                if (!cancelled) setPermissionsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        void loadUserRoles();
    }, [loadUserRoles]);

    useEffect(() => {
        void loadRoleOptions();
    }, [loadRoleOptions]);

    useEffect(() => {
        setRoleSaveError(null);
        setRoleSaveSuccess(null);
    }, [userId]);

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
    const canManageUsers = permissions.includes("CAN_MANAGE_USERS");

    useEffect(() => {
        setEmployeeTaxProfileDraft({
            bsn: user?.employeeTaxProfile?.bsn ?? "",
            applyLoonheffingskorting: user?.employeeTaxProfile?.applyLoonheffingskorting ?? false,
            pensionParticipant: user?.employeeTaxProfile?.pensionParticipant ?? false,
            specialZvwContribution: user?.employeeTaxProfile?.specialZvwContribution ?? false,
            payrollNotes: user?.employeeTaxProfile?.payrollNotes ?? "",
        });
        setProfileSaveError(null);
        setProfileSaveSuccess(null);
    }, [user]);

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
        return flattenPlanningEvents(planningEvents).filter((row) => row.employeeId === userId);
    }, [planningEvents, userId]);

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

    const handleSaveEmployeeTaxProfile = async () => {
        if (!userId || !user || !canManageUsers) return;
        try {
            setProfileSaving(true);
            setProfileSaveError(null);
            setProfileSaveSuccess(null);
            const updated = await UserServices.updateUser(userId, {
                email: user.email,
                preferredName: user.preferredName,
                firstNames: user.firstNames,
                middleNamePrefix: user.middleNamePrefix,
                lastName: user.lastName,
                gender: user.gender,
                dateOfBirth: user.dateOfBirth,
                mobileNumber: user.mobileNumber,
                street: user.street,
                houseNumber: user.houseNumber,
                houseNumberSuffix: user.houseNumberSuffix,
                postalCode: user.postalCode,
                city: user.city,
                country: user.country,
                iban: user.iban,
                employeeTaxProfile: {
                    bsn: employeeTaxProfileDraft.bsn?.trim() || null,
                    applyLoonheffingskorting: Boolean(employeeTaxProfileDraft.applyLoonheffingskorting),
                    pensionParticipant: Boolean(employeeTaxProfileDraft.pensionParticipant),
                    specialZvwContribution: Boolean(employeeTaxProfileDraft.specialZvwContribution),
                    payrollNotes: employeeTaxProfileDraft.payrollNotes?.trim() || null,
                },
            });
            setUser(updated);
            setProfileSaveSuccess("Employee tax profile updated.");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to update employee tax profile.";
            setProfileSaveError(message);
        } finally {
            setProfileSaving(false);
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

    const renderPlanningList = (rows: PlanningExplorerRow[], emptyMessage: string) => {
        if (rows.length === 0) {
            return <div className="adminUserPlanningEmpty">{emptyMessage}</div>;
        }

        return (
            <div className="adminUserPlanningList">
                {rows.map((row) => {
                    const tone = getAllocationStatusTone(row.status);
                    return (
                        <article key={row.rowId} className="adminUserPlanningItem">
                            <div className="adminUserPlanningItemMain">
                                <div className="adminUserPlanningItemTitle">{row.eventName}</div>
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
                        </article>
                    );
                })}
            </div>
        );
    };

    const pageContent = (() => {
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
            ["Email", formatValue(user?.email)],
            ["Mobile", formatValue(user?.mobileNumber)],
        ] as const;

        const profileWorkRows = [
            ["Status", formatValue(user?.status)],
            ["Position", formatPosition(user?.position)],
            ["Worked for us before", formatValue(user?.workedForUsBefore)],
            ["Registered", formatValue(user?.registeredDate)],
            ["Payslip frequency", formatPayslipFrequency(user?.payslipFrequencyMinutes)],
            ["Company ID", formatValue(user?.companyId)],
        ] as const;

        const addressRows = [
            ["Street", formatValue(user?.street)],
            ["House number", formatValue(user?.houseNumber)],
            ["House number suffix", formatValue(user?.houseNumberSuffix)],
            ["Postal code", formatValue(user?.postalCode)],
            ["City", formatValue(user?.city)],
            ["Country", formatValue(user?.country)],
        ] as const;

        return (
            <>
                <section className="adminUserDetailsHero">
                    <div className="adminUserDetailsHeaderTop">
                        <PageBack label="Back to users" to="/admin/users" />
                        <div className="pageHeader adminUserDetailsHeader">
                            <h1 className="pageTitle">User Details</h1>
                            <p className="pageSubtitle">
                                Profile, timesheets, and planning in one consistent workspace.
                            </p>
                        </div>
                    </div>

                    <nav className="adminUserDetailsTabs" aria-label="User detail tabs">
                        {USER_DETAILS_TABS.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                className={[
                                    "adminUserDetailsTab",
                                    activeTab === tab.key ? "adminUserDetailsTab--active" : "",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                                onClick={() => setActiveTab(tab.key)}
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
                                    <span>{formatPosition(user.position)}</span>
                                    <span>{formatLocation(user)}</span>
                                    <span>{sortedUserRoles.length} role{sortedUserRoles.length === 1 ? "" : "s"}</span>
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

                            <Card title="Employee tax profile" className="adminUserDetailsPanel">
                                <div className="payslipDetailFields">
                                    <div className="payslipDetailField">
                                        <label className="payslipDetailFieldLabel" htmlFor="admin-user-bsn">
                                            BSN
                                        </label>
                                        <input
                                            id="admin-user-bsn"
                                            className="uiSelect"
                                            type="text"
                                            value={employeeTaxProfileDraft.bsn ?? ""}
                                            onChange={(event) => {
                                                setEmployeeTaxProfileDraft((prev) => ({ ...prev, bsn: event.target.value }));
                                                setProfileSaveError(null);
                                                setProfileSaveSuccess(null);
                                            }}
                                            disabled={!canManageUsers || profileSaving}
                                        />
                                    </div>
                                    <div className="payslipDetailField">
                                        <label className="payslipDetailFieldLabel adminUserDetailsCheckbox">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(employeeTaxProfileDraft.applyLoonheffingskorting)}
                                                onChange={(event) => {
                                                    setEmployeeTaxProfileDraft((prev) => ({
                                                        ...prev,
                                                        applyLoonheffingskorting: event.target.checked,
                                                    }));
                                                    setProfileSaveError(null);
                                                    setProfileSaveSuccess(null);
                                                }}
                                                disabled={!canManageUsers || profileSaving}
                                            />
                                            <span>Apply loonheffingskorting</span>
                                        </label>
                                    </div>
                                    <div className="payslipDetailField">
                                        <label className="payslipDetailFieldLabel adminUserDetailsCheckbox">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(employeeTaxProfileDraft.pensionParticipant)}
                                                onChange={(event) => {
                                                    setEmployeeTaxProfileDraft((prev) => ({
                                                        ...prev,
                                                        pensionParticipant: event.target.checked,
                                                    }));
                                                    setProfileSaveError(null);
                                                    setProfileSaveSuccess(null);
                                                }}
                                                disabled={!canManageUsers || profileSaving}
                                            />
                                            <span>Pension participant</span>
                                        </label>
                                    </div>
                                    <div className="payslipDetailField">
                                        <label className="payslipDetailFieldLabel adminUserDetailsCheckbox">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(employeeTaxProfileDraft.specialZvwContribution)}
                                                onChange={(event) => {
                                                    setEmployeeTaxProfileDraft((prev) => ({
                                                        ...prev,
                                                        specialZvwContribution: event.target.checked,
                                                    }));
                                                    setProfileSaveError(null);
                                                    setProfileSaveSuccess(null);
                                                }}
                                                disabled={!canManageUsers || profileSaving}
                                            />
                                            <span>Special employee Zvw contribution</span>
                                        </label>
                                    </div>
                                    <div className="payslipDetailField payslipDetailField--wide">
                                        <label className="payslipDetailFieldLabel" htmlFor="admin-user-payroll-notes">
                                            Payroll notes
                                        </label>
                                        <textarea
                                            id="admin-user-payroll-notes"
                                            className="uiSelect"
                                            rows={4}
                                            value={employeeTaxProfileDraft.payrollNotes ?? ""}
                                            onChange={(event) => {
                                                setEmployeeTaxProfileDraft((prev) => ({
                                                    ...prev,
                                                    payrollNotes: event.target.value,
                                                }));
                                                setProfileSaveError(null);
                                                setProfileSaveSuccess(null);
                                            }}
                                            disabled={!canManageUsers || profileSaving}
                                        />
                                    </div>
                                </div>
                                {!canManageUsers ? (
                                    <p className="helperText">Managing payroll flags requires the manage users permission.</p>
                                ) : null}
                                {profileSaveError ? <p className="errorText">{profileSaveError}</p> : null}
                                {profileSaveSuccess ? <p className="helperText">{profileSaveSuccess}</p> : null}
                                {canManageUsers ? (
                                    <div className="cardFooter">
                                        <button
                                            className="button"
                                            type="button"
                                            onClick={() => void handleSaveEmployeeTaxProfile()}
                                            disabled={profileSaving}
                                        >
                                            {profileSaving ? "Saving..." : "Save tax profile"}
                                        </button>
                                    </div>
                                ) : null}
                            </Card>

                            <Card title="Roles & access" className="adminUserDetailsPanel adminUserDetailsPanel--wide">
                                <div className="adminUserRolesCard">
                                    <div className="profile_role_section">
                                        <div className="profile_role_header">Assigned roles</div>
                                        {rolesLoading ? <div className="profile_role_hint">Loading roles...</div> : null}
                                        {rolesError ? <div className="profile_role_error">{rolesError}</div> : null}
                                        {roleOptionsError ? <div className="profile_role_error">{roleOptionsError}</div> : null}
                                        {permissionsError ? <div className="profile_role_error">{permissionsError}</div> : null}
                                        <div className="profile_role_list">
                                            {sortedUserRoles.length === 0 ? (
                                                <div className="profile_role_empty">No roles assigned.</div>
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

                            <Card title="Bank details" className="adminUserDetailsPanel">
                                <div className="generalInfoRows">
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
                                    {renderPlanningList(pastPlanningRows, "No past shifts available yet.")}
                                </Card>
                            </div>
                        )}
                    </section>
                ) : null}
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
        </>
    );
}
