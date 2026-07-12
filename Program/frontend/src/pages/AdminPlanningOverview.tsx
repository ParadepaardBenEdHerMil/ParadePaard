import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type TouchEvent as ReactTouchEvent } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import PlanningLocationPicker from "../components/planning/PlanningLocationPicker";
import ShiftActionMenu from "../components/planning/ShiftActionMenu";
import {
    UserServices,
    type PlanningClientCompanyDTO,
    type PlanningProjectDTO,
    type PlanningProjectSaveDTO,
    type PlanningResourceAllocationDTO,
    type UserResponseDTO,
} from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";
import { formatDateInput, normalizeDateInput, parseDisplayDate } from "../utils/dateInput";
import {
    getProjectCheckedInCount,
    getProjectClientName,
    getProjectRequiredCount,
    getProjectScheduledCount,
    getProjectShiftRecords,
    getProjectStaffingTone,
    getProjectTimeLabel,
    getShiftCheckedInCount,
    getShiftDisplayName,
    getShiftRequiredCount,
    getShiftScheduledCount,
    getShiftStaffingTone,
    getShiftTimeLabel,
    type PlanningStaffingTone,
} from "../utils/planningSummary";
import {
    buildPlanningSearchText,
    filterPlanningSearchableEntries,
} from "../utils/planningSearch";
import {
    formatTimeZoneLabel,
    getBrowserTimeZone,
    getTimeZoneOptions,
    isSupportedTimeZone,
    type TimeZoneOption,
} from "../utils/timezones";
import { useIsPhone } from "../utils/useIsPhone";
import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminPlanningOverview.css";
import "../stylesheets/Settings.css";

type PlannerMode = "projects" | "shifts";
type PlanningView = "week" | "month";
type PlanningLayoutMode = "calendar" | "list";
type ProjectCreateStep = "details" | "client" | "notes";
const PROJECT_TIMEZONE_DATALIST_ID = "planning-project-timezones";

function parseTimeInput(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!match) return null;
    return `${match[1].padStart(2, "0")}:${match[2]}`;
}

type PlannerEntry = {
    id: string;
    title: string;
    subtitle?: string;
    timeLabel: string;
    clientLabel: string;
    ratioLabel: string;
    completionLabel: string;
    staffingTone: PlanningStaffingTone;
    tone: PlannerMode;
    day?: string;
    projectId?: string;
    shiftId?: string;
    href?: string;
    searchText: string;
};

function getStaffingTooltipLabel(): string {
    return "Required / Scheduled / Checked in";
}

function getCompletionLabel(required: number, scheduled: number): string {
    if (required <= 0) return "0%";
    return `${Math.min(100, Math.round((scheduled / required) * 100))}%`;
}

function getAllocationSearchValues(allocations: PlanningResourceAllocationDTO[]): Array<string | null | undefined> {
    return allocations.flatMap((allocation) => [
        allocation.userDisplayName,
        allocation.userId,
    ]);
}

function getProjectSearchValues(project: PlanningProjectDTO): Array<string | null | undefined> {
    return [
        project.projectName,
        project.projectId,
        project.clientCompanyName,
        project.clientCompanyId,
        ...project.days.flatMap((day) => [
            ...getAllocationSearchValues(day.allocations),
            ...day.shifts.flatMap((shift) => getAllocationSearchValues(shift.allocations)),
        ]),
    ];
}

function filterEntriesBySearchQuery(
    entriesByDay: Map<string, PlannerEntry[]>,
    searchQuery: string
): Map<string, PlannerEntry[]> {
    if (!searchQuery.trim()) {
        return entriesByDay;
    }

    const filtered = new Map<string, PlannerEntry[]>();
    for (const [day, entries] of entriesByDay.entries()) {
        filtered.set(day, filterPlanningSearchableEntries(entries, searchQuery));
    }
    return filtered;
}

function toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
    return new Date(`${value}T00:00:00`);
}

function addDays(value: string, amount: number): string {
    const next = parseIsoDate(value);
    next.setDate(next.getDate() + amount);
    return toIsoDate(next);
}

function startOfWeek(value: string): string {
    const date = parseIsoDate(value);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return toIsoDate(date);
}

function buildWeek(value: string): string[] {
    const weekStart = startOfWeek(value);
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function startOfMonth(value: string): string {
    const date = parseIsoDate(value);
    date.setDate(1);
    return toIsoDate(date);
}

function endOfWeek(value: string): string {
    const weekStart = startOfWeek(value);
    return addDays(weekStart, 6);
}

function endOfMonth(value: string): string {
    const date = parseIsoDate(value);
    date.setMonth(date.getMonth() + 1, 0);
    return toIsoDate(date);
}

function addMonths(value: string, amount: number): string {
    const current = parseIsoDate(value);
    const targetDay = current.getDate();
    const next = new Date(current.getFullYear(), current.getMonth() + amount, 1);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(targetDay, lastDay));
    return toIsoDate(next);
}

function buildMonth(value: string): string[] {
    const monthStart = startOfMonth(value);
    const monthEnd = endOfMonth(value);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);
    const totalDays = Math.round((parseIsoDate(gridEnd).getTime() - parseIsoDate(gridStart).getTime()) / 86400000) + 1;
    return Array.from({ length: totalDays }, (_, index) => addDays(gridStart, index));
}

