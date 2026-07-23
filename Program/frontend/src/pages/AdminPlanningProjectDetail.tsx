import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import PageToolsMenu from "../components/common/PageToolsMenu";
import { buildProjectCsv, buildShiftCsv } from "../utils/pageExports";
import { documentFileBaseName } from "../utils/documentPreview";
import PlanningLocationPicker from "../components/planning/PlanningLocationPicker";
import FunctionPicker from "../components/common/FunctionPicker";
import { useAuth } from "../context/AuthContext";
import {
    UserServices,
    type PlanningClientCompanyDTO,
    type PlanningProjectDTO,
    type PlanningProjectSaveDTO,
    type PlanningResourceAllocationDTO,
    type PlanningShiftDTO,
    type UserResponseDTO,
} from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";
import { formatDateInput, normalizeDateInput, parseDisplayDate } from "../utils/dateInput";
import {
    getAllocationStatusLabel,
    getAllocationStatusTone,
    getAllocationDisplayName,
    getProjectCheckedInCount,
    getProjectClientName,
    getProjectLocation,
    getProjectRequiredCount,
    getProjectScheduledCount,
    getProjectShiftRecords,
    getProjectStaffingLabel,
    getProjectStaffingTone,
    getProjectTimeLabel,
    getShiftApplicantCount,
    getShiftCheckedInCount,
    getShiftDisplayName,
    getShiftLocation,
    getShiftRequiredCount,
    getShiftScheduledCount,
    getShiftStaffingLabel,
    getShiftStaffingTone,
    getShiftTimeLabel,
} from "../utils/planningSummary";
import { formatTimeAgo } from "../utils/timeAgo";
import {
    formatTimeZoneLabel,
    getBrowserTimeZone,
    getTimeZoneOptions,
    isSupportedTimeZone,
    type TimeZoneOption,
} from "../utils/timezones";
import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminPlanningOverview.css";
import "../stylesheets/AdminPlanningDetail.css";

type ShiftDraft = {
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    name: string;
    functionName: string;
    breakMinutes: string;
    location: string;
    savedLocationId: string | null;
    peopleNeeded: string;
};

type ScheduledFilter = "all" | "scheduled" | "accepted" | "declined";
const PROJECT_TIMEZONE_DATALIST_ID = "planning-project-detail-timezones";
const AVAILABLE_USER_RENDER_LIMIT = 50;

const shiftDateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const shiftWeekdayFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "long" });
const projectDateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

function PencilIcon() {
    return (
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path
                d="M4.25 13.75V15.75H6.25L14.35 7.65L12.35 5.65L4.25 13.75Z"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
            />
            <path
                d="M10.95 7.05L12.95 9.05"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
            />
            <path
                d="M11.85 4.75L13.25 3.35C13.72 2.88 14.48 2.88 14.95 3.35L16.65 5.05C17.12 5.52 17.12 6.28 16.65 6.75L15.25 8.15"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
            />
        </svg>
    );
}

function formatDateRange(startDate: string, endDate: string): string {
    return startDate === endDate ? formatDate(startDate) : `${formatDate(startDate)} to ${formatDate(endDate)}`;
}

function formatProjectTitleDateRange(startDate: string, endDate: string): string {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return formatDateRange(startDate, endDate);
    }

    if (startDate === endDate) {
        return projectDateFormatter.format(start);
    }

    return `${projectDateFormatter.format(start)} - ${projectDateFormatter.format(end)}`;
}

function getDefaultTime(value: string | null | undefined, fallback: string): string {
    return value?.slice(0, 5) || fallback;
}

function parseTimeInput(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!match) return null;
    return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function formatDateFieldInput(value: string): string {
    return formatDateInput(value);
}

function parseDateInput(value: string): string | null {
    return parseDisplayDate(value);
}

function buildInitialShiftDraft(project: PlanningProjectDTO): ShiftDraft {
    return {
        startDate: formatDateFieldInput(project.startDate),
        startTime: getDefaultTime(project.defaultStartTime, "09:00"),
        endDate: formatDateFieldInput(project.startDate),
        endTime: getDefaultTime(project.defaultEndTime, "17:00"),
        name: "",
        functionName: "",
        breakMinutes: "0",
        location: project.location?.trim() || "",
        savedLocationId: null,
        peopleNeeded: "1",
    };
}

function buildProjectDraft(project: PlanningProjectDTO): PlanningProjectSaveDTO {
    return {
        name: project.projectName,
        startDate: formatDateFieldInput(project.startDate),
        endDate: formatDateFieldInput(project.endDate),
        projectTimezone: project.projectTimezone ?? getBrowserTimeZone(),
        clientCompanyId: project.clientCompanyId ?? "",
        location: project.location ?? "",
        savedLocationId: null,
        internalDescription: project.internalDescription ?? "",
        externalDescription: project.externalDescription ?? "",
        defaultStartTime: getDefaultTime(project.defaultStartTime, ""),
        defaultEndTime: getDefaultTime(project.defaultEndTime, ""),
        status: project.status ?? "",
    };
}

function buildShiftDraftFromRecord(day: string, shift: PlanningShiftDTO, project: PlanningProjectDTO): ShiftDraft {
    const startDateTime = shift.startTime.includes("T") ? shift.startTime : `${day}T${shift.startTime}`;
    const endDateTime = shift.endTime.includes("T") ? shift.endTime : `${day}T${shift.endTime}`;
    const startDate = startDateTime.split("T")[0] || project.startDate;
    const endDate = endDateTime.split("T")[0] || startDate;

    return {
        startDate: formatDateFieldInput(startDate),
        startTime: getDefaultTime(startDateTime, "09:00"),
        endDate: formatDateFieldInput(endDate),
        endTime: getDefaultTime(endDateTime, "17:00"),
        name: shift.name?.trim() || "",
        functionName: shift.functionName,
        breakMinutes: String(shift.breakMinutes ?? 0),
        location: shift.location?.trim() || project.location?.trim() || "",
        savedLocationId: null,
        peopleNeeded: String(shift.peopleNeeded ?? 1),
    };
}

function formatShiftSummaryLine(day: string, shift: PlanningShiftDTO): string {
    const shiftDate = new Date(`${day}T00:00:00`);
    return `${shiftDateFormatter.format(shiftDate)}, ${shiftWeekdayFormatter.format(shiftDate)}, ${getShiftTimeLabel(shift)}, ${getShiftDisplayName(shift)}`;
}