function buildDayRange(startDate: string, endDate: string): string[] {
    const start = parseIsoDate(startDate);
    const end = parseIsoDate(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        return [];
    }

    const days: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        days.push(toIsoDate(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return days;
}

function formatMonthHeader(value: string): string {
    const parsed = parseIsoDate(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "numeric",
    }).format(parsed);
}

function formatWeekday(value: string): string {
    const parsed = parseIsoDate(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat("en-US", {
        weekday: "short",
    }).format(parsed);
}

function formatDayNumber(value: string): string {
    const parsed = parseIsoDate(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat("en-US", {
        day: "numeric",
    }).format(parsed);
}

// Full-day heading for the phone day view, e.g. "Monday 14 Jul".
function formatPhoneDayLabel(value: string): string {
    const parsed = parseIsoDate(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "short",
    }).format(parsed);
}

function getMajorityMonthLabel(days: string[], fallback: string): string {
    if (days.length === 0) {
        return formatMonthHeader(fallback);
    }

    const monthCounts = new Map<string, number>();
    for (const day of days) {
        const monthKey = day.slice(0, 7);
        monthCounts.set(monthKey, (monthCounts.get(monthKey) ?? 0) + 1);
    }

    const dominantMonth = [...monthCounts.entries()].sort((left, right) => {
        if (right[1] !== left[1]) return right[1] - left[1];
        if (left[0] === fallback.slice(0, 7)) return -1;
        if (right[0] === fallback.slice(0, 7)) return 1;
        return left[0].localeCompare(right[0]);
    })[0]?.[0];

    return formatMonthHeader(`${dominantMonth ?? fallback.slice(0, 7)}-01`);
}

function formatProjectDefaultTimeSummary(startTime: string | null | undefined, endTime: string | null | undefined): string {
    const start = parseTimeInput(startTime ?? "");
    const end = parseTimeInput(endTime ?? "");

    if (start && end) return `${start} to ${end}`;
    if (start) return `Starts at ${start}`;
    if (end) return `Ends at ${end}`;
    return "No default time set";
}

function getVisibleDateRange(value: string, view: PlanningView): { startDate: string; endDate: string } {
    const days = view === "week" ? buildWeek(value) : buildMonth(value);
    return {
        startDate: days[0] ?? value,
        endDate: days[days.length - 1] ?? value,
    };
}

function renderProjectSummaryCard(
    title: string,
    projectDraft: PlanningProjectSaveDTO,
    selectedClient: PlanningClientCompanyDTO | null
) {
    const summaryRows = [
        { label: "Project", value: (projectDraft.name ?? "").trim() || "Unnamed project" },
        {
            label: "Project window",
            value: `${projectDraft.startDate || "dd/mm/yyyy"} to ${projectDraft.endDate || "dd/mm/yyyy"}`,
        },
        {
            label: "Default time",
            value: formatProjectDefaultTimeSummary(projectDraft.defaultStartTime, projectDraft.defaultEndTime),
        },
        {
            label: "Time zone",
            value: formatTimeZoneLabel(projectDraft.projectTimezone || getBrowserTimeZone()),
        },
        {
            label: "Client",
            value: selectedClient?.name?.trim() || "No client/company selected",
        },
        {
            label: "Client line",
            value: selectedClient?.companyLine?.trim() || "No client line added",
        },
        {
            label: "Internal note",
            value: projectDraft.internalDescription?.trim() || "No internal note added",
        },
    ];

    return (
        <div className="planningWizardSummary planningWizardSummary--stacked">
            <span className="planningWizardSummaryLabel">{title}</span>
            {summaryRows.map((row) => (
                <div key={row.label} className="planningWizardSummaryRow">
                    <span className="planningWizardSummaryItemLabel">{row.label}</span>
                    <span className="planningWizardSummaryValue">{row.value}</span>
                </div>
            ))}
        </div>
    );
}

function getProjectEntriesByDay(projects: PlanningProjectDTO[], rangeStartDate: string, rangeEndDate: string): Map<string, PlannerEntry[]> {
    const entriesByDay = new Map<string, PlannerEntry[]>();

    for (const project of projects) {
        const totalShiftCount = getProjectShiftRecords(project).length;
        const dateLabel = project.startDate === project.endDate
            ? formatDate(project.startDate)
            : `${formatDate(project.startDate)} to ${formatDate(project.endDate)}`;
        const projectTimeLabel = getProjectTimeLabel(project);
        const requiredCount = getProjectRequiredCount(project);
        const scheduledCount = getProjectScheduledCount(project);
        const checkedInCount = getProjectCheckedInCount(project);
        const projectSearchText = buildPlanningSearchText(getProjectSearchValues(project));
        const projectDays = buildDayRange(
            project.startDate > rangeStartDate ? project.startDate : rangeStartDate,
            project.endDate < rangeEndDate ? project.endDate : rangeEndDate
        );

        for (const day of projectDays) {
            const entries = entriesByDay.get(day) ?? [];

            entries.push({
                id: `${project.projectId}-${day}`,
                title: project.projectName,
                subtitle: totalShiftCount === 0
                    ? "No shifts planned"
                    : `${totalShiftCount} shift${totalShiftCount === 1 ? "" : "s"} planned`,
                timeLabel: `${dateLabel}${projectTimeLabel === "No time set" ? "" : ` - ${projectTimeLabel}`}`,
                clientLabel: getProjectClientName(project),
                ratioLabel: `(${requiredCount}/${scheduledCount}/${checkedInCount})`,
                completionLabel: getCompletionLabel(requiredCount, scheduledCount),
                staffingTone: getProjectStaffingTone(project),
                tone: "projects",
                href: `/management/planning/projects/${project.projectId}`,
                searchText: projectSearchText,
            });

            entriesByDay.set(day, entries);
        }
    }

    for (const [day, entries] of entriesByDay.entries()) {
        entriesByDay.set(day, [...entries].sort((left, right) => left.title.localeCompare(right.title)));
    }

    return entriesByDay;
}

function getShiftEntriesByDay(projects: PlanningProjectDTO[]): Map<string, PlannerEntry[]> {
    const entriesByDay = new Map<string, PlannerEntry[]>();

    for (const project of projects) {
        for (const day of project.days) {
            const entries = entriesByDay.get(day.day) ?? [];
            const sortedShifts = [...day.shifts].sort((left, right) => left.startTime.localeCompare(right.startTime));

            for (const shift of sortedShifts) {
                const shiftName = getShiftDisplayName(shift);
                const requiredCount = getShiftRequiredCount(shift);
                const scheduledCount = getShiftScheduledCount(shift);
                const checkedInCount = getShiftCheckedInCount(shift);

                entries.push({
                    id: `${day.day}-${shift.shiftId}`,
                    title: shiftName,
                    subtitle: project.projectName,
                    timeLabel: getShiftTimeLabel(shift),
                    clientLabel: getProjectClientName(project),
                    ratioLabel: `(${requiredCount}/${scheduledCount}/${checkedInCount})`,
                    completionLabel: getCompletionLabel(requiredCount, scheduledCount),
                    staffingTone: getShiftStaffingTone(shift),
                    tone: "shifts",
                    day: day.day,
                    projectId: project.projectId,
                    shiftId: shift.shiftId,
                    href: `/management/planning/projects/${project.projectId}?shift=${shift.shiftId}`,
                    searchText: buildPlanningSearchText([
                        project.projectName,
                        project.projectId,
                        project.clientCompanyName,
                        project.clientCompanyId,
                        shiftName,
                        shift.functionName,
                        ...getAllocationSearchValues(shift.allocations),
                    ]),
                });
            }

            entriesByDay.set(day.day, entries);
        }
    }

    for (const [day, entries] of entriesByDay.entries()) {
        entriesByDay.set(day, [...entries].sort((left, right) => left.title.localeCompare(right.title)));
    }

    return entriesByDay;
}

function ChevronLeftIcon() {
    return (
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M11.75 4.75L6.5 10l5.25 5.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
    );
}

function ChevronRightIcon() {
    return (
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M8.25 4.75L13.5 10l-5.25 5.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
    );
}

function SuccessCheckIcon() {
    return (
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <circle cx="10" cy="10" r="8" fill="currentColor" opacity="0.16" />
            <path d="M6.4 10.3l2.2 2.2 5-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
        </svg>
    );
}

function getUserDisplayName(user: UserResponseDTO): string {
    const parts = [user.firstNames, user.middleNamePrefix, user.lastName]
        .map((part) => (part ?? "").trim())
        .filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    const preferredName = (user.preferredName ?? "").trim();
    return preferredName || user.email;
}

type ShiftSelectionKey = {
    day: string;
    shiftId: string;
    projectId: string;
};

function toShiftKeyString(key: ShiftSelectionKey): string {
    return `${key.day}:${key.shiftId}:${key.projectId}`;
}

type PlanningPopoverMode = "menu" | "plan";

type PlanningPopoverPlacement = "bottom" | "top";

type PlanningPopoverState = {
    open: boolean;
    mode: PlanningPopoverMode;
    anchorId: string | null;
    placement: PlanningPopoverPlacement;
    top: number;
    left: number;
};

export default function AdminPlanningOverview() {
    const navigate = useNavigate();
    const today = useMemo(() => toIsoDate(new Date()), []);
    const browserTimeZone = useMemo(() => getBrowserTimeZone(), []);
    const [timeZoneOptions, setTimeZoneOptions] = useState<TimeZoneOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingClients, setLoadingClients] = useState(false);
    const [clientsLoaded, setClientsLoaded] = useState(false);
    const [savingProject, setSavingProject] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [clientError, setClientError] = useState<string | null>(null);
    const [projectSaveError, setProjectSaveError] = useState<string | null>(null);
    const [projectSaveSuccess, setProjectSaveSuccess] = useState<string | null>(null);
    const [projects, setProjects] = useState<PlanningProjectDTO[]>([]);
    const [clients, setClients] = useState<PlanningClientCompanyDTO[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(today);
    const [expandedDay, setExpandedDay] = useState<string>(today);
    const [planningView, setPlanningView] = useState<PlanningView>("week");
    const [planningLayoutMode, setPlanningLayoutMode] = useState<PlanningLayoutMode>("calendar");
    const [plannerMode, setPlannerMode] = useState<PlannerMode>("shifts");
    // Phone (<=600px) replaces the calendar with two modes: a single-day list
    // (swipe left/right to change day, week strip to jump) and the plain list.
    // There is no month view on phones.
    const isPhone = useIsPhone();
    const [phoneMode, setPhoneMode] = useState<"day" | "list">("day");
    const [phoneDay, setPhoneDay] = useState<string>(today);
    const phoneTouchRef = useRef<{ x: number; y: number } | null>(null);
    const [planningSearchQuery, setPlanningSearchQuery] = useState("");
    const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
    const [isViewSelectedOpen, setIsViewSelectedOpen] = useState(false);
    const [createProjectStep, setCreateProjectStep] = useState<ProjectCreateStep>("details");
    const [projectDraft, setProjectDraft] = useState<PlanningProjectSaveDTO>({
        name: "",
        startDate: formatDateInput(today),
        endDate: formatDateInput(today),
        projectTimezone: browserTimeZone,
        clientCompanyId: "",
        location: "",
        savedLocationId: null,
        internalDescription: "",
    });
    const visibleRange = useMemo(() => getVisibleDateRange(selectedDate, planningView), [planningView, selectedDate]);

    const [selectedShiftKeys, setSelectedShiftKeys] = useState<Set<string>>(() => new Set());
    const [popover, setPopover] = useState<PlanningPopoverState>({
        open: false,
        mode: "menu",
        anchorId: null,
        placement: "bottom",
        top: 0,
        left: 0,
    });
    const popoverRef = useRef<HTMLDivElement | null>(null);
    const [planningUsersLoading, setPlanningUsersLoading] = useState(false);
    const [planningUsersError, setPlanningUsersError] = useState<string | null>(null);
    const [planUserSearch, setPlanUserSearch] = useState("");
    const [selectedPlanUserIds, setSelectedPlanUserIds] = useState<Set<string>>(() => new Set());
    const [selectedPlanUsers, setSelectedPlanUsers] = useState<Record<string, UserResponseDTO>>({});
    const [planningUserResults, setPlanningUserResults] = useState<UserResponseDTO[]>([]);
    const [planningUserResultsLoaded, setPlanningUserResultsLoaded] = useState(false);
    const [planningActionBusy, setPlanningActionBusy] = useState(false);
    const [planningActionError, setPlanningActionError] = useState<string | null>(null);
    const [planningActionSuccess, setPlanningActionSuccess] = useState<string | null>(null);

    const selectedShiftKeyList = useMemo(() => [...selectedShiftKeys.values()], [selectedShiftKeys]);
    const selectedShiftMeta = useMemo(() => {
        const meta: ShiftSelectionKey[] = [];
        for (const keyString of selectedShiftKeyList) {
            const parts = keyString.split(":");
            if (parts.length !== 3) continue;
            const [day, shiftId, projectId] = parts;
            if (!day || !shiftId || !projectId) continue;
            meta.push({ day, shiftId, projectId });
        }
        return meta;
    }, [selectedShiftKeyList]);

    const selectedPlanningUsers = useMemo(() => {
        return [...selectedPlanUserIds.values()]
            .map((id) => selectedPlanUsers[id])
            .filter((user): user is UserResponseDTO => Boolean(user))
            .sort((left, right) => getUserDisplayName(left).localeCompare(getUserDisplayName(right)));
    }, [selectedPlanUserIds, selectedPlanUsers]);

    const visiblePlanningUsers = useMemo(() => {
        const results = planningUserResults;
        if (selectedPlanUserIds.size === 0) return results;
        return results.filter((user) => !selectedPlanUserIds.has(user.userId));
    }, [planningUserResults, selectedPlanUserIds]);

    const allocationsByShiftId = useMemo(() => {
        const map = new Map<string, Map<string, PlanningResourceAllocationDTO>>();
        for (const project of projects) {
            for (const day of project.days) {
                for (const shift of day.shifts) {
                    const byUser = map.get(shift.shiftId) ?? new Map<string, PlanningResourceAllocationDTO>();
                    for (const allocation of shift.allocations ?? []) {
                        if (!allocation?.userId) continue;
                        byUser.set(allocation.userId, allocation);
                    }
                    map.set(shift.shiftId, byUser);
                }
            }
        }
        return map;
    }, [projects]);

    const selectedShiftDetails = useMemo(() => {
        return selectedShiftMeta.map((meta) => {
            const project = projects.find((candidate) => candidate.projectId === meta.projectId) ?? null;
            const dayRecord = project?.days.find((d) => d.day === meta.day) ?? null;
            const shift = dayRecord?.shifts.find((s) => s.shiftId === meta.shiftId) ?? null;
            const title = shift ? getShiftDisplayName(shift) : "Shift";
            const timeLabel = shift ? getShiftTimeLabel(shift) : "";
            return {
                key: toShiftKeyString(meta),
                meta,
                projectName: project?.projectName ?? meta.projectId,
                title,
                timeLabel,
            };
        });
    }, [projects, selectedShiftMeta]);

    const loadPlanningOverview = useCallback(async (anchorDate = selectedDate, view = planningView) => {
        try {
            setLoading(true);
            setError(null);
            const range = getVisibleDateRange(anchorDate, view);
            const data = await UserServices.getPlanningOverview(undefined, undefined, {
                ...range,
                includeAllocationDetails: true,
            });
            setProjects(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load planning overview";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [planningView, selectedDate]);

    const loadPlanningClients = useCallback(async () => {
        if (clientsLoaded || loadingClients) return;

        try {
            setLoadingClients(true);
            setClientError(null);
            const data = await UserServices.getPlanningClients();
            setClients(data);
            setClientsLoaded(true);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load planning clients";
            setClientError(message);
        } finally {
            setLoadingClients(false);
        }
    }, [clientsLoaded, loadingClients]);

    const clearPlanningUserSearchState = useCallback(() => {
        setPlanningUsersError(null);
        setPlanningUsersLoading(false);
        setPlanningUserResults([]);
        setPlanningUserResultsLoaded(false);
    }, []);

    const loadTimeZoneOptions = useCallback(() => {
        setTimeZoneOptions((current) => current.length > 0 ? current : getTimeZoneOptions());
    }, []);

    useEffect(() => {
        void loadPlanningOverview();
    }, [loadPlanningOverview]);

    useEffect(() => {
        if (!projectSaveSuccess) return;
        const timeoutId = window.setTimeout(() => setProjectSaveSuccess(null), 3200);
        return () => window.clearTimeout(timeoutId);
    }, [projectSaveSuccess]);

    const projectEntriesByDay = useMemo(
        () => filterEntriesBySearchQuery(
            getProjectEntriesByDay(projects, visibleRange.startDate, visibleRange.endDate),
            planningSearchQuery
        ),
        [projects, planningSearchQuery, visibleRange.endDate, visibleRange.startDate]
    );
    const shiftEntriesByDay = useMemo(
        () => filterEntriesBySearchQuery(getShiftEntriesByDay(projects), planningSearchQuery),
        [projects, planningSearchQuery]
    );
    const weekDays = useMemo(() => buildWeek(selectedDate), [selectedDate]);
    const monthDays = useMemo(() => buildMonth(selectedDate), [selectedDate]);
    const activeMonthKey = selectedDate.slice(0, 7);
    const visibleMonthLabel = useMemo(
        () => (planningView === "week" ? getMajorityMonthLabel(weekDays, selectedDate) : formatMonthHeader(startOfMonth(selectedDate))),
        [planningView, selectedDate, weekDays]
    );

    const shiftVisibleRange = (direction: -1 | 1) => {
        if (planningView === "week") {
            setSelectedDate((current) => addDays(current, direction * 7));
            setExpandedDay((current) => current ? addDays(current, direction * 7) : current);
            return;
        }

        setSelectedDate((current) => addMonths(current, direction));
        setExpandedDay((current) => current ? addMonths(current, direction) : current);
    };

    // Phones always plan by week: the month view does not exist there.
    useEffect(() => {
        if (isPhone && planningView !== "week") setPlanningView("week");
    }, [isPhone, planningView]);

    // Keep the phone day inside the visible week when the week changes (via
    // the arrows or a boundary swipe): prefer today when it is visible.
    useEffect(() => {
        if (!isPhone || weekDays.length === 0 || weekDays.includes(phoneDay)) return;
        setPhoneDay(weekDays.includes(today) ? today : weekDays[0]);
    }, [isPhone, weekDays, phoneDay, today]);

    const goToPhoneDay = (direction: -1 | 1) => {
        const index = weekDays.indexOf(phoneDay);
        const nextIndex = index === -1 ? (direction === 1 ? 0 : weekDays.length - 1) : index + direction;
        if (nextIndex < 0 || nextIndex >= weekDays.length) {
            // Crossing the week boundary pages the visible week and lands on
            // the adjacent day, so swiping feels continuous across weeks.
            shiftVisibleRange(direction);
            setPhoneDay(addDays(phoneDay, direction));
            return;
        }
        setPhoneDay(weekDays[nextIndex]);
    };

    const handlePhoneTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
        const touch = event.touches[0];
        if (!touch) return;
        phoneTouchRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handlePhoneTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
        const start = phoneTouchRef.current;
        phoneTouchRef.current = null;
        if (!start) return;
        const touch = event.changedTouches[0];
        if (!touch) return;
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        // Require a clearly horizontal, deliberate swipe so vertical scrolling
        // through a long day never accidentally changes the day.
        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        goToPhoneDay(dx < 0 ? 1 : -1);
    };

    const resetCreateProjectForm = useCallback(() => {
        setCreateProjectStep("details");
        setProjectSaveError(null);
        setProjectSaveSuccess(null);
        setProjectDraft({
            name: "",
            startDate: formatDateInput(selectedDate),
            endDate: formatDateInput(selectedDate),
            projectTimezone: browserTimeZone,
            clientCompanyId: "",
            location: "",
            savedLocationId: null,
            internalDescription: "",
            defaultStartTime: "",
            defaultEndTime: "",
        });
    }, [browserTimeZone, selectedDate]);

    const parsedProjectStartDate = parseDisplayDate(projectDraft.startDate);
    const parsedProjectEndDate = parseDisplayDate(projectDraft.endDate);
    const selectedClient = useMemo(
        () => clients.find((client) => client.clientCompanyId === projectDraft.clientCompanyId) ?? null,
        [clients, projectDraft.clientCompanyId]
    );
    const normalizedProjectTimezone = projectDraft.projectTimezone?.trim() || "";
    const hasValidProjectTimezone = isSupportedTimeZone(normalizedProjectTimezone);

    const openCreateProjectModal = () => {
        resetCreateProjectForm();
        void loadPlanningClients();
        loadTimeZoneOptions();
        setIsCreateProjectOpen(true);
    };

    const closeCreateProjectModal = () => {
        if (savingProject) return;
        setIsCreateProjectOpen(false);
        resetCreateProjectForm();
    };

    const handleCreateProject = async (event: FormEvent) => {
        event.preventDefault();

        const defaultStartTime = parseTimeInput(projectDraft.defaultStartTime?.toString() ?? "");
        const defaultEndTime = parseTimeInput(projectDraft.defaultEndTime?.toString() ?? "");
        const startDate = parseDisplayDate(projectDraft.startDate);
        const endDate = parseDisplayDate(projectDraft.endDate);

        const payload: PlanningProjectSaveDTO = {
            name: projectDraft.name.trim(),
            startDate: startDate ?? "",
            endDate: endDate ?? "",
            projectTimezone: normalizedProjectTimezone,
            clientCompanyId: projectDraft.clientCompanyId?.trim() ? projectDraft.clientCompanyId : null,
            location: projectDraft.location?.trim() || null,
            savedLocationId: projectDraft.savedLocationId ?? null,
            internalDescription: projectDraft.internalDescription?.trim() || null,
            defaultStartTime,
            defaultEndTime,
        };

        if (!payload.name) {
            setProjectSaveError("Project name is required.");
            return;
        }

        if (!payload.startDate || !payload.endDate) {
            setProjectSaveError("Start and end date must use dd/mm/yyyy.");
            return;
        }

        if (payload.endDate < payload.startDate) {
            setProjectSaveError("End date cannot be before start date.");
            return;
        }

        if (!hasValidProjectTimezone) {
            setProjectSaveError("Project time zone must be a valid value like Europe/Amsterdam.");
            return;
        }

        if (projectDraft.defaultStartTime?.toString().trim() && !defaultStartTime) {
            setProjectSaveError("Default start time must be a valid 24-hour time, like 9:00 or 09:00.");
            return;
        }

        if (projectDraft.defaultEndTime?.toString().trim() && !defaultEndTime) {
            setProjectSaveError("Default end time must be a valid 24-hour time, like 9:00 or 09:00.");
            return;
        }

        try {
            setSavingProject(true);
            setProjectSaveError(null);
            setProjectSaveSuccess(null);
            await UserServices.createPlanningProject(payload);
            // A brand-new project has no shifts yet, so it never renders in the
            // "shifts" tab. Switch to the projects tab so the created project is
            // actually visible instead of appearing to vanish.
            setPlannerMode("projects");
            setSelectedDate(payload.startDate);
            setExpandedDay(payload.startDate);
            await loadPlanningOverview(payload.startDate, planningView);
            setIsCreateProjectOpen(false);
            resetCreateProjectForm();
            setProjectSaveSuccess("Project created.");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to create project";
            setProjectSaveError(message);
        } finally {
            setSavingProject(false);
        }
    };

    const canSubmitCreateProject = Boolean(projectDraft.name.trim())
        && Boolean(parsedProjectStartDate)
        && Boolean(parsedProjectEndDate)
        && hasValidProjectTimezone
        && (parsedProjectEndDate ?? "") >= (parsedProjectStartDate ?? "");

    const toggleShiftSelected = useCallback((keyString: string) => {
        setSelectedShiftKeys((current) => {
            const next = new Set(current);
            if (next.has(keyString)) next.delete(keyString);
            else next.add(keyString);
            return next;
        });
    }, []);

    const replaceSelectionWith = useCallback((keyString: string) => {
        setSelectedShiftKeys(() => new Set([keyString]));
    }, []);

    const togglePlanUserSelected = useCallback((user: UserResponseDTO) => {
        setSelectedPlanUserIds((current) => {
            const next = new Set(current);
            if (next.has(user.userId)) next.delete(user.userId);
            else next.add(user.userId);
            return next;
        });
        setSelectedPlanUsers((current) => {
            if (!user.userId) return current;
            return { ...current, [user.userId]: user };
        });
    }, []);

    const closePopover = useCallback(() => {
        setPopover((current) => (current.open ? { ...current, open: false, mode: "menu", anchorId: null } : current));
    }, []);

    const openPopoverForAnchor = useCallback((anchorId: string, mode: PlanningPopoverMode) => {
        const anchorEl = document.getElementById(anchorId);
        if (!anchorEl) return;
        const rect = anchorEl.getBoundingClientRect();

        const MENU_WIDTH = 260;
        const MENU_HEIGHT_ESTIMATE = 220;
        const padding = 10;
        const left = Math.min(Math.max(padding, rect.left), window.innerWidth - MENU_WIDTH - padding);
        const fitsBelow = rect.bottom + MENU_HEIGHT_ESTIMATE <= window.innerHeight - padding;
        const placement: PlanningPopoverPlacement = fitsBelow ? "bottom" : "top";
        const top = fitsBelow ? rect.bottom + 8 : rect.top - 8;

        setPopover({
            open: true,
            mode,
            anchorId,
            placement,
            top,
            left,
        });
    }, []);

    const openPlanningPanel = useCallback(() => {
        setPlanningActionError(null);
        setPlanningActionSuccess(null);
        setPopover((current) => (current.open ? { ...current, mode: "plan" } : current));
    }, []);

    const openViewSelected = useCallback(() => {
        setIsViewSelectedOpen(true);
        closePopover();
    }, [closePopover]);

    const openViewShiftDetails = useCallback((meta: ShiftSelectionKey) => {
        navigate(`/management/planning/projects/${meta.projectId}?shift=${meta.shiftId}`);
        closePopover();
    }, [closePopover, navigate]);

    const planSelectedPeople = useCallback(async () => {
        if (planningActionBusy) return;
        const shiftTargets = selectedShiftMeta;
        const userTargets = [...selectedPlanUserIds.values()];
        if (shiftTargets.length === 0 || userTargets.length === 0) return;

        try {
            setPlanningActionBusy(true);
            setPlanningActionError(null);
            setPlanningActionSuccess(null);

            let createdCount = 0;
            let updatedCount = 0;

            for (const shift of shiftTargets) {
                const existingByUser = allocationsByShiftId.get(shift.shiftId) ?? new Map<string, PlanningResourceAllocationDTO>();
                for (const userId of userTargets) {
                    const existing = existingByUser.get(userId);
                    if (existing?.scheduleEntryId) {
                        await UserServices.updatePlanningAssignment(existing.scheduleEntryId, { userId, status: "ASSIGNED" });
                        updatedCount += 1;
                        continue;
                    }

                    await UserServices.createPlanningAssignment(shift.shiftId, { userId, status: "ASSIGNED" });
                    createdCount += 1;
                }
            }

            await loadPlanningOverview();
            setPlanningActionSuccess(
                updatedCount > 0
                    ? `Planned ${createdCount} assignment${createdCount === 1 ? "" : "s"} (${updatedCount} updated).`
                    : `Planned ${createdCount} assignment${createdCount === 1 ? "" : "s"}.`
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to plan people";
            setPlanningActionError(message);
        } finally {
            setPlanningActionBusy(false);
        }
    }, [
        allocationsByShiftId,
        loadPlanningOverview,
        planningActionBusy,
        selectedPlanUserIds,
        selectedShiftMeta,
    ]);

    useEffect(() => {
        if (plannerMode !== "shifts") {
            setSelectedShiftKeys(new Set());
            closePopover();
        }
    }, [closePopover, plannerMode]);

    useEffect(() => {
        if (!popover.open) return;

        const handler = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            const pop = popoverRef.current;
            if (pop && pop.contains(target)) return;
            closePopover();
        };

        document.addEventListener("pointerdown", handler);
        return () => document.removeEventListener("pointerdown", handler);
    }, [closePopover, popover.open]);

    useEffect(() => {
        if (!popover.open || popover.mode !== "plan") return;
        clearPlanningUserSearchState();
        setPlanUserSearch("");
        setSelectedPlanUserIds(new Set());
        setSelectedPlanUsers({});
    }, [clearPlanningUserSearchState, popover.mode, popover.open]);

    useEffect(() => {
        if (!popover.open || popover.mode !== "plan") return;

        const query = planUserSearch.trim();
        if (!query) {
            clearPlanningUserSearchState();
            return;
        }

        const timeoutId = window.setTimeout(() => {
            void (async () => {
                try {
                    setPlanningUsersLoading(true);
                    setPlanningUsersError(null);
                    const results = await UserServices.searchUsers(query, 25);
                    setPlanningUserResults(
                        results
                            .filter((user) => user.status === "ACTIVE")
                            .slice()
                            .sort((left, right) => getUserDisplayName(left).localeCompare(getUserDisplayName(right)))
                    );
                    setPlanningUserResultsLoaded(true);
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : "Failed to search users";
                    setPlanningUsersError(message);
                    setPlanningUserResults([]);
                    setPlanningUserResultsLoaded(false);
                } finally {
                    setPlanningUsersLoading(false);
                }
            })();
        }, 220);

        return () => window.clearTimeout(timeoutId);
    }, [clearPlanningUserSearchState, planUserSearch, popover.mode, popover.open]);

    useEffect(() => {
        if (!popover.open || !popover.anchorId) return;

        const recompute = () => {
            const anchorEl = document.getElementById(popover.anchorId ?? "");
            if (!anchorEl) {
                closePopover();
                return;
            }
            const rect = anchorEl.getBoundingClientRect();
            const MENU_WIDTH = popover.mode === "plan" ? 420 : 260;
            const MENU_HEIGHT_ESTIMATE = popover.mode === "plan" ? 360 : 220;
            const padding = 10;
            const left = Math.min(Math.max(padding, rect.left), window.innerWidth - MENU_WIDTH - padding);
            const fitsBelow = rect.bottom + MENU_HEIGHT_ESTIMATE <= window.innerHeight - padding;
            const placement: PlanningPopoverPlacement = fitsBelow ? "bottom" : "top";
            const top = fitsBelow ? rect.bottom + 8 : rect.top - 8;
            setPopover((current) =>
                current.open && current.anchorId
                    ? { ...current, left, top, placement }
                    : current
            );
        };

        window.addEventListener("resize", recompute);
        window.addEventListener("scroll", recompute, true);
        return () => {
            window.removeEventListener("resize", recompute);
            window.removeEventListener("scroll", recompute, true);
        };
    }, [closePopover, popover.anchorId, popover.mode, popover.open]);

    const renderPlannerEntry = (day: string, entry: PlannerEntry) => {
        let shiftKeyString: string | null = null;
        let shiftAnchorId: string | null = null;

        if (plannerMode === "shifts" && entry.tone === "shifts" && entry.shiftId && entry.projectId && entry.day) {
            shiftKeyString = toShiftKeyString({ day: entry.day, shiftId: entry.shiftId, projectId: entry.projectId });
            shiftAnchorId = `planning-shift-entry-${entry.day}-${entry.shiftId}`;
        }
        const isShiftEntry = Boolean(shiftKeyString);
        const isSelected = shiftKeyString ? selectedShiftKeys.has(shiftKeyString) : false;

        return (
            <button
                type="button"
                key={`${day}-${entry.id}`}
                id={shiftAnchorId ?? undefined}
                className={[
                    "planningEntryCard",
                    "planningEntryCard--compact",
                    `planningEntryCard--${entry.tone}`,
                    `planningEntryCard--${entry.staffingTone}`,
                    entry.href ? "planningEntryCard--interactive" : "",
                    isSelected ? "planningEntryCard--selected" : "",
                ].filter(Boolean).join(" ")}
                onClick={(event) => {
                    if (!isShiftEntry || !shiftKeyString) {
                        if (entry.href) navigate(entry.href);
                        return;
                    }

                    if (event.shiftKey) {
                        const willClearSelection = selectedShiftKeys.has(shiftKeyString) && selectedShiftKeys.size === 1;
                        toggleShiftSelected(shiftKeyString);
                        if (willClearSelection) {
                            closePopover();
                            return;
                        }
                    } else {
                        replaceSelectionWith(shiftKeyString);
                    }

                    if (shiftAnchorId) {
                        openPopoverForAnchor(shiftAnchorId, "menu");
                    }
                }}
            >
            <div className="planningEntryHeaderBand">
                <div className="planningEntryHeaderText">
                    <div className="planningEntryTitle">{entry.title}</div>
                    {entry.subtitle ? (
                        <div className="planningEntrySubtitle">{entry.subtitle}</div>
                    ) : null}
                </div>
                <span
                    className="planningEntryRatio"
                    data-tooltip={getStaffingTooltipLabel()}
                    aria-label={getStaffingTooltipLabel()}
                    tabIndex={0}
                >
                    {entry.ratioLabel}
                </span>
            </div>
            <div className="planningEntryBodyRow">
                <span className="planningEntryMeta">{entry.timeLabel}</span>
                <span className="planningEntryCompletion">{entry.completionLabel}</span>
            </div>
            <div className="planningEntryFooter">
                <span className="planningEntryClientTag">{entry.clientLabel}</span>
            </div>
            </button>
        );
    };

    // Phone day mode: one day at a time — date on top, a week strip to jump
    // between days, arrows to change week, and swipe left/right for the
    // previous/next day.
    const renderPhoneDayView = () => {
        const dayEntries = plannerMode === "projects"
            ? projectEntriesByDay.get(phoneDay) ?? []
            : shiftEntriesByDay.get(phoneDay) ?? [];

        return (
            <div
                className="planningPhoneDay"
                onTouchStart={handlePhoneTouchStart}
                onTouchEnd={handlePhoneTouchEnd}
            >
                <div className="planningPhoneWeekNav">
                    <button
                        type="button"
                        className="planningIconButton"
                        onClick={() => shiftVisibleRange(-1)}
                        aria-label="Previous week"
                        disabled={loading}
                    >
                        <ChevronLeftIcon />
                    </button>
                    <span className="planningPhoneWeekLabel">{visibleMonthLabel}</span>
                    <button
                        type="button"
                        className="planningIconButton"
                        onClick={() => shiftVisibleRange(1)}
                        aria-label="Next week"
                        disabled={loading}
                    >
                        <ChevronRightIcon />
                    </button>
                </div>

                <div className="planningPhoneWeekStrip" aria-label="Days of the visible week">
                    {weekDays.map((day) => {
                        const count = (plannerMode === "projects"
                            ? projectEntriesByDay.get(day)
                            : shiftEntriesByDay.get(day)
                        )?.length ?? 0;
                        return (
                            <button
                                key={day}
                                type="button"
                                className={[
                                    "planningPhoneDayChip",
                                    day === phoneDay ? "planningPhoneDayChip--active" : "",
                                    day === today ? "planningPhoneDayChip--today" : "",
                                ].filter(Boolean).join(" ")}
                                onClick={() => setPhoneDay(day)}
                                aria-pressed={day === phoneDay}
                                aria-label={`${formatPhoneDayLabel(day)}${count > 0 ? `, ${count} ${plannerMode === "projects" ? "projects" : "shifts"}` : ""}`}
                            >
                                <span className="planningPhoneDayChipName">{formatWeekday(day)}</span>
                                <span className="planningPhoneDayChipNumber">{formatDayNumber(day)}</span>
                                <span
                                    className={`planningPhoneDayChipDot${count > 0 ? " planningPhoneDayChipDot--filled" : ""}`}
                                    aria-hidden="true"
                                />
                            </button>
                        );
                    })}
                </div>

                <section key={phoneDay} className="planningListDay planningPhoneDayPanel">
                    <div className="planningListDayHeader">
                        <div className="planningDayHeaderMain">
                            <span className="planningPhoneDayTitle">{formatPhoneDayLabel(phoneDay)}</span>
                            {phoneDay === today ? <span className="planningPhoneTodayPill">Today</span> : null}
                        </div>
                        <span className="planningDayCount">
                            {dayEntries.length > 0
                                ? `${dayEntries.length} ${plannerMode === "projects" ? "projects" : "shifts"}`
                                : ""}
                        </span>
                    </div>
                    <div className="planningListDayItems">
                        {dayEntries.length === 0 ? (
                            <div className="planningListDayEmpty">
                                {plannerMode === "projects" ? "No projects" : "No shifts"}
                            </div>
                        ) : (
                            dayEntries.map((entry) => renderPlannerEntry(phoneDay, entry))
                        )}
                    </div>
                </section>

                <p className="planningPhoneSwipeHint" aria-hidden="true">Swipe left or right to change day</p>
            </div>
        );
    };

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell planningOverviewShell">
                    <PrimaryNav />
                    <div className="pageShellContent planningOverviewPageContent">
                        <header className="pageHeader">
                            <PageBack to="/management" />
                            <h1 className="pageTitle">Planning Overview</h1>
                            <p className="pageSubtitle">Weekly or monthly view for projects and shifts.</p>
                        </header>

                        <div className="adminDashboardCard planningOverviewDashboardCard">
                            <Card
                                title={isPhone ? (
                                    <span className="planningTitleLabel">Planning</span>
                                ) : (
                                    <div className="planningTitleNavigation" aria-label={`${planningView === "week" ? "Week" : "Month"} navigation`}>
                                        <select
                                            className="planningViewSelect planningLayoutSelect"
                                            value={planningLayoutMode}
                                            onChange={(event) => setPlanningLayoutMode(event.target.value as PlanningLayoutMode)}
                                            aria-label="Planning layout"
                                            disabled={loading}
                                        >
                                            <option value="calendar">Calendar view</option>
                                            <option value="list">List view</option>
                                        </select>
                                        <button
                                            type="button"
                                            className="planningIconButton"
                                            onClick={() => shiftVisibleRange(-1)}
                                            aria-label={planningView === "week" ? "Previous week" : "Previous month"}
                                            disabled={loading}
                                        >
                                            <ChevronLeftIcon />
                                        </button>
                                        <span className="planningTitleLabel">{visibleMonthLabel}</span>
                                        <button
                                            type="button"
                                            className="planningIconButton"
                                            onClick={() => shiftVisibleRange(1)}
                                            aria-label={planningView === "week" ? "Next week" : "Next month"}
                                            disabled={loading}
                                        >
                                            <ChevronRightIcon />
                                        </button>
                                    </div>
                                )}
                                className="dashboardCardHeight planningOverviewCard"
                                right={isPhone ? undefined : (
                                    <div className="planningHeaderRow">
                                        <div className="planningHeaderDateActions">
                                            <select
                                                className="planningViewSelect"
                                                value={planningView}
                                                onChange={(event) => setPlanningView(event.target.value as PlanningView)}
                                                aria-label="Planning view"
                                                disabled={loading}
                                            >
                                                <option value="week">Weekly view</option>
                                                <option value="month">Monthly view</option>
                                            </select>
                                            <button
                                                type="button"
                                                className="buttonSecondary planningTodayButton"
                                                onClick={() => {
                                                    setSelectedDate(today);
                                                    setExpandedDay(today);
                                                }}
                                                disabled={loading}
                                            >
                                                Today
                                            </button>
                                        </div>

                                        <div className="planningCardHeaderActions">
                                            <div className="planningModeToggle" aria-label="Planning mode">
                                                <button
                                                    type="button"
                                                    className={[
                                                        "planningModeButton",
                                                        "planningModeToggleButton",
                                                        plannerMode === "shifts" ? "planningModeButton--active planningModeToggleButton--active" : "",
                                                    ].filter(Boolean).join(" ")}
                                                    onClick={() => setPlannerMode("shifts")}
                                                    disabled={loading}
                                                    aria-pressed={plannerMode === "shifts"}
                                                >
                                                    Shifts
                                                </button>
                                                <button
                                                    type="button"
                                                    className={[
                                                        "planningModeButton",
                                                        "planningModeToggleButton",
                                                        plannerMode === "projects" ? "planningModeButton--active planningModeToggleButton--active" : "",
                                                    ].filter(Boolean).join(" ")}
                                                    onClick={() => setPlannerMode("projects")}
                                                    disabled={loading}
                                                    aria-pressed={plannerMode === "projects"}
                                                >
                                                    Projects
                                                </button>
                                            </div>

                                            <input
                                                className="planningSearchInput"
                                                type="search"
                                                value={planningSearchQuery}
                                                onChange={(event) => setPlanningSearchQuery(event.target.value)}
                                                placeholder="Search user, client, project"
                                                aria-label="Search planning by user, client, or project"
                                                disabled={loading}
                                            />

                                            <button
                                                type="button"
                                                className="button"
                                                onClick={openCreateProjectModal}
                                                disabled={loading || savingProject}
                                            >
                                                Create project
                                            </button>
                                        </div>
                                    </div>
                                )}
                            >
                                {isPhone ? (
                                    <div className="planningPhoneToolbar">
                                        <div className="planningModeToggle planningPhoneToggle" aria-label="Planning display mode">
                                            <button
                                                type="button"
                                                className={[
                                                    "planningModeButton",
                                                    phoneMode === "day" ? "planningModeButton--active" : "",
                                                ].filter(Boolean).join(" ")}
                                                onClick={() => setPhoneMode("day")}
                                                aria-pressed={phoneMode === "day"}
                                                disabled={loading}
                                            >
                                                Day
                                            </button>
                                            <button
                                                type="button"
                                                className={[
                                                    "planningModeButton",
                                                    phoneMode === "list" ? "planningModeButton--active" : "",
                                                ].filter(Boolean).join(" ")}
                                                onClick={() => setPhoneMode("list")}
                                                aria-pressed={phoneMode === "list"}
                                                disabled={loading}
                                            >
                                                List
                                            </button>
                                        </div>

                                        <div className="planningModeToggle planningPhoneToggle" aria-label="Planning mode">
                                            <button
                                                type="button"
                                                className={[
                                                    "planningModeButton",
                                                    plannerMode === "shifts" ? "planningModeButton--active" : "",
                                                ].filter(Boolean).join(" ")}
                                                onClick={() => setPlannerMode("shifts")}
                                                aria-pressed={plannerMode === "shifts"}
                                                disabled={loading}
                                            >
                                                Shifts
                                            </button>
                                            <button
                                                type="button"
                                                className={[
                                                    "planningModeButton",
                                                    plannerMode === "projects" ? "planningModeButton--active" : "",
                                                ].filter(Boolean).join(" ")}
                                                onClick={() => setPlannerMode("projects")}
                                                aria-pressed={plannerMode === "projects"}
                                                disabled={loading}
                                            >
                                                Projects
                                            </button>
                                        </div>

                                        <input
                                            className="planningSearchInput planningPhoneSearch"
                                            type="search"
                                            value={planningSearchQuery}
                                            onChange={(event) => setPlanningSearchQuery(event.target.value)}
                                            placeholder="Search user, client, project"
                                            aria-label="Search planning by user, client, or project"
                                            disabled={loading}
                                        />

                                        <button
                                            type="button"
                                            className="button planningPhoneCreate"
                                            onClick={openCreateProjectModal}
                                            disabled={loading || savingProject}
                                        >
                                            Create project
                                        </button>
                                    </div>
                                ) : null}

                                {loading ? <div className="listEmpty">Loading planning...</div> : null}
                                {!loading && error ? <div className="listEmpty errorText">{error}</div> : null}

                                {!loading && !error && isPhone && phoneMode === "day" ? renderPhoneDayView() : null}

                                {!loading && !error && !(isPhone && phoneMode === "day") ? (
                                    (isPhone ? phoneMode === "list" : planningLayoutMode === "list") ? (
                                        <div className="planningListLayout">
                                            {(planningView === "week"
                                                ? weekDays
                                                : monthDays.filter((day) => day.startsWith(activeMonthKey))
                                            ).map((day) => {
                                                const dayEntries = plannerMode === "projects"
                                                    ? projectEntriesByDay.get(day) ?? []
                                                    : shiftEntriesByDay.get(day) ?? [];
                                                const isToday = day === today;

                                                return (
                                                    <section
                                                        key={day}
                                                        className={`planningListDay${isToday ? " planningListDay--today" : ""}`}
                                                    >
                                                        <div className="planningListDayHeader">
                                                            <div className="planningDayHeaderMain">
                                                                <span className="planningDayName">{formatWeekday(day)}</span>
                                                                <span className="planningDayNumber">{formatDayNumber(day)}</span>
                                                            </div>
                                                            <span className="planningDayCount">
                                                                {dayEntries.length > 0
                                                                    ? `${dayEntries.length} ${plannerMode === "projects" ? "projects" : "shifts"}`
                                                                    : ""}
                                                            </span>
                                                        </div>
                                                        <div className="planningListDayItems">
                                                            {dayEntries.length === 0 ? (
                                                                <div className="planningListDayEmpty">
                                                                    {plannerMode === "projects" ? "No projects" : "No shifts"}
                                                                </div>
                                                            ) : (
                                                                dayEntries.map((entry) => renderPlannerEntry(day, entry))
                                                            )}
                                                        </div>
                                                    </section>
                                                );
                                            })}
                                        </div>
                                    ) : planningView === "week" ? (
                                        <div className="planningWeekLayout">
                                            <div className="planningWeekGrid">
                                                {weekDays.map((day) => {
                                                    const dayEntries = plannerMode === "projects"
                                                        ? projectEntriesByDay.get(day) ?? []
                                                        : shiftEntriesByDay.get(day) ?? [];
                                                    const isSelected = day === expandedDay;
                                                    const isToday = day === today;
                                                    const visibleEntries = isSelected ? dayEntries : dayEntries.slice(0, 4);

                                                    return (
                                                        <section
                                                            key={day}
                                                            className={`planningDayColumn${isSelected ? " planningDayColumn--selected" : ""}${isToday ? " planningDayColumn--today" : ""}`}
                                                        >
                                                            <button
                                                                type="button"
                                                                className="planningDayHeader"
                                                                onClick={() => setExpandedDay(day)}
                                                            >
                                                                <div className="planningDayHeaderMain">
                                                                    <span className="planningDayName">{formatWeekday(day)}</span>
                                                                    <span className="planningDayNumber">{formatDayNumber(day)}</span>
                                                                </div>
                                                                <span className="planningDayCount">
                                                                    {dayEntries.length > 0
                                                                        ? `${dayEntries.length} ${plannerMode === "projects" ? "projects" : "shifts"}`
                                                                        : ""}
                                                                </span>
                                                            </button>

                                                            <div className="planningDayItems">
                                                                {visibleEntries.map((entry) => renderPlannerEntry(day, entry))}

                                                                {dayEntries.length > visibleEntries.length ? (
                                                                    <button
                                                                        type="button"
                                                                        className="planningMoreButton"
                                                                        onClick={() => setExpandedDay(day)}
                                                                    >
                                                                        +{dayEntries.length - visibleEntries.length} more
                                                                    </button>
                                                                ) : null}

                                                                {isSelected && dayEntries.length > 4 ? (
                                                                    <button
                                                                        type="button"
                                                                        className="planningMoreButton"
                                                                        onClick={() => setExpandedDay("")}
                                                                    >
                                                                        Collapse
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        </section>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="planningMonthLayout">
                                            <div className="planningMonthGrid">
                                                {monthDays.map((day) => {
                                                    const dayEntries = plannerMode === "projects"
                                                        ? projectEntriesByDay.get(day) ?? []
                                                        : shiftEntriesByDay.get(day) ?? [];
                                                    const isToday = day === today;
                                                    const isSelected = day === selectedDate;
                                                    const isOutsideMonth = !day.startsWith(activeMonthKey);

                                                    return (
                                                        <section
                                                            key={day}
                                                            className={[
                                                                "planningMonthDay",
                                                                isToday ? "planningMonthDay--today" : "",
                                                                isSelected ? "planningMonthDay--selected" : "",
                                                                isOutsideMonth ? "planningMonthDay--outside" : "",
                                                            ].filter(Boolean).join(" ")}
                                                        >
                                                            <button
                                                                type="button"
                                                                className="planningMonthDayHeader"
                                                                onClick={() => {
                                                                    setSelectedDate(day);
                                                                    setExpandedDay(day);
                                                                }}
                                                            >
                                                                <div className="planningDayHeaderMain">
                                                                    <span className="planningDayName">{formatWeekday(day)}</span>
                                                                    <span className="planningDayNumber">{formatDayNumber(day)}</span>
                                                                </div>
                                                                <span className="planningDayCount">
                                                                    {dayEntries.length > 0
                                                                        ? `${dayEntries.length} ${plannerMode === "projects" ? "projects" : "shifts"}`
                                                                        : ""}
                                                                </span>
                                                            </button>

                                                            <div className="planningMonthDayItems">
                                                                {dayEntries.map((entry) => renderPlannerEntry(day, entry))}
                                                            </div>
                                                        </section>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )
                                ) : null}
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
            {popover.open ? (
                <div
                    ref={popoverRef}
                    className={[
                        "planningShiftPopover",
                        popover.mode === "plan" ? "planningShiftPopover--plan" : "",
                        popover.placement === "top" ? "planningShiftPopover--top" : "planningShiftPopover--bottom",
                    ].filter(Boolean).join(" ")}
                    style={{ top: `${popover.top}px`, left: `${popover.left}px` }}
                    role="dialog"
                    aria-label="Shift actions"
                >
                    {popover.mode === "menu" ? (
                        <ShiftActionMenu
                            selectionCount={selectedShiftMeta.length}
                            onPlan={openPlanningPanel}
                            onViewDetails={() => openViewShiftDetails(selectedShiftMeta[0])}
                            onViewSelected={openViewSelected}
                        />
                    ) : (
                        <div className="planningShiftPopoverPlan" aria-label="Plan people panel">
                            <div className="planningShiftPopoverPlanHeader">
                                <button
                                    type="button"
                                    className="pageBack planningShiftPopoverBack"
                                    onClick={() => setPopover((current) => (current.open ? { ...current, mode: "menu" } : current))}
                                    aria-label="Back to shift actions"
                                >
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M15 18l-6-6 6-6" />
                                    </svg>
                                    <span>Back</span>
                                </button>
                            </div>

                            <input
                                className="planningShiftPopoverSearch"
                                type="search"
                                value={planUserSearch}
                                onChange={(event) => setPlanUserSearch(event.target.value)}
                                placeholder="Search people"
                                aria-label="Search people"
                                disabled={planningUsersLoading || planningActionBusy}
                            />

                            {planningUsersLoading ? <div className="planningShiftPopoverHint">Searching...</div> : null}
                            {!planningUsersLoading && planningUsersError ? (
                                <div className="planningShiftPopoverHint planningShiftPopoverHint--error">{planningUsersError}</div>
                            ) : null}

                            <div className="planningShiftPopoverPeople" data-has-query={Boolean(planUserSearch.trim())}>
                                    {selectedPlanningUsers.length > 0 ? (
                                        <div className="planningShiftPopoverSelected">
                                            {selectedPlanningUsers.map((user) => (
                                                <button
                                                    key={`selected-${user.userId}`}
                                                    type="button"
                                                    className="planningShiftPopoverSelectedPill"
                                                    onClick={() => togglePlanUserSelected(user)}
                                                    title="Remove from selection"
                                                >
                                                    <span className="planningShiftPopoverSelectedPillName">{getUserDisplayName(user)}</span>
                                                    <span className="planningShiftPopoverSelectedPillX" aria-hidden="true">
                                                        ×
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}

                                    {!planUserSearch.trim() ? (
                                        <div className="planningShiftPopoverHint">Type a name or email to search.</div>
                                    ) : null}
                                    {planUserSearch.trim() &&
                                    !planningUsersLoading &&
                                    !planningUsersError &&
                                    visiblePlanningUsers.length === 0 &&
                                    planningUserResultsLoaded ? (
                                        <div className="planningShiftPopoverHint">No matching people.</div>
                                    ) : planUserSearch.trim() && !planningUsersLoading && !planningUsersError ? (
                                        visiblePlanningUsers.map((user) => {
                                            const isChecked = selectedPlanUserIds.has(user.userId);
                                            return (
                                                <button
                                                    key={user.userId}
                                                    type="button"
                                                    className={[
                                                        "planningShiftPopoverPerson",
                                                        isChecked ? "planningShiftPopoverPerson--checked" : "",
                                                    ].filter(Boolean).join(" ")}
                                                    onClick={() => togglePlanUserSelected(user)}
                                                >
                                                    <span className="planningShiftPopoverPersonCheck" aria-hidden="true">
                                                        {isChecked ? "✓" : ""}
                                                    </span>
                                                    <span className="planningShiftPopoverPersonMain">
                                                        <span className="planningShiftPopoverPersonName">{getUserDisplayName(user)}</span>
                                                        <span className="planningShiftPopoverPersonMeta">
                                                            {[user.position?.trim(), user.email.trim()].filter(Boolean).join(" - ")}
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })
                                    ) : null}
                            </div>

                            {planningActionError ? (
                                <div className="planningShiftPopoverHint planningShiftPopoverHint--error">{planningActionError}</div>
                            ) : null}
                            {planningActionSuccess ? (
                                <div className="planningShiftPopoverHint planningShiftPopoverHint--success">{planningActionSuccess}</div>
                            ) : null}

                            <div className="planningShiftPopoverPlanActions">
                                <button
                                    type="button"
                                    className="button"
                                    disabled={planningActionBusy || selectedPlanUserIds.size === 0 || selectedShiftMeta.length === 0}
                                    onClick={() => void planSelectedPeople()}
                                >
                                    {planningActionBusy ? "Planning..." : `Plan selected (${selectedPlanUserIds.size})`}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : null}
            {projectSaveSuccess ? (
                <div className="planningCreateProjectToast" role="status" aria-live="polite">
                    <span className="planningCreateProjectToastIcon">
                        <SuccessCheckIcon />
                    </span>
                    <div className="planningCreateProjectToastBody">
                        <span className="planningCreateProjectToastTitle">Project created</span>
                        <span className="planningCreateProjectToastMessage">{projectSaveSuccess}</span>
                    </div>
                </div>
            ) : null}
            <Modal
                open={isCreateProjectOpen}
                onClose={closeCreateProjectModal}
                title="Create project"
                maxHeight={560}
                height={560}
                hideDefaultFooter
                closeOnEscape={false}
                closeOnOverlayClick={false}
            >
                <form className="roleWizard" onSubmit={(event) => void handleCreateProject(event)}>
                    <div className="roleWizardTabs" role="tablist" aria-label="Project setup steps">
                        <button
                            type="button"
                            className={`roleWizardTab ${createProjectStep === "details" ? "roleWizardTab--active" : ""}`}
                            onClick={() => setCreateProjectStep("details")}
                            role="tab"
                            aria-selected={createProjectStep === "details"}
                            disabled={savingProject}
                        >
                            Details
                        </button>
                        <button
                            type="button"
                            className={`roleWizardTab ${createProjectStep === "client" ? "roleWizardTab--active" : ""}`}
                            onClick={() => setCreateProjectStep("client")}
                            role="tab"
                            aria-selected={createProjectStep === "client"}
                            disabled={savingProject}
                        >
                            Client
                        </button>
                        <button
                            type="button"
                            className={`roleWizardTab ${createProjectStep === "notes" ? "roleWizardTab--active" : ""}`}
                            onClick={() => setCreateProjectStep("notes")}
                            role="tab"
                            aria-selected={createProjectStep === "notes"}
                            disabled={savingProject}
                        >
                            Notes
                        </button>
                    </div>

                    {createProjectStep === "details" ? (
                        <div className="roleWizardPanel">
                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Project name</span>
                                <input
                                    className="modal_input"
                                    value={projectDraft.name}
                                    onChange={(event) => {
                                        setProjectDraft((current) => ({ ...current, name: event.target.value }));
                                        if (projectSaveError) setProjectSaveError(null);
                                        if (projectSaveSuccess) setProjectSaveSuccess(null);
                                    }}
                                    placeholder="Example: Breda city run"
                                    disabled={savingProject}
                                />
                            </label>

                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Start date</span>
                                <input
                                    className="modal_input"
                                    type="text"
                                    value={projectDraft.startDate}
                                    onChange={(event) => {
                                        const startDate = normalizeDateInput(event.target.value);
                                        setProjectDraft((current) => ({
                                            ...current,
                                            startDate,
                                            endDate: (() => {
                                                const currentEndDate = parseDisplayDate(current.endDate);
                                                const nextStartDate = parseDisplayDate(startDate);
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

                            <label className="roleWizardField">
                                <span className="roleWizardLabel">End date</span>
                                <input
                                    className="modal_input"
                                    type="text"
                                    value={projectDraft.endDate}
                                    onChange={(event) => {
                                        setProjectDraft((current) => ({
                                            ...current,
                                            endDate: normalizeDateInput(event.target.value),
                                        }));
                                        if (projectSaveError) setProjectSaveError(null);
                                    }}
                                    inputMode="numeric"
                                    placeholder="dd/mm/yyyy"
                                    maxLength={10}
                                    disabled={savingProject}
                                />
                            </label>

                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Default start time</span>
                                <input
                                    className="modal_input"
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="HH:mm"
                                    value={projectDraft.defaultStartTime ?? ""}
                                    onChange={(event) => {
                                        setProjectDraft((current) => ({ ...current, defaultStartTime: event.target.value }));
                                        if (projectSaveError) setProjectSaveError(null);
                                    }}
                                    disabled={savingProject}
                                />
                            </label>

                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Default end time</span>
                                <input
                                    className="modal_input"
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="HH:mm"
                                    value={projectDraft.defaultEndTime ?? ""}
                                    onChange={(event) => {
                                        setProjectDraft((current) => ({ ...current, defaultEndTime: event.target.value }));
                                        if (projectSaveError) setProjectSaveError(null);
                                    }}
                                    disabled={savingProject}
                                />
                            </label>

                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Time zone</span>
                                <input
                                    className="modal_input"
                                    list={PROJECT_TIMEZONE_DATALIST_ID}
                                    value={projectDraft.projectTimezone ?? ""}
                                    onChange={(event) => {
                                        setProjectDraft((current) => ({ ...current, projectTimezone: event.target.value }));
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

                            {renderProjectSummaryCard("Current project setup", projectDraft, selectedClient)}
                        </div>
                    ) : null}

                    {createProjectStep === "client" ? (
                        <div className="roleWizardPanel">
                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Client/company</span>
                                <select
                                    className="modal_input"
                                    value={projectDraft.clientCompanyId ?? ""}
                                    onChange={(event) => {
                                        setProjectDraft((current) => ({ ...current, clientCompanyId: event.target.value }));
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

                            <PlanningLocationPicker
                                label="Location"
                                value={projectDraft.location ?? ""}
                                savedLocationId={projectDraft.savedLocationId ?? null}
                                clientCompanyId={projectDraft.clientCompanyId ?? null}
                                clientCompanyName={selectedClient?.name ?? null}
                                disabled={savingProject}
                                onChange={({ value, savedLocationId }) => {
                                    setProjectDraft((current) => ({ ...current, location: value, savedLocationId }));
                                    if (projectSaveError) setProjectSaveError(null);
                                }}
                                onDirty={() => {
                                    if (projectSaveSuccess) setProjectSaveSuccess(null);
                                }}
                            />

                            {loadingClients ? (
                                <div className="roleWizardMeta">Loading client companies...</div>
                            ) : null}
                            {!loadingClients && !clientError && clients.length === 0 ? (
                                <div className="roleWizardMeta">No saved client companies yet. You can still create the project without one.</div>
                            ) : null}

                            {renderProjectSummaryCard("Current project setup", projectDraft, selectedClient)}
                        </div>
                    ) : null}

                    {createProjectStep === "notes" ? (
                        <div className="roleWizardPanel">
                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Internal description</span>
                                <textarea
                                    className="modal_input planningWizardTextarea"
                                    value={projectDraft.internalDescription ?? ""}
                                    onChange={(event) => {
                                        setProjectDraft((current) => ({ ...current, internalDescription: event.target.value }));
                                        if (projectSaveError) setProjectSaveError(null);
                                    }}
                                    placeholder="Optional notes for planning"
                                    disabled={savingProject}
                                />
                            </label>

                            {renderProjectSummaryCard("Ready to create", projectDraft, selectedClient)}
                        </div>
                    ) : null}

                    {clientError ? (
                        <div className="roleWizardAlert roleWizardAlert--error">{clientError}</div>
                    ) : null}
                    {projectSaveError ? (
                        <div className="roleWizardAlert roleWizardAlert--error">{projectSaveError}</div>
                    ) : null}

                    <div className="roleWizardActions planningWizardActions">
                        <button
                            type="button"
                            className="buttonSecondary planningWizardCancel"
                            onClick={closeCreateProjectModal}
                            disabled={savingProject}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="roleWizardPrimary"
                            disabled={!canSubmitCreateProject || savingProject}
                        >
                            {savingProject ? "Creating..." : "Create project"}
                        </button>
                    </div>
                </form>
            </Modal>
            <Modal
                open={isViewSelectedOpen}
                onClose={() => setIsViewSelectedOpen(false)}
                title="Selected shifts"
                maxHeight={520}
                height={520}
            >
                <div className="planningShiftSelectedList">
                    {selectedShiftDetails.length === 0 ? (
                        <div className="listEmpty">No shifts selected.</div>
                    ) : (
                        selectedShiftDetails.map((row) => (
                            <div key={row.key} className="planningShiftSelectedRow">
                                <div className="planningShiftSelectedRowMain">
                                    <div className="planningShiftSelectedRowTitle">{row.title}</div>
                                    <div className="planningShiftSelectedRowMeta">{row.projectName}</div>
                                </div>
                                <div className="planningShiftSelectedRowMeta">{row.meta.day}</div>
                                <div className="planningShiftSelectedRowMeta">{row.timeLabel}</div>
                                <button type="button" className="buttonSecondary" onClick={() => openViewShiftDetails(row.meta)}>
                                    View
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </Modal>
        </>
    );
}