function formatShiftDuration(day: string, shift: PlanningShiftDTO): string {
    const startValue = shift.startTime.includes("T") ? shift.startTime : `${day}T${shift.startTime}`;
    const endValue = shift.endTime.includes("T") ? shift.endTime : `${day}T${shift.endTime}`;
    const start = new Date(startValue);
    const end = new Date(endValue);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return "Unknown duration";
    }

    const totalMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0 && minutes > 0) return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} min`;
    if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
    return `${minutes} min`;
}

function formatShiftRequirement(shift: PlanningShiftDTO): string {
    return `${getShiftRequiredCount(shift)}/${getShiftScheduledCount(shift)}/${getShiftCheckedInCount(shift)}`;
}

function getShiftRequirementTitle(shift: PlanningShiftDTO): string {
    void shift;
    return "Required / Scheduled / Checked in";
}

function formatProjectRequirement(project: PlanningProjectDTO): string {
    return `${getProjectRequiredCount(project)}/${getProjectScheduledCount(project)}/${getProjectCheckedInCount(project)}`;
}

function getProjectRequirementTitle(project: PlanningProjectDTO): string {
    void project;
    return "Required / Scheduled / Checked in";
}

function formatProjectHeaderTitle(project: PlanningProjectDTO): string {
    return `${project.projectName}, ${formatProjectTitleDateRange(project.startDate, project.endDate)}, ${getProjectLocation(project)}, ${getProjectClientName(project)}`;
}

function getUserDisplayName(user: UserResponseDTO): string {
    const parts = [user.firstNames, user.middleNamePrefix, user.lastName].map((part) => (part ?? "").trim()).filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    const preferredName = (user.preferredName ?? "").trim();
    return preferredName || user.email;
}

function getUserSummary(user: UserResponseDTO): string {
    return [user.position?.trim(), user.email.trim()].filter(Boolean).join(" - ") || user.userId;
}

function getScheduledDisplayName(allocation: PlanningResourceAllocationDTO, user: UserResponseDTO | undefined): string {
    const providedName = allocation.userDisplayName?.trim();
    if (providedName) return providedName;
    if (user) return getUserDisplayName(user);
    return getAllocationDisplayName(allocation);
}

function getAvatarInitials(label: string): string {
    const parts = label.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function matchesScheduledFilter(allocation: PlanningResourceAllocationDTO, filter: ScheduledFilter): boolean {
    if (filter === "all") return true;
    if (filter === "scheduled") return allocation.status === "ASSIGNED";
    if (filter === "accepted") return allocation.status === "CONFIRMED";
    return allocation.status === "CANCELLED";
}

function getScheduledFilterEmptyMessage(filter: ScheduledFilter): string {
    switch (filter) {
        case "scheduled":
            return "Nobody is scheduled on this shift yet.";
        case "accepted":
            return "Nobody has accepted this shift yet.";
        case "declined":
            return "Nobody has declined this shift.";
        case "all":
        default:
            return "Nobody is linked to this shift yet.";
    }
}

function mergeShiftAllocations(project: PlanningProjectDTO): PlanningProjectDTO {
    return {
        ...project,
        days: project.days.map((day) => ({
            ...day,
            shifts: day.shifts.map((shift) => {
                const mergedAllocations = [...shift.allocations];

                day.allocations
                    .filter((allocation) => allocation.shiftId === shift.shiftId)
                    .forEach((allocation) => {
                        if (mergedAllocations.some((current) => current.scheduleEntryId === allocation.scheduleEntryId)) return;
                        mergedAllocations.push(allocation);
                    });

                return {
                    ...shift,
                    allocations: mergedAllocations,
                };
            }),
        })),
    };
}

export default function AdminPlanningProjectDetail() {
    const navigate = useNavigate();
    const { permissions } = useAuth();
    // Only offer inline "Add" on the job-function picker to admins who can manage the master list.
    const canManageFunctions = permissions.includes("CAN_MANAGE_FUNCTIONS");
    const { projectId } = useParams<{ projectId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const browserTimeZone = useMemo(() => getBrowserTimeZone(), []);
    const [timeZoneOptions, setTimeZoneOptions] = useState<TimeZoneOption[]>([]);
    const [project, setProject] = useState<PlanningProjectDTO | null>(null);
    const [clients, setClients] = useState<PlanningClientCompanyDTO[]>([]);
    const [users, setUsers] = useState<UserResponseDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingClients, setLoadingClients] = useState(true);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [usersLoaded, setUsersLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [clientError, setClientError] = useState<string | null>(null);
    const [userError, setUserError] = useState<string | null>(null);
    const [isCreateShiftOpen, setIsCreateShiftOpen] = useState(false);
    const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
    const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
    // The "Project details" side panel collapses to a slim rail so the shift list can use the
    // space. It starts collapsed — the shifts are what this page is for.
    const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState(true);
    // Per-shift info block (function/staffing/duration/location + edit) inside the expanded
    // shift; starts collapsed and resets whenever a different shift is expanded.
    const [isShiftInfoOpen, setIsShiftInfoOpen] = useState(false);
    const [savingProject, setSavingProject] = useState(false);
    const [savingShift, setSavingShift] = useState(false);
    const [deletingProject, setDeletingProject] = useState(false);
    const [deletingShift, setDeletingShift] = useState(false);
    const [projectSaveError, setProjectSaveError] = useState<string | null>(null);
    const [editShiftError, setEditShiftError] = useState<string | null>(null);
    const [createShiftError, setCreateShiftError] = useState<string | null>(null);
    const [createdShiftId, setCreatedShiftId] = useState<string | null>(null);
    const [shiftSearchTerm, setShiftSearchTerm] = useState("");
    const [scheduledFilter, setScheduledFilter] = useState<ScheduledFilter>("all");
    const [isAppliedListExpanded, setIsAppliedListExpanded] = useState(false);
    const [assignmentError, setAssignmentError] = useState<string | null>(null);
    const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
    const [shiftDraft, setShiftDraft] = useState<ShiftDraft>({
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        name: "",
        functionName: "",
        breakMinutes: "0",
        location: "",
        savedLocationId: null,
        peopleNeeded: "1",
    });
    const [editShiftDraft, setEditShiftDraft] = useState<ShiftDraft>({
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        name: "",
        functionName: "",
        breakMinutes: "0",
        location: "",
        savedLocationId: null,
        peopleNeeded: "1",
    });
    const [projectDraft, setProjectDraft] = useState<PlanningProjectSaveDTO>({
        name: "",
        startDate: "",
        endDate: "",
        projectTimezone: browserTimeZone,
        clientCompanyId: "",
        location: "",
        savedLocationId: null,
        internalDescription: "",
        externalDescription: "",
        defaultStartTime: "",
        defaultEndTime: "",
        status: "",
    });
    const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>({});
    const avatarUrlsRef = useRef<Record<string, string | null>>({});
    const requestedAvatarIdsRef = useRef<Set<string>>(new Set());
    const autoExpandedCreatedShiftIdsRef = useRef<Set<string>>(new Set());

    const requestedShiftId = searchParams.get("shift");

    const loadProject = useCallback(async () => {
        if (!projectId) {
            setError("Missing project id.");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getPlanningOverview(undefined, projectId);
            const selectedProject = data.find((candidate) => candidate.projectId === projectId) ?? null;

            if (!selectedProject) {
                setProject(null);
                setError("Project not found.");
                return;
            }

            setProject(mergeShiftAllocations(selectedProject));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load project.";
            setError(message);
            setProject(null);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        void loadProject();
    }, [loadProject]);

    const loadUsers = useCallback(async () => {
        try {
            setLoadingUsers(true);
            setUserError(null);
            const [company, userList] = await Promise.all([UserServices.getMyCompany(), UserServices.getUsers()]);
            setUsers(userList.filter((user) => !user.companyId || user.companyId === company.companyId));
            setUsersLoaded(true);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load employees.";
            setUserError(message);
            setUsers([]);
            setUsersLoaded(true);
        } finally {
            setLoadingUsers(false);
        }
    }, []);

    const loadClients = useCallback(async () => {
        try {
            setLoadingClients(true);
            setClientError(null);
            const data = await UserServices.getPlanningClients();
            setClients(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load planning clients.";
            setClientError(message);
        } finally {
            setLoadingClients(false);
        }
    }, []);

    const loadTimeZoneOptions = useCallback(() => {
        setTimeZoneOptions((current) => current.length > 0 ? current : getTimeZoneOptions());
    }, []);

    useEffect(() => {
        void loadClients();
    }, [loadClients]);

    const shiftRecords = useMemo(() => (project ? getProjectShiftRecords(project) : []), [project]);
    const validShiftIds = useMemo(() => new Set(shiftRecords.map((record) => record.shift.shiftId)), [shiftRecords]);
    const expandedShiftId = requestedShiftId && validShiftIds.has(requestedShiftId) ? requestedShiftId : null;
    const projectStatusLabel = project?.finalized ? "Finalized" : (project?.status?.trim() || "Draft");
    const projectStaffingTone = project ? getProjectStaffingTone(project) : "empty";
    const selectedClient = useMemo(
        () => clients.find((client) => client.clientCompanyId === (project?.clientCompanyId ?? "")) ?? null,
        [clients, project?.clientCompanyId]
    );
    const selectedDraftClient = useMemo(
        () => clients.find((client) => client.clientCompanyId === (projectDraft.clientCompanyId ?? "")) ?? null,
        [clients, projectDraft.clientCompanyId]
    );
    const normalizedProjectTimezone = projectDraft.projectTimezone?.trim() || "";
    const hasValidProjectTimezone = isSupportedTimeZone(normalizedProjectTimezone);
    const usersById = useMemo(() => Object.fromEntries(users.map((user) => [user.userId, user] as const)), [users]);
    const expandedShiftRecord = useMemo(
        () => shiftRecords.find((record) => record.shift.shiftId === expandedShiftId) ?? null,
        [expandedShiftId, shiftRecords]
    );
    useEffect(() => {
        if (!expandedShiftRecord || usersLoaded || loadingUsers) return;
        void loadUsers();
    }, [expandedShiftRecord, loadUsers, loadingUsers, usersLoaded]);

    const editingShiftRecord = useMemo(
        () => (editingShiftId ? shiftRecords.find((record) => record.shift.shiftId === editingShiftId) ?? null : null),
        [editingShiftId, shiftRecords]
    );
    const scheduledAllocations = useMemo(() => {
        if (!expandedShiftRecord) return [];
        return [...expandedShiftRecord.shift.allocations].sort((left, right) => {
            const leftName = getScheduledDisplayName(left, usersById[left.userId]);
            const rightName = getScheduledDisplayName(right, usersById[right.userId]);
            return leftName.localeCompare(rightName);
        });
    }, [expandedShiftRecord, usersById]);
    // Preset-email recipients for the project-level send: everyone still assigned (not
    // cancelled) across all of the project's shifts. Per-shift recipients are computed inline
    // on each shift header's tools menu.
    const projectRecipientUserIds = useMemo(() => {
        const ids = new Set<string>();
        shiftRecords.forEach((record) => {
            record.shift.allocations
                .filter((allocation) => allocation.status !== "CANCELLED")
                .forEach((allocation) => {
                    if (allocation.userId) ids.add(allocation.userId);
                });
        });
        return [...ids];
    }, [shiftRecords]);
    const filteredScheduledAllocations = useMemo(
        () => scheduledAllocations.filter((allocation) => matchesScheduledFilter(allocation, scheduledFilter)),
        [scheduledAllocations, scheduledFilter]
    );
    const availableUsers = useMemo(() => {
        if (!expandedShiftRecord || !usersLoaded) return [];
        const normalizedSearch = shiftSearchTerm.trim().toLowerCase();
        const assignedIds = new Set(expandedShiftRecord.shift.allocations.map((allocation) => allocation.userId));
        return users
            .filter((user) => user.status === "ACTIVE")
            .filter((user) => !assignedIds.has(user.userId))
            .filter((user) => {
                if (!normalizedSearch) return true;
                const displayName = getUserDisplayName(user).toLowerCase();
                return displayName.includes(normalizedSearch)
                    || user.email.toLowerCase().includes(normalizedSearch)
                    || (user.position ?? "").toLowerCase().includes(normalizedSearch);
            })
            .sort((left, right) => getUserDisplayName(left).localeCompare(getUserDisplayName(right)));
    }, [expandedShiftRecord, shiftSearchTerm, users, usersLoaded]);
    const visibleAvailableUsers = useMemo(
        () => availableUsers.slice(0, AVAILABLE_USER_RENDER_LIMIT),
        [availableUsers]
    );
    const visibleAvatarUserIds = useMemo(() => {
        const ids = new Set<string>();
        filteredScheduledAllocations.forEach((allocation) => ids.add(allocation.userId));
        visibleAvailableUsers.forEach((user) => ids.add(user.userId));
        return [...ids];
    }, [filteredScheduledAllocations, visibleAvailableUsers]);
    const setAvatarUrl = useCallback((userId: string, url: string | null) => {
        setAvatarUrls((current) => {
            const existing = current[userId];
            if (existing && existing !== url) {
                URL.revokeObjectURL(existing);
            }

            const next = { ...current, [userId]: url };
            avatarUrlsRef.current = next;
            return next;
        });
    }, []);

    useEffect(() => {
        if (requestedShiftId && !validShiftIds.has(requestedShiftId)) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete("shift");
            setSearchParams(nextParams, { replace: true });
        }
    }, [requestedShiftId, searchParams, setSearchParams, validShiftIds]);

    useEffect(() => {
        return () => {
            Object.values(avatarUrlsRef.current).forEach((url) => {
                if (url) URL.revokeObjectURL(url);
            });
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadAvatar = async (userId: string) => {
            try {
                const blob = await UserServices.getUserProfilePicture(userId);
                if (cancelled) return;
                const url = blob ? URL.createObjectURL(blob) : null;
                setAvatarUrl(userId, url);
            } catch {
                if (!cancelled) setAvatarUrl(userId, null);
            }
        };

        visibleAvatarUserIds.forEach((userId) => {
            if (requestedAvatarIdsRef.current.has(userId)) return;
            requestedAvatarIdsRef.current.add(userId);
            void loadAvatar(userId);
        });

        return () => {
            cancelled = true;
        };
    }, [setAvatarUrl, visibleAvatarUserIds]);

    useEffect(() => {
        setShiftSearchTerm("");
        setScheduledFilter("all");
        setAssignmentError(null);
        setIsShiftInfoOpen(false);
    }, [expandedShiftId]);

    useEffect(() => {
        if (!createdShiftId) return;
        if (autoExpandedCreatedShiftIdsRef.current.has(createdShiftId)) return;

        autoExpandedCreatedShiftIdsRef.current.add(createdShiftId);
        if (requestedShiftId === createdShiftId) return;
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("shift", createdShiftId);
        setSearchParams(nextParams, { replace: true });
        const timeoutId = window.setTimeout(() => setCreatedShiftId((current) => (current === createdShiftId ? null : current)), 2500);
        return () => window.clearTimeout(timeoutId);
    }, [createdShiftId, requestedShiftId, searchParams, setSearchParams]);

    useEffect(() => {
        if (!expandedShiftId) return;
        document.getElementById(`planning-shift-${expandedShiftId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [expandedShiftId, shiftRecords.length]);

    useEffect(() => {
        if (!project || isCreateShiftOpen) return;
        setShiftDraft(buildInitialShiftDraft(project));
    }, [project, isCreateShiftOpen]);

    useEffect(() => {
        if (!project || !editingShiftRecord) return;
        setEditShiftDraft(buildShiftDraftFromRecord(editingShiftRecord.day, editingShiftRecord.shift, project));
    }, [editingShiftRecord, project]);

    useEffect(() => {
        if (!project || isEditProjectOpen) return;
        setProjectDraft(buildProjectDraft(project));
    }, [project, isEditProjectOpen]);

    const toggleShift = (shiftId: string) => {
        const nextParams = new URLSearchParams(searchParams);
        if (expandedShiftId === shiftId) nextParams.delete("shift");
        else nextParams.set("shift", shiftId);
        setSearchParams(nextParams, { replace: true });
        setIsAppliedListExpanded(false);
    };

    const openCreateShiftModal = () => {
        if (!project || project.finalized) return;
        setShiftDraft(buildInitialShiftDraft(project));
        setCreateShiftError(null);
        setIsCreateShiftOpen(true);
    };

    const closeCreateShiftModal = () => {
        if (savingShift) return;
        setIsCreateShiftOpen(false);
        setCreateShiftError(null);
        if (project) setShiftDraft(buildInitialShiftDraft(project));
    };

    const openEditShiftModal = (shiftId: string) => {
        if (!project || project.finalized) return;
        const record = shiftRecords.find((candidate) => candidate.shift.shiftId === shiftId);
        if (!record) return;
        setEditingShiftId(shiftId);
        setEditShiftDraft(buildShiftDraftFromRecord(record.day, record.shift, project));
        setDeletingShift(false);
        setEditShiftError(null);
    };

    const closeEditShiftModal = () => {
        if (savingShift || deletingShift) return;
        setEditingShiftId(null);
        setDeletingShift(false);
        setEditShiftError(null);
        if (project) setEditShiftDraft(buildInitialShiftDraft(project));
    };

    const openEditProjectModal = () => {
        if (!project || project.finalized) return;
        setProjectDraft(buildProjectDraft(project));
        setDeletingProject(false);
        setProjectSaveError(null);
        loadTimeZoneOptions();
        setIsEditProjectOpen(true);
    };

    const closeEditProjectModal = () => {
        if (savingProject || deletingProject) return;
        setIsEditProjectOpen(false);
        setDeletingProject(false);
        setProjectSaveError(null);
        if (project) setProjectDraft(buildProjectDraft(project));
    };

    const handleUpdateProject = async (submitEvent: FormEvent) => {
        submitEvent.preventDefault();
        if (!project) return setProjectSaveError("Project not found.");

        const defaultStartTime = parseTimeInput(projectDraft.defaultStartTime?.toString() ?? "");
        const defaultEndTime = parseTimeInput(projectDraft.defaultEndTime?.toString() ?? "");
        const startDate = parseDateInput(projectDraft.startDate || "");
        const endDate = parseDateInput(projectDraft.endDate || "");

        const payload: PlanningProjectSaveDTO = {
            name: projectDraft.name?.trim() || "",
            startDate: startDate || "",
            endDate: endDate || "",
            projectTimezone: normalizedProjectTimezone,
            clientCompanyId: projectDraft.clientCompanyId?.toString().trim() ? projectDraft.clientCompanyId : null,
            location: projectDraft.location?.toString().trim() || null,
            savedLocationId: projectDraft.savedLocationId ?? null,
            internalDescription: projectDraft.internalDescription?.toString().trim() || null,
            externalDescription: projectDraft.externalDescription?.toString().trim() || null,
            defaultStartTime,
            defaultEndTime,
            status: projectDraft.status?.toString().trim() || null,
        };

        if (!payload.name) {
            return setProjectSaveError("Project name is required.");
        }

        if (!payload.startDate || !payload.endDate) {
            return setProjectSaveError("Start and end date must use dd/mm/yyyy.");
        }

        if (payload.endDate < payload.startDate) {
            return setProjectSaveError("End date cannot be before start date.");
        }

        if (!hasValidProjectTimezone) {
            return setProjectSaveError("Project time zone must be a valid value like Europe/Amsterdam.");
        }

        if (projectDraft.defaultStartTime?.toString().trim() && !defaultStartTime) {
            return setProjectSaveError("Default start time must be a valid 24-hour time, like 9:00 or 09:00.");
        }

        if (projectDraft.defaultEndTime?.toString().trim() && !defaultEndTime) {
            return setProjectSaveError("Default end time must be a valid 24-hour time, like 9:00 or 09:00.");
        }

        try {
            setSavingProject(true);
            setProjectSaveError(null);
            await UserServices.updatePlanningProject(project.projectId, payload);
            setIsEditProjectOpen(false);
            await loadProject();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to update project.";
            setProjectSaveError(message);
        } finally {
            setSavingProject(false);
        }
    };

    const handleDeleteProject = async () => {
        if (!project) {
            setProjectSaveError("Project not found.");
            return;
        }

        const confirmed = window.confirm(
            `Delete project "${project.projectName}"? This will also delete its ${shiftRecords.length} shift${shiftRecords.length === 1 ? "" : "s"}.`
        );
        if (!confirmed) return;

        try {
            setDeletingProject(true);
            setProjectSaveError(null);
            await UserServices.deletePlanningProject(project.projectId);
            setIsEditProjectOpen(false);
            navigate("/management/planning", { replace: true });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to delete project.";
            setProjectSaveError(message);
        } finally {
            setDeletingProject(false);
        }
    };

    const handleCreateShift = async (submitEvent: FormEvent) => {
        submitEvent.preventDefault();
        if (!project) return setCreateShiftError("Project not found.");
        if (!shiftDraft.startDate || !shiftDraft.startTime || !shiftDraft.endDate || !shiftDraft.endTime) {
            return setCreateShiftError("Shift start and end are required.");
        }
        if (!shiftDraft.functionName.trim()) return setCreateShiftError("Job function is required.");
        const shiftStartDate = parseDateInput(shiftDraft.startDate);
        const shiftEndDate = parseDateInput(shiftDraft.endDate);
        if (!shiftStartDate || !shiftEndDate) {
            return setCreateShiftError("Use date format: dd/mm/yyyy.");
        }
        const shiftStartDateTime = `${shiftStartDate}T${shiftDraft.startTime}`;
        const shiftEndDateTime = `${shiftEndDate}T${shiftDraft.endTime}`;
        if (shiftEndDateTime <= shiftStartDateTime) return setCreateShiftError("Shift end time must be after the start time.");
        if (shiftStartDate < project.startDate || shiftEndDate > project.endDate) {
            return setCreateShiftError("Shift must stay within the project date range.");
        }
        const breakMinutes = shiftDraft.breakMinutes.trim() === "" ? null : Number(shiftDraft.breakMinutes);
        const peopleNeeded = shiftDraft.peopleNeeded.trim() === "" ? null : Number(shiftDraft.peopleNeeded);
        if (breakMinutes !== null && (!Number.isInteger(breakMinutes) || breakMinutes < 0)) {
            return setCreateShiftError("Break minutes must be 0 or more.");
        }
        if (peopleNeeded !== null && (!Number.isInteger(peopleNeeded) || peopleNeeded < 1)) {
            return setCreateShiftError("People needed must be at least 1.");
        }

        try {
            setSavingShift(true);
            setCreateShiftError(null);
            const response = await UserServices.createPlanningShift(project.projectId, {
                startTime: shiftStartDateTime,
                endTime: shiftEndDateTime,
                name: shiftDraft.name.trim() || null,
                functionName: shiftDraft.functionName.trim(),
                breakMinutes,
                location: shiftDraft.location.trim() || null,
                savedLocationId: shiftDraft.savedLocationId ?? null,
                peopleNeeded,
            });
            setIsCreateShiftOpen(false);
            setCreatedShiftId(response.shiftId);
            await loadProject();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to create shift.";
            setCreateShiftError(message);
        } finally {
            setSavingShift(false);
        }
    };

    const handleUpdateShift = async (submitEvent: FormEvent) => {
        submitEvent.preventDefault();
        if (!project || !editingShiftId) return setEditShiftError("Shift not found.");
        if (!editShiftDraft.startDate || !editShiftDraft.startTime || !editShiftDraft.endDate || !editShiftDraft.endTime) {
            return setEditShiftError("Shift start and end are required.");
        }
        if (!editShiftDraft.functionName.trim()) return setEditShiftError("Job function is required.");
        const shiftStartDate = parseDateInput(editShiftDraft.startDate);
        const shiftEndDate = parseDateInput(editShiftDraft.endDate);
        if (!shiftStartDate || !shiftEndDate) {
            return setEditShiftError("Use date format: dd/mm/yyyy.");
        }
        const shiftStartDateTime = `${shiftStartDate}T${editShiftDraft.startTime}`;
        const shiftEndDateTime = `${shiftEndDate}T${editShiftDraft.endTime}`;
        if (shiftEndDateTime <= shiftStartDateTime) return setEditShiftError("Shift end time must be after the start time.");
        if (shiftStartDate < project.startDate || shiftEndDate > project.endDate) {
            return setEditShiftError("Shift must stay within the project date range.");
        }
        const breakMinutes = editShiftDraft.breakMinutes.trim() === "" ? null : Number(editShiftDraft.breakMinutes);
        const peopleNeeded = editShiftDraft.peopleNeeded.trim() === "" ? null : Number(editShiftDraft.peopleNeeded);
        if (breakMinutes !== null && (!Number.isInteger(breakMinutes) || breakMinutes < 0)) {
            return setEditShiftError("Break minutes must be 0 or more.");
        }
        if (peopleNeeded !== null && (!Number.isInteger(peopleNeeded) || peopleNeeded < 1)) {
            return setEditShiftError("People needed must be at least 1.");
        }

        try {
            setSavingShift(true);
            setEditShiftError(null);
            await UserServices.updatePlanningShift(editingShiftId, {
                startTime: shiftStartDateTime,
                endTime: shiftEndDateTime,
                name: editShiftDraft.name.trim() || null,
                functionName: editShiftDraft.functionName.trim(),
                breakMinutes,
                location: editShiftDraft.location.trim() || null,
                savedLocationId: editShiftDraft.savedLocationId ?? null,
                peopleNeeded,
            });
            setEditingShiftId(null);
            await loadProject();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to update shift.";
            setEditShiftError(message);
        } finally {
            setSavingShift(false);
        }
    };

    const handleDeleteShift = async () => {
        if (!project || !editingShiftId || !editingShiftRecord) {
            setEditShiftError("Shift not found.");
            return;
        }

        const shiftIdToDelete = editingShiftId;
        const confirmed = window.confirm(
            `Delete shift "${formatShiftSummaryLine(editingShiftRecord.day, editingShiftRecord.shift)}"? This cannot be undone.`
        );
        if (!confirmed) return;

        try {
            setDeletingShift(true);
            setEditShiftError(null);
            await UserServices.deletePlanningShift(shiftIdToDelete);
            setEditingShiftId(null);
            setCreatedShiftId((current) => (current === shiftIdToDelete ? null : current));

            if (requestedShiftId === shiftIdToDelete) {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.delete("shift");
                setSearchParams(nextParams, { replace: true });
            }

            await loadProject();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to delete shift.";
            setEditShiftError(message);
        } finally {
            setDeletingShift(false);
        }
    };

    const handleScheduleUser = useCallback(async (shiftId: string, userId: string) => {
        if (!project || project.finalized) return;
        try {
            setPendingActionKey(`schedule:${shiftId}:${userId}`);
            setAssignmentError(null);
            const existingAllocation = shiftRecords
                .find((record) => record.shift.shiftId === shiftId)
                ?.shift.allocations.find((allocation) => allocation.userId === userId);

            if (existingAllocation) {
                await UserServices.updatePlanningAssignment(existingAllocation.scheduleEntryId, { userId, status: "ASSIGNED" });
            } else {
                await UserServices.createPlanningAssignment(shiftId, { userId, status: "ASSIGNED" });
            }
            await loadProject();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to schedule employee.";
            setAssignmentError(message);
        } finally {
            setPendingActionKey(null);
        }
    }, [project, loadProject, shiftRecords]);

    const handleInviteAgain = useCallback(async (scheduleEntryId: string, userId: string) => {
        if (!project || project.finalized) return;
        try {
            setPendingActionKey(`reinvite:${scheduleEntryId}`);
            setAssignmentError(null);
            await UserServices.updatePlanningAssignment(scheduleEntryId, { userId, status: "ASSIGNED" });
            await loadProject();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to invite employee again.";
            setAssignmentError(message);
        } finally {
            setPendingActionKey(null);
        }
    }, [project, loadProject]);

    const handleUnscheduleUser = useCallback(async (scheduleEntryId: string) => {
        if (!project || project.finalized) return;
        try {
            setPendingActionKey(`remove:${scheduleEntryId}`);
            setAssignmentError(null);
            await UserServices.deletePlanningAssignment(scheduleEntryId);
            await loadProject();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to remove employee from shift.";
            setAssignmentError(message);
        } finally {
            setPendingActionKey(null);
        }
    }, [project, loadProject]);

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <div className="planningDetailBreadcrumbs">
                            <PageBack to="/management/planning" />
                        </div>

                        <header className="pageHeader">
                            <h1 className="pageTitle">Project</h1>
                            <p className="pageSubtitle">{project?.projectName ?? "Planning project details"}</p>
                        </header>

                        <div className="adminDashboardCard">
                            {loading ? <div className="planningDetailEmpty">Loading project...</div> : null}
                            {!loading && error ? <div className="planningDetailEmpty planningDetailEmpty--error">{error}</div> : null}

                            {!loading && !error && project ? (
                                <Card
                                    title={
                                        <span className="planningDetailProjectTitle">
                                            {formatProjectHeaderTitle(project)}
                                        </span>
                                    }
                                    className={[
                                        "planningDetailCard",
                                        "planningDetailProjectCard",
                                        `planningDetailProjectCard--${projectStaffingTone}`,
                                    ].join(" ")}
                                    right={
                                        <div className="planningDetailHeaderTools">
                                            <PageToolsMenu
                                                exportAction={{
                                                    filename: documentFileBaseName("project", project.projectName),
                                                    build: () => buildProjectCsv(project),
                                                }}
                                                mail={
                                                    projectRecipientUserIds.length > 0
                                                        ? {
                                                              group: "PROJECTS",
                                                              recipientUserIds: projectRecipientUserIds,
                                                              recipientLabel: "everyone in this project",
                                                          }
                                                        : undefined
                                                }
                                                className="planningDetailHeaderToolsMenu"
                                            />
                                            <span
                                                className={[
                                                    "planningDetailShiftRequirement",
                                                    "planningDetailShiftRequirement--summary",
                                                ].join(" ")}
                                                data-tooltip={getProjectRequirementTitle(project)}
                                                aria-label={getProjectRequirementTitle(project)}
                                                tabIndex={0}
                                            >
                                                {formatProjectRequirement(project)}
                                            </span>
                                        </div>
                                    }
                                >
                                    <div
                                        className={[
                                            "planningDetailSplitLayout",
                                            isSidePanelCollapsed ? "planningDetailSplitLayout--sideCollapsed" : "",
                                        ].filter(Boolean).join(" ")}
                                    >
                                        <section className="planningDetailSplitMain">
                                            <div className="planningDetailPanelHeader">
                                                <div>
                                                    <h3 className="planningDetailPanelTitle">Shifts</h3>
                                                    <p className="planningDetailPanelSubtitle">
                                                        {shiftRecords.length === 0
                                                            ? "No shifts created for this project yet."
                                                            : `${shiftRecords.length} shift${shiftRecords.length === 1 ? "" : "s"} planned for this project.`}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="planningDetailPrimaryButton planningDetailHeaderAction"
                                                    onClick={openCreateShiftModal}
                                                    disabled={Boolean(project.finalized)}
                                                >
                                                    Create shift
                                                </button>
                                            </div>

                                            {shiftRecords.length === 0 ? (
                                                <div className="planningDetailEmpty planningDetailEmpty--inset">
                                                    No shifts created for this project yet.
                                                </div>
                                            ) : (
                                                <div className="planningDetailShiftList planningDetailShiftList--main">
                                                    {shiftRecords.map((record) => {
                                                        const isExpanded = expandedShiftId === record.shift.shiftId;
                                                        const shiftDetailId = `planning-shift-panel-${record.shift.shiftId}`;
                                                        const recordAvailableUsers = isExpanded ? visibleAvailableUsers : [];
                                                        const recordAvailableUserCount = isExpanded ? availableUsers.length : 0;
                                                        const isAvailableUserListLimited = isExpanded && availableUsers.length > recordAvailableUsers.length;
                                                        const shiftStaffingTone = getShiftStaffingTone(record.shift);
                                                        const shiftApplicants = record.shift.applicants ?? [];
                                                        const shiftApplicantCount = getShiftApplicantCount(record.shift);
                                                        const appliedTooltip = `Applied: ${shiftApplicantCount} ${shiftApplicantCount === 1 ? "person" : "people"} applied`;

                                                        return (
                                                            <article
                                                                key={record.shift.shiftId}
                                                                id={`planning-shift-${record.shift.shiftId}`}
                                                                className={[
                                                                    "planningDetailShiftCard",
                                                                    `planningDetailShiftCard--${shiftStaffingTone}`,
                                                                    isExpanded ? "planningDetailShiftCard--expanded" : "",
                                                                    createdShiftId === record.shift.shiftId ? "planningDetailShiftCard--highlighted" : "",
                                                                ].filter(Boolean).join(" ")}
                                                            >
                                                                {/* The whole header bar toggles the shift — the inner button carries the
                                                                    keyboard/ARIA semantics and its click simply bubbles up to here. */}
                                                                <div
                                                                    className="planningDetailShiftHeader"
                                                                    onClick={() => toggleShift(record.shift.shiftId)}
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        className="planningDetailShiftToggle"
                                                                        aria-expanded={isExpanded}
                                                                        aria-controls={shiftDetailId}
                                                                    >
                                                                        <div className="planningDetailShiftSummaryLine">
                                                                            {formatShiftSummaryLine(record.day, record.shift)}
                                                                        </div>
                                                                    </button>
                                                                    <div className="planningDetailShiftHeaderAside">
                                                                        {/* Tools opens a dropdown; keep its clicks from toggling the shift. */}
                                                                        <span
                                                                            className="planningDetailShiftHeaderTools"
                                                                            onClick={(clickEvent) => clickEvent.stopPropagation()}
                                                                        >
                                                                            <PageToolsMenu
                                                                                exportAction={{
                                                                                    filename: documentFileBaseName("shift", project?.projectName),
                                                                                    build: () =>
                                                                                        buildShiftCsv(record.shift, {
                                                                                            projectName: project?.projectName,
                                                                                            day: record.day,
                                                                                        }),
                                                                                }}
                                                                                mail={(() => {
                                                                                    const recipients = Array.from(
                                                                                        new Set(
                                                                                            record.shift.allocations
                                                                                                .filter((allocation) => allocation.status !== "CANCELLED")
                                                                                                .map((allocation) => allocation.userId)
                                                                                                .filter(Boolean)
                                                                                        )
                                                                                    );
                                                                                    return recipients.length > 0
                                                                                        ? {
                                                                                              group: "SHIFTS" as const,
                                                                                              recipientUserIds: recipients,
                                                                                              recipientLabel: "everyone in this shift",
                                                                                          }
                                                                                        : undefined;
                                                                                })()}
                                                                                className="planningDetailHeaderToolsMenu"
                                                                            />
                                                                        </span>
                                                                            <span
                                                                                className={[
                                                                                    "planningDetailShiftRequirement",
                                                                                    `planningDetailShiftRequirement--${shiftStaffingTone}`,
                                                                                ].join(" ")}
                                                                                data-tooltip={getShiftRequirementTitle(record.shift)}
                                                                                aria-label={getShiftRequirementTitle(record.shift)}
                                                                                tabIndex={0}
                                                                            >
                                                                                {formatShiftRequirement(record.shift)}
                                                                            </span>
                                                                            <span
                                                                                className="planningDetailShiftRequirement planningDetailShiftRequirement--applied"
                                                                                data-tooltip={appliedTooltip}
                                                                                aria-label={appliedTooltip}
                                                                                tabIndex={0}
                                                                            >
                                                                                {shiftApplicantCount}
                                                                            </span>
                                                                            <span
                                                                                className={[
                                                                                    "planningDetailShiftChevron",
                                                                                    isExpanded ? "planningDetailShiftChevron--expanded" : "",
                                                                                ].join(" ")}
                                                                                aria-hidden="true"
                                                                            >
                                                                                ▾
                                                                            </span>
                                                                    </div>
                                                                </div>

                                                                {isExpanded ? (
                                                                    <div id={shiftDetailId} className="planningDetailShiftPanel">
                                                                        <div className="planningDetailShiftInfo">
                                                                            <button
                                                                                type="button"
                                                                                className="planningDetailShiftInfoToggle"
                                                                                onClick={() => setIsShiftInfoOpen((current) => !current)}
                                                                                aria-expanded={isShiftInfoOpen}
                                                                            >
                                                                                <span>Shift details</span>
                                                                                <span
                                                                                    className={[
                                                                                        "planningDetailShiftChevron",
                                                                                        isShiftInfoOpen ? "planningDetailShiftChevron--expanded" : "",
                                                                                    ].join(" ")}
                                                                                    aria-hidden="true"
                                                                                >
                                                                                    ▾
                                                                                </span>
                                                                            </button>
                                                                            {isShiftInfoOpen ? (
                                                                                <div className="planningDetailShiftInfoBody">
                                                                                    <div className="planningDetailMiniRows">
                                                                                        <div className="planningDetailMiniRow">
                                                                                            <span className="planningDetailMiniLabel">Function:</span>
                                                                                            <span className="planningDetailMiniValue">{record.shift.functionName}</span>
                                                                                        </div>
                                                                                        <div className="planningDetailMiniRow">
                                                                                            <span className="planningDetailMiniLabel">Staffing:</span>
                                                                                            <span className="planningDetailMiniValue">{getShiftStaffingLabel(record.shift)}</span>
                                                                                        </div>
                                                                                        <div className="planningDetailMiniRow">
                                                                                            <span className="planningDetailMiniLabel">Duration:</span>
                                                                                            <span className="planningDetailMiniValue">{formatShiftDuration(record.day, record.shift)}</span>
                                                                                        </div>
                                                                                        <div className="planningDetailMiniRow">
                                                                                            <span className="planningDetailMiniLabel">Location:</span>
                                                                                            <span className="planningDetailMiniValue">{getShiftLocation(project, record.shift)}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <button
                                                                                        type="button"
                                                                                        className="planningDetailShiftEditButton"
                                                                                        onClick={() => openEditShiftModal(record.shift.shiftId)}
                                                                                        disabled={Boolean(project.finalized)}
                                                                                        aria-label={`Edit ${getShiftDisplayName(record.shift)}`}
                                                                                    >
                                                                                        <PencilIcon />
                                                                                        <span>Edit shift</span>
                                                                                    </button>
                                                                                </div>
                                                                            ) : null}
                                                                        </div>

                                                                        <div className="planningDetailAppliedSection">
                                                                            <button
                                                                                type="button"
                                                                                className="planningDetailAppliedToggle"
                                                                                onClick={() => setIsAppliedListExpanded((value) => !value)}
                                                                                aria-expanded={isAppliedListExpanded}
                                                                                aria-controls={`planning-shift-applied-${record.shift.shiftId}`}
                                                                            >
                                                                                <span>Applied ({shiftApplicantCount})</span>
                                                                                <span
                                                                                    className={[
                                                                                        "planningDetailShiftChevron",
                                                                                        isAppliedListExpanded ? "planningDetailShiftChevron--expanded" : "",
                                                                                    ].filter(Boolean).join(" ")}
                                                                                    aria-hidden="true"
                                                                                >
                                                                                    ▾
                                                                                </span>
                                                                            </button>
                                                                            {isAppliedListExpanded ? (
                                                                                <div
                                                                                    id={`planning-shift-applied-${record.shift.shiftId}`}
                                                                                    className="planningDetailAppliedList"
                                                                                >
                                                                                    {shiftApplicants.length === 0 ? (
                                                                                        <div className="planningDetailEmpty planningDetailEmpty--inset">
                                                                                            Nobody has applied to this shift yet.
                                                                                        </div>
                                                                                    ) : (
                                                                                        shiftApplicants.map((applicant) => {
                                                                                            const applicantUser = usersById[applicant.userId];
                                                                                            const applicantName =
                                                                                                applicant.userDisplayName?.trim() ||
                                                                                                (applicantUser ? getUserDisplayName(applicantUser) : "Unnamed employee");
                                                                                            const applicantAvatarUrl = avatarUrls[applicant.userId] ?? null;
                                                                                            const applicantActionKey = `schedule:${record.shift.shiftId}:${applicant.userId}`;

                                                                                            return (
                                                                                                <div
                                                                                                    key={applicant.userId}
                                                                                                    className="planningDetailAssignmentCard planningDetailAssignmentCard--person"
                                                                                                >
                                                                                                    <div className="planningDetailPersonCardHeader">
                                                                                                        <div className="planningDetailPersonIdentity">
                                                                                                            <div
                                                                                                                className={[
                                                                                                                    "planningDetailPersonAvatar",
                                                                                                                    applicantAvatarUrl ? "planningDetailPersonAvatar--image" : "",
                                                                                                                ].filter(Boolean).join(" ")}
                                                                                                                aria-hidden="true"
                                                                                                            >
                                                                                                                {applicantAvatarUrl ? (
                                                                                                                    <img src={applicantAvatarUrl} alt="" />
                                                                                                                ) : (
                                                                                                                    getAvatarInitials(applicantName)
                                                                                                                )}
                                                                                                            </div>
                                                                                                            <div className="planningDetailPersonText">
                                                                                                                <div className="planningDetailShiftTitle">{applicantName}</div>
                                                                                                                <div className="planningDetailShiftMeta">
                                                                                                                    Applied {formatTimeAgo(applicant.appliedAt)}
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            className="planningDetailPrimaryButton"
                                                                                                            onClick={() => void handleScheduleUser(record.shift.shiftId, applicant.userId)}
                                                                                                            disabled={Boolean(pendingActionKey) || Boolean(project.finalized)}
                                                                                                        >
                                                                                                            {pendingActionKey === applicantActionKey ? "Scheduling..." : "Schedule"}
                                                                                                        </button>
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        })
                                                                                    )}
                                                                                </div>
                                                                            ) : null}
                                                                        </div>

                                                                        {assignmentError ? (
                                                                            <div className="planningDetailModalAlert planningDetailSchedulerAlert">
                                                                                {assignmentError}
                                                                            </div>
                                                                        ) : null}

                                                                        <div className="planningDetailShiftWorkspace">
                                                                            <section className="planningDetailShiftWorkspaceColumn">
                                                                                <div className="planningDetailShiftWorkspaceHeader">
                                                                                    <h4 className="planningDetailShiftWorkspaceTitle">
                                                                                        Scheduled people ({filteredScheduledAllocations.length})
                                                                                    </h4>
                                                                                    <div className="planningModeToggle planningDetailStatusToggle" role="tablist" aria-label="Scheduled people filter">
                                                                                        {([
                                                                                            { value: "all", label: "All" },
                                                                                            { value: "scheduled", label: "Scheduled" },
                                                                                            { value: "accepted", label: "Accepted" },
                                                                                            { value: "declined", label: "Declined" },
                                                                                        ] as const).map((option) => (
                                                                                            <button
                                                                                                key={option.value}
                                                                                                type="button"
                                                                                                className={[
                                                                                                    "planningModeButton",
                                                                                                    scheduledFilter === option.value ? "planningModeButton--active" : "",
                                                                                                ].filter(Boolean).join(" ")}
                                                                                                onClick={() => setScheduledFilter(option.value)}
                                                                                                aria-pressed={scheduledFilter === option.value}
                                                                                            >
                                                                                                {option.label}
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>

                                                                                {filteredScheduledAllocations.length === 0 ? (
                                                                                    <div className="planningDetailEmpty planningDetailEmpty--inset">
                                                                                        {getScheduledFilterEmptyMessage(scheduledFilter)}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="planningDetailAssignmentList planningDetailAssignmentList--scheduler">
                                                                                        {filteredScheduledAllocations.map((allocation) => {
                                                                                            const assignedUser = usersById[allocation.userId];
                                                                                            const removeActionKey = `remove:${allocation.scheduleEntryId}`;
                                                                                            const inviteAgainActionKey = `reinvite:${allocation.scheduleEntryId}`;
                                                                                            const displayName = getScheduledDisplayName(allocation, assignedUser);
                                                                                            const avatarUrl = assignedUser ? (avatarUrls[assignedUser.userId] ?? null) : null;
                                                                                            const allocationTone = getAllocationStatusTone(allocation.status);
                                                                                            const allocationLabel = getAllocationStatusLabel(allocation.status);

                                                                                            return (
                                                                                                <div
                                                                                                    key={allocation.scheduleEntryId}
                                                                                                    className={[
                                                                                                        "planningDetailAssignmentCard",
                                                                                                        "planningDetailAssignmentCard--person",
                                                                                                        `planningDetailAssignmentCard--${allocationTone}`,
                                                                                                    ].join(" ")}
                                                                                                >
                                                                                                    <div className="planningDetailPersonCardHeader">
                                                                                                        <div className="planningDetailPersonIdentity">
                                                                                                            <div
                                                                                                                className={[
                                                                                                                    "planningDetailPersonAvatar",
                                                                                                                    avatarUrl ? "planningDetailPersonAvatar--image" : "",
                                                                                                                ].filter(Boolean).join(" ")}
                                                                                                                aria-hidden="true"
                                                                                                            >
                                                                                                                {avatarUrl ? (
                                                                                                                    <img src={avatarUrl} alt="" />
                                                                                                                ) : (
                                                                                                                    getAvatarInitials(displayName)
                                                                                                                )}
                                                                                                            </div>
                                                                                                            <div className="planningDetailPersonText">
                                                                                                                <div className="planningDetailShiftTitle">
                                                                                                                    {displayName}
                                                                                                                </div>
                                                                                                                <div className="planningDetailShiftMeta">
                                                                                                                    {assignedUser ? getUserSummary(assignedUser) : allocation.userId}
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <div className="planningDetailPersonCardActions">
                                                                                                            <span className="planningEntryBadge">{allocationLabel}</span>
                                                                                                            {allocationTone === "declined" ? (
                                                                                                                <button
                                                                                                                    type="button"
                                                                                                                    className="planningDetailPrimaryButton"
                                                                                                                    onClick={() => void handleInviteAgain(allocation.scheduleEntryId, allocation.userId)}
                                                                                                                    disabled={Boolean(pendingActionKey) || Boolean(project.finalized)}
                                                                                                                >
                                                                                                                    {pendingActionKey === inviteAgainActionKey ? "Inviting..." : "Invite again"}
                                                                                                                </button>
                                                                                                            ) : (
                                                                                                                <button
                                                                                                                    type="button"
                                                                                                                    className="planningDetailSecondaryButton"
                                                                                                                    onClick={() => void handleUnscheduleUser(allocation.scheduleEntryId)}
                                                                                                                    disabled={Boolean(pendingActionKey) || Boolean(project.finalized)}
                                                                                                                >
                                                                                                                    {pendingActionKey === removeActionKey ? "Removing..." : "Remove"}
                                                                                                                </button>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                )}
                                                                            </section>

                                                                            <section className="planningDetailShiftWorkspaceColumn">
                                                                                <div className="planningDetailShiftWorkspaceHeader planningDetailShiftWorkspaceHeader--search">
                                                                                    <h4 className="planningDetailShiftWorkspaceTitle">
                                                                                        Available people ({recordAvailableUserCount})
                                                                                    </h4>
                                                                                    <input
                                                                                        className="planningDetailSearchInput"
                                                                                        type="search"
                                                                                        placeholder="Search active people"
                                                                                        value={shiftSearchTerm}
                                                                                        onChange={(inputEvent) => setShiftSearchTerm(inputEvent.target.value)}
                                                                                        disabled={Boolean(pendingActionKey) || Boolean(project.finalized) || loadingUsers}
                                                                                    />
                                                                                </div>

                                                                                {loadingUsers ? (
                                                                                    <div className="planningDetailEmpty planningDetailEmpty--inset">
                                                                                        Loading people...
                                                                                    </div>
                                                                                ) : userError ? (
                                                                                    <div className="planningDetailEmpty planningDetailEmpty--inset planningDetailEmpty--error">
                                                                                        {userError}
                                                                                    </div>
                                                                                ) : availableUsers.length === 0 ? (
                                                                                    <div className="planningDetailEmpty planningDetailEmpty--inset">
                                                                                        {shiftSearchTerm.trim()
                                                                                            ? "No matching active people found."
                                                                                            : "No active people available for this shift."}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="planningDetailAssignmentList planningDetailAssignmentList--scheduler">
                                                                                        {recordAvailableUsers.map((user) => {
                                                                                            const scheduleActionKey = `schedule:${record.shift.shiftId}:${user.userId}`;
                                                                                            const displayName = getUserDisplayName(user);
                                                                                            const avatarUrl = avatarUrls[user.userId] ?? null;

                                                                                            return (
                                                                                                <div
                                                                                                    key={user.userId}
                                                                                                    className="planningDetailAssignmentCard planningDetailAssignmentCard--person"
                                                                                                >
                                                                                                    <div className="planningDetailPersonCardHeader">
                                                                                                        <div className="planningDetailPersonIdentity">
                                                                                                            <div
                                                                                                                className={[
                                                                                                                    "planningDetailPersonAvatar",
                                                                                                                    avatarUrl ? "planningDetailPersonAvatar--image" : "",
                                                                                                                ].filter(Boolean).join(" ")}
                                                                                                                aria-hidden="true"
                                                                                                            >
                                                                                                                {avatarUrl ? (
                                                                                                                    <img src={avatarUrl} alt="" />
                                                                                                                ) : (
                                                                                                                    getAvatarInitials(displayName)
                                                                                                                )}
                                                                                                            </div>
                                                                                                            <div className="planningDetailPersonText">
                                                                                                                <div className="planningDetailShiftTitle">{displayName}</div>
                                                                                                                <div className="planningDetailShiftMeta">{getUserSummary(user)}</div>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            className="planningDetailPrimaryButton"
                                                                                                            onClick={() => void handleScheduleUser(record.shift.shiftId, user.userId)}
                                                                                                            disabled={Boolean(pendingActionKey) || Boolean(project.finalized)}
                                                                                                        >
                                                                                                            {pendingActionKey === scheduleActionKey ? "Scheduling..." : "Schedule"}
                                                                                                        </button>
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                        {isAvailableUserListLimited ? (
                                                                                            <div className="planningDetailLimitNotice">
                                                                                                Showing first {recordAvailableUsers.length} people. Search to narrow the list.
                                                                                            </div>
                                                                                        ) : null}
                                                                                    </div>
                                                                                )}
                                                                            </section>
                                                                        </div>
                                                                    </div>
                                                                ) : null}
                                                            </article>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </section>

                                        <aside
                                            className={[
                                                "planningDetailSplitSide",
                                                isSidePanelCollapsed ? "planningDetailSplitSide--collapsed" : "",
                                            ].filter(Boolean).join(" ")}
                                        >
                                        {isSidePanelCollapsed ? (
                                            <button
                                                type="button"
                                                className="planningDetailSideExpand"
                                                onClick={() => setIsSidePanelCollapsed(false)}
                                                aria-expanded={false}
                                                title="Show project details"
                                            >
                                                <span className="planningDetailSideChevron" aria-hidden="true">«</span>
                                                <span className="planningDetailSideExpandLabel">Project details</span>
                                            </button>
                                        ) : (
                                        <>
                                            <div className="planningDetailPanelHeader planningDetailPanelHeader--side">
                                                <div>
                                                    <h3 className="planningDetailPanelTitle">Project details</h3>
                                                    <p className="planningDetailPanelSubtitle">Client, timing and staffing summary.</p>
                                                </div>
                                                <div className="planningDetailSideHeaderActions">
                                                    <button
                                                        type="button"
                                                        className="planningDetailIconButton planningDetailIconButton--side planningDetailSideAction"
                                                        onClick={openEditProjectModal}
                                                        disabled={Boolean(project.finalized)}
                                                        aria-label="Edit project details"
                                                        title="Edit project details"
                                                    >
                                                        <PencilIcon />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="planningDetailIconButton planningDetailIconButton--side planningDetailSideAction"
                                                        onClick={() => setIsSidePanelCollapsed(true)}
                                                        aria-expanded={true}
                                                        aria-label="Hide project details"
                                                        title="Hide project details"
                                                    >
                                                        <span className="planningDetailSideChevron" aria-hidden="true">»</span>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="planningDetailRows">
                                                <div className="planningDetailRow"><span className="planningDetailLabel">Client</span><span className="planningDetailValue">{getProjectClientName(project)}</span></div>
                                                <div className="planningDetailRow"><span className="planningDetailLabel">Client line</span><span className="planningDetailValue">{selectedClient?.companyLine?.trim() || "No client line"}</span></div>
                                                <div className="planningDetailRow"><span className="planningDetailLabel">Location</span><span className="planningDetailValue">{getProjectLocation(project)}</span></div>
                                                <div className="planningDetailRow"><span className="planningDetailLabel">Dates</span><span className="planningDetailValue">{formatDateRange(project.startDate, project.endDate)}</span></div>
                                                <div className="planningDetailRow"><span className="planningDetailLabel">Time</span><span className="planningDetailValue">{getProjectTimeLabel(project)}</span></div>
                                                <div className="planningDetailRow"><span className="planningDetailLabel">Time zone</span><span className="planningDetailValue">{formatTimeZoneLabel(project.projectTimezone || browserTimeZone)}</span></div>
                                                <div className="planningDetailRow"><span className="planningDetailLabel">Staffing</span><span className="planningDetailValue">{getProjectStaffingLabel(project)}</span></div>
                                                <div className="planningDetailRow"><span className="planningDetailLabel">Status</span><span className="planningDetailValue">{projectStatusLabel}</span></div>
                                                <div className="planningDetailRow">
                                                    <span className="planningDetailLabel">Notes</span>
                                                    <span className="planningDetailValue">
                                                        {project.internalDescription?.trim() || project.externalDescription?.trim() || "No notes added"}
                                                    </span>
                                                </div>
                                            </div>
                                        </>
                                        )}
                                        </aside>
                                    </div>
                                </Card>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
            <Modal
                open={isCreateShiftOpen}
                onClose={closeCreateShiftModal}
                title="Create shift"
                hideDefaultFooter
                maxHeight={640}
                height={640}
                closeOnEscape={false}
                closeOnOverlayClick={false}
            >
                <form className="planningDetailModalForm" onSubmit={(submitEvent) => void handleCreateShift(submitEvent)}>
                    <div className="planningWizardSummary">
                        <span className="planningWizardSummaryLabel">Project window</span>
                        <span className="planningWizardSummaryValue">
                            {project ? formatDateRange(project.startDate, project.endDate) : "Project dates unavailable"}
                        </span>
                    </div>

                    <div className="planningDetailModalGrid">
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Shift start date</span>
                            <input
                                className="modal_input"
                                type="text"
                                inputMode="numeric"
                                placeholder="dd/mm/yyyy"
                                value={shiftDraft.startDate}
                                onChange={(inputEvent) => {
                                    setShiftDraft((current) => ({
                                        ...current,
                                        startDate: normalizeDateInput(inputEvent.target.value),
                                    }));
                                    if (createShiftError) setCreateShiftError(null);
                                }}
                                maxLength={10}
                                disabled={savingShift}
                            />
                        </label>
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Shift start time</span>
                            <input
                                className="modal_input"
                                type="time"
                                value={shiftDraft.startTime}
                                onChange={(inputEvent) => {
                                    setShiftDraft((current) => ({ ...current, startTime: inputEvent.target.value }));
                                    if (createShiftError) setCreateShiftError(null);
                                }}
                                disabled={savingShift}
                            />
                        </label>
                    </div>

                    <div className="planningDetailModalGrid">
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Shift end date</span>
                            <input
                                className="modal_input"
                                type="text"
                                inputMode="numeric"
                                placeholder="dd/mm/yyyy"
                                value={shiftDraft.endDate}
                                onChange={(inputEvent) => {
                                    setShiftDraft((current) => ({
                                        ...current,
                                        endDate: normalizeDateInput(inputEvent.target.value),
                                    }));
                                    if (createShiftError) setCreateShiftError(null);
                                }}
                                maxLength={10}
                                disabled={savingShift}
                            />
                        </label>
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Shift end time</span>
                            <input
                                className="modal_input"
                                type="time"
                                value={shiftDraft.endTime}
                                onChange={(inputEvent) => {
                                    setShiftDraft((current) => ({ ...current, endTime: inputEvent.target.value }));
                                    if (createShiftError) setCreateShiftError(null);
                                }}
                                disabled={savingShift}
                            />
                        </label>
                    </div>

                    <div className="planningDetailModalGrid">
                        <div className="planningDetailModalField">
                            <FunctionPicker
                                label="Job function"
                                value={shiftDraft.functionName}
                                allowCreate={canManageFunctions}
                                disabled={savingShift}
                                placeholder="Bar staff"
                                onChange={(nextValue) => {
                                    setShiftDraft((current) => ({ ...current, functionName: nextValue }));
                                    if (createShiftError) setCreateShiftError(null);
                                }}
                            />
                        </div>
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Shift name</span>
                            <input
                                className="modal_input"
                                value={shiftDraft.name}
                                onChange={(inputEvent) => setShiftDraft((current) => ({ ...current, name: inputEvent.target.value }))}
                                placeholder="Optional"
                                disabled={savingShift}
                            />
                        </label>
                    </div>

                    <div className="planningDetailModalGrid">
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">People needed</span>
                            <input
                                className="modal_input"
                                type="number"
                                min="1"
                                step="1"
                                value={shiftDraft.peopleNeeded}
                                onChange={(inputEvent) => {
                                    setShiftDraft((current) => ({ ...current, peopleNeeded: inputEvent.target.value }));
                                    if (createShiftError) setCreateShiftError(null);
                                }}
                                disabled={savingShift}
                            />
                        </label>
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Break minutes</span>
                            <input
                                className="modal_input"
                                type="number"
                                min="0"
                                step="1"
                                value={shiftDraft.breakMinutes}
                                onChange={(inputEvent) => {
                                    setShiftDraft((current) => ({ ...current, breakMinutes: inputEvent.target.value }));
                                    if (createShiftError) setCreateShiftError(null);
                                }}
                                disabled={savingShift}
                            />
                        </label>
                    </div>

                    <PlanningLocationPicker
                        label="Location"
                        value={shiftDraft.location}
                        savedLocationId={shiftDraft.savedLocationId}
                        clientCompanyId={project?.clientCompanyId ?? null}
                        clientCompanyName={selectedClient?.name ?? null}
                        disabled={savingShift}
                        onChange={({ value, savedLocationId }) => {
                            setShiftDraft((current) => ({ ...current, location: value, savedLocationId }));
                            if (createShiftError) setCreateShiftError(null);
                        }}
                    />

                    {createShiftError ? <div className="planningDetailModalAlert">{createShiftError}</div> : null}

                    <div className="planningDetailModalActions">
                        <button
                            type="button"
                            className="planningDetailSecondaryButton"
                            onClick={closeCreateShiftModal}
                            disabled={savingShift}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="planningDetailPrimaryButton" disabled={savingShift}>
                            {savingShift ? "Creating..." : "Create shift"}
                        </button>
                    </div>
                </form>
            </Modal>
            <Modal
                open={Boolean(editingShiftId)}
                onClose={closeEditShiftModal}
                title="Edit shift"
                hideDefaultFooter
                maxHeight={640}
                height={640}
                closeOnEscape={false}
                closeOnOverlayClick={false}
            >
                <form className="planningDetailModalForm" onSubmit={(submitEvent) => void handleUpdateShift(submitEvent)}>
                    <div className="planningWizardSummary">
                        <span className="planningWizardSummaryLabel">Project window</span>
                        <span className="planningWizardSummaryValue">
                            {project ? formatDateRange(project.startDate, project.endDate) : "Project dates unavailable"}
                        </span>
                    </div>

                    <div className="planningDetailModalGrid">
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Shift start date</span>
                            <input
                                className="modal_input"
                                type="text"
                                inputMode="numeric"
                                placeholder="dd/mm/yyyy"
                                value={editShiftDraft.startDate}
                                onChange={(inputEvent) => {
                                    setEditShiftDraft((current) => ({
                                        ...current,
                                        startDate: normalizeDateInput(inputEvent.target.value),
                                    }));
                                    if (editShiftError) setEditShiftError(null);
                                }}
                                maxLength={10}
                                disabled={savingShift}
                            />
                        </label>
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Shift start time</span>
                            <input
                                className="modal_input"
                                type="time"
                                value={editShiftDraft.startTime}
                                onChange={(inputEvent) => {
                                    setEditShiftDraft((current) => ({ ...current, startTime: inputEvent.target.value }));
                                    if (editShiftError) setEditShiftError(null);
                                }}
                                disabled={savingShift}
                            />
                        </label>
                    </div>

                    <div className="planningDetailModalGrid">
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Shift end date</span>
                            <input
                                className="modal_input"
                                type="text"
                                inputMode="numeric"
                                placeholder="dd/mm/yyyy"
                                value={editShiftDraft.endDate}
                                onChange={(inputEvent) => {
                                    setEditShiftDraft((current) => ({
                                        ...current,
                                        endDate: normalizeDateInput(inputEvent.target.value),
                                    }));
                                    if (editShiftError) setEditShiftError(null);
                                }}
                                maxLength={10}
                                disabled={savingShift}
                            />
                        </label>
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Shift end time</span>
                            <input
                                className="modal_input"
                                type="time"
                                value={editShiftDraft.endTime}
                                onChange={(inputEvent) => {
                                    setEditShiftDraft((current) => ({ ...current, endTime: inputEvent.target.value }));
                                    if (editShiftError) setEditShiftError(null);
                                }}
                                disabled={savingShift}
                            />
                        </label>
                    </div>

                    <div className="planningDetailModalGrid">
                        <div className="planningDetailModalField">
                            <FunctionPicker
                                label="Job function"
                                value={editShiftDraft.functionName}
                                allowCreate={canManageFunctions}
                                disabled={savingShift}
                                placeholder="Bar staff"
                                onChange={(nextValue) => {
                                    setEditShiftDraft((current) => ({ ...current, functionName: nextValue }));
                                    if (editShiftError) setEditShiftError(null);
                                }}
                            />
                        </div>
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Shift name</span>
                            <input
                                className="modal_input"
                                value={editShiftDraft.name}
                                onChange={(inputEvent) => setEditShiftDraft((current) => ({ ...current, name: inputEvent.target.value }))}
                                placeholder="Optional"
                                disabled={savingShift}
                            />
                        </label>
                    </div>

                    <div className="planningDetailModalGrid">
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">People needed</span>
                            <input
                                className="modal_input"
                                type="number"
                                min="1"
                                step="1"
                                value={editShiftDraft.peopleNeeded}
                                onChange={(inputEvent) => {
                                    setEditShiftDraft((current) => ({ ...current, peopleNeeded: inputEvent.target.value }));
                                    if (editShiftError) setEditShiftError(null);
                                }}
                                disabled={savingShift}
                            />
                        </label>
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Break minutes</span>
                            <input
                                className="modal_input"
                                type="number"
                                min="0"
                                step="1"
                                value={editShiftDraft.breakMinutes}
                                onChange={(inputEvent) => {
                                    setEditShiftDraft((current) => ({ ...current, breakMinutes: inputEvent.target.value }));
                                    if (editShiftError) setEditShiftError(null);
                                }}
                                disabled={savingShift}
                            />
                        </label>
                    </div>

                    <PlanningLocationPicker
                        label="Location"
                        value={editShiftDraft.location}
                        savedLocationId={editShiftDraft.savedLocationId}
                        clientCompanyId={project?.clientCompanyId ?? null}
                        clientCompanyName={selectedClient?.name ?? null}
                        disabled={savingShift}
                        onChange={({ value, savedLocationId }) => {
                            setEditShiftDraft((current) => ({ ...current, location: value, savedLocationId }));
                            if (editShiftError) setEditShiftError(null);
                        }}
                    />

                    {editShiftError ? <div className="planningDetailModalAlert">{editShiftError}</div> : null}

                    <div className="planningDetailModalActions">
                        <button
                            type="button"
                            className="planningDetailDangerButton"
                            onClick={() => void handleDeleteShift()}
                            disabled={savingShift || deletingShift}
                        >
                            {deletingShift ? "Deleting..." : "Delete shift"}
                        </button>
                        <button
                            type="button"
                            className="planningDetailSecondaryButton"
                            onClick={closeEditShiftModal}
                            disabled={savingShift || deletingShift}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="planningDetailPrimaryButton" disabled={savingShift || deletingShift}>
                            {savingShift ? "Saving..." : "Save shift"}
                        </button>
                    </div>
                </form>
            </Modal>
            <Modal
                open={isEditProjectOpen}
                onClose={closeEditProjectModal}
                title="Edit project details"
                hideDefaultFooter
                maxHeight={720}
                height={720}
                closeOnEscape={false}
                closeOnOverlayClick={false}
            >
                <form className="planningDetailModalForm" onSubmit={(submitEvent) => void handleUpdateProject(submitEvent)}>
                    <div className="planningDetailModalGrid">
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Project name</span>
                            <input
                                className="modal_input"
                                value={projectDraft.name ?? ""}
                                onChange={(inputEvent) => {
                                    setProjectDraft((current) => ({ ...current, name: inputEvent.target.value }));
                                    if (projectSaveError) setProjectSaveError(null);
                                }}
                                placeholder="Example: Breda city run"
                                disabled={savingProject}
                            />
                        </label>
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Client/company</span>
                            <select
                                className="modal_input"
                                value={projectDraft.clientCompanyId ?? ""}
                                onChange={(inputEvent) => {
                                    setProjectDraft((current) => ({ ...current, clientCompanyId: inputEvent.target.value }));
                                    if (projectSaveError) setProjectSaveError(null);
                                }}
                                disabled={savingProject || loadingClients}
                            >
                                <option value="">No client/company</option>
                                {clients.map((client) => (
                                    <option key={client.clientCompanyId} value={client.clientCompanyId}>
                                        {client.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="planningDetailModalGrid">
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Start date</span>
                            <input
                                className="modal_input"
                                type="text"
                                value={projectDraft.startDate ?? ""}
                                onChange={(inputEvent) => {
                                    const startDate = normalizeDateInput(inputEvent.target.value);
                                    setProjectDraft((current) => ({
                                        ...current,
                                        startDate,
                                        endDate: (() => {
                                            const currentEndDate = parseDateInput(current.endDate ?? "");
                                            const nextStartDate = parseDateInput(startDate);
                                            if (currentEndDate && nextStartDate && currentEndDate < nextStartDate) {
                                                return startDate;
                                            }
                                            return current.endDate;
                                        })(),
                                    }));
                                    if (projectSaveError) setProjectSaveError(null);
                                }}
                                inputMode="numeric"
                                placeholder="dd/mm/yyyy"
                                maxLength={10}
                                disabled={savingProject}
                            />
                        </label>
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">End date</span>
                            <input
                                className="modal_input"
                                type="text"
                                value={projectDraft.endDate ?? ""}
                                onChange={(inputEvent) => {
                                    setProjectDraft((current) => ({
                                        ...current,
                                        endDate: normalizeDateInput(inputEvent.target.value),
                                    }));
                                    if (projectSaveError) setProjectSaveError(null);
                                }}
                                inputMode="numeric"
                                placeholder="dd/mm/yyyy"
                                maxLength={10}
                                disabled={savingProject}
                            />
                        </label>
                    </div>

                    <div className="planningDetailModalGrid">
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Default start time</span>
                            <input
                                className="modal_input"
                                type="text"
                                inputMode="numeric"
                                placeholder="HH:mm"
                                value={projectDraft.defaultStartTime ?? ""}
                                onChange={(inputEvent) => {
                                    setProjectDraft((current) => ({ ...current, defaultStartTime: inputEvent.target.value }));
                                    if (projectSaveError) setProjectSaveError(null);
                                }}
                                disabled={savingProject}
                            />
                        </label>
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Default end time</span>
                            <input
                                className="modal_input"
                                type="text"
                                inputMode="numeric"
                                placeholder="HH:mm"
                                value={projectDraft.defaultEndTime ?? ""}
                                onChange={(inputEvent) => {
                                    setProjectDraft((current) => ({ ...current, defaultEndTime: inputEvent.target.value }));
                                    if (projectSaveError) setProjectSaveError(null);
                                }}
                                disabled={savingProject}
                            />
                        </label>
                    </div>

                    <label className="planningDetailModalField">
                        <span className="planningDetailModalLabel">Time zone</span>
                        <input
                            className="modal_input"
                            list={PROJECT_TIMEZONE_DATALIST_ID}
                            value={projectDraft.projectTimezone ?? ""}
                            onChange={(inputEvent) => {
                                setProjectDraft((current) => ({ ...current, projectTimezone: inputEvent.target.value }));
                                if (projectSaveError) setProjectSaveError(null);
                            }}
                            placeholder="Europe/Amsterdam"
                            disabled={savingProject}
                        />
                        <datalist id={PROJECT_TIMEZONE_DATALIST_ID}>
                            {timeZoneOptions.map((option) => (
                                <option key={option.value} value={option.value} label={option.label} />
                            ))}
                        </datalist>
                        <span className="roleWizardMeta">
                            {hasValidProjectTimezone
                                ? formatTimeZoneLabel(normalizedProjectTimezone)
                                : "Use a valid IANA time zone like Europe/Amsterdam."}
                        </span>
                    </label>

                    <PlanningLocationPicker
                        label="Location"
                        value={projectDraft.location ?? ""}
                        savedLocationId={projectDraft.savedLocationId ?? null}
                        clientCompanyId={projectDraft.clientCompanyId ?? null}
                        clientCompanyName={selectedDraftClient?.name ?? null}
                        disabled={savingProject}
                        onChange={({ value, savedLocationId }) => {
                            setProjectDraft((current) => ({ ...current, location: value, savedLocationId }));
                            if (projectSaveError) setProjectSaveError(null);
                        }}
                    />

                    <div className="planningDetailModalGrid">
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Internal notes</span>
                            <textarea
                                className="modal_input planningWizardTextarea"
                                value={projectDraft.internalDescription ?? ""}
                                onChange={(inputEvent) => {
                                    setProjectDraft((current) => ({ ...current, internalDescription: inputEvent.target.value }));
                                    if (projectSaveError) setProjectSaveError(null);
                                }}
                                placeholder="Optional notes for planning"
                                disabled={savingProject}
                            />
                        </label>
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">External notes</span>
                            <textarea
                                className="modal_input planningWizardTextarea"
                                value={projectDraft.externalDescription ?? ""}
                                onChange={(inputEvent) => {
                                    setProjectDraft((current) => ({ ...current, externalDescription: inputEvent.target.value }));
                                    if (projectSaveError) setProjectSaveError(null);
                                }}
                                placeholder="Optional client-facing notes"
                                disabled={savingProject}
                            />
                        </label>
                    </div>

                    {loadingClients ? <div className="roleWizardMeta">Loading client companies...</div> : null}
                    {!loadingClients && clientError ? <div className="roleWizardMeta">{clientError}</div> : null}
                    <div className="planningWizardSummary planningWizardSummary--stacked">
                        <span className="planningWizardSummaryLabel">Project summary</span>
                        <div className="planningWizardSummaryRow">
                            <span className="planningWizardSummaryItemLabel">Project</span>
                            <span className="planningWizardSummaryValue">{projectDraft.name?.trim() || "Unnamed project"}</span>
                        </div>
                        <div className="planningWizardSummaryRow">
                            <span className="planningWizardSummaryItemLabel">Project window</span>
                            <span className="planningWizardSummaryValue">{projectDraft.startDate || "dd/mm/yyyy"} to {projectDraft.endDate || "dd/mm/yyyy"}</span>
                        </div>
                        <div className="planningWizardSummaryRow">
                            <span className="planningWizardSummaryItemLabel">Default time</span>
                            <span className="planningWizardSummaryValue">
                                {(() => {
                                    const start = parseTimeInput(projectDraft.defaultStartTime ?? "");
                                    const end = parseTimeInput(projectDraft.defaultEndTime ?? "");
                                    if (start && end) return `${start} to ${end}`;
                                    if (start) return `Starts at ${start}`;
                                    if (end) return `Ends at ${end}`;
                                    return "No default time set";
                                })()}
                            </span>
                        </div>
                        <div className="planningWizardSummaryRow">
                            <span className="planningWizardSummaryItemLabel">Time zone</span>
                            <span className="planningWizardSummaryValue">{formatTimeZoneLabel(projectDraft.projectTimezone || browserTimeZone)}</span>
                        </div>
                        <div className="planningWizardSummaryRow">
                            <span className="planningWizardSummaryItemLabel">Client</span>
                            <span className="planningWizardSummaryValue">{selectedDraftClient?.name?.trim() || "No client/company selected"}</span>
                        </div>
                        <div className="planningWizardSummaryRow">
                            <span className="planningWizardSummaryItemLabel">Client line</span>
                            <span className="planningWizardSummaryValue">{selectedDraftClient?.companyLine?.trim() || "No client line added"}</span>
                        </div>
                        <div className="planningWizardSummaryRow">
                            <span className="planningWizardSummaryItemLabel">Internal note</span>
                            <span className="planningWizardSummaryValue">{projectDraft.internalDescription?.trim() || "No internal note added"}</span>
                        </div>
                    </div>
                    {projectSaveError ? <div className="planningDetailModalAlert">{projectSaveError}</div> : null}

                    <div className="planningDetailModalActions">
                        <button
                            type="button"
                            className="planningDetailDangerButton"
                            onClick={() => void handleDeleteProject()}
                            disabled={savingProject || deletingProject}
                        >
                            {deletingProject ? "Deleting..." : "Delete project"}
                        </button>
                        <button
                            type="button"
                            className="planningDetailSecondaryButton"
                            onClick={closeEditProjectModal}
                            disabled={savingProject || deletingProject}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="planningDetailPrimaryButton" disabled={savingProject || deletingProject}>
                            {savingProject ? "Saving..." : "Save project"}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
