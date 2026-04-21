import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import {
    UserServices,
    type PlanningClientCompanyDTO,
    type PlanningEventDTO,
    type PlanningEventSaveDTO,
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
    getEventCheckedInCount,
    getEventClientName,
    getEventLocation,
    getEventRequiredCount,
    getEventScheduledCount,
    getEventShiftRecords,
    getEventStaffingLabel,
    getEventStaffingTone,
    getEventTimeLabel,
    getShiftCheckedInCount,
    getShiftDisplayName,
    getShiftLocation,
    getShiftRequiredCount,
    getShiftScheduledCount,
    getShiftStaffingLabel,
    getShiftStaffingTone,
    getShiftTimeLabel,
} from "../utils/planningSummary";
import {
    formatTimeZoneLabel,
    getBrowserTimeZone,
    getTimeZoneOptions,
    isSupportedTimeZone,
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
    peopleNeeded: string;
};

type ScheduledFilter = "all" | "scheduled" | "accepted" | "declined";
const EVENT_TIMEZONE_DATALIST_ID = "planning-event-detail-timezones";

const shiftDateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const shiftWeekdayFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "long" });
const eventDateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

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

function formatEventTitleDateRange(startDate: string, endDate: string): string {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return formatDateRange(startDate, endDate);
    }

    if (startDate === endDate) {
        return eventDateFormatter.format(start);
    }

    return `${eventDateFormatter.format(start)} - ${eventDateFormatter.format(end)}`;
}

function getDefaultTime(value: string | null | undefined, fallback: string): string {
    return value?.slice(0, 5) || fallback;
}

function parseTimeInput(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) return null;
    return trimmed;
}

function formatDateFieldInput(value: string): string {
    return formatDateInput(value);
}

function parseDateInput(value: string): string | null {
    return parseDisplayDate(value);
}

function buildInitialShiftDraft(event: PlanningEventDTO): ShiftDraft {
    return {
        startDate: formatDateFieldInput(event.startDate),
        startTime: getDefaultTime(event.defaultStartTime, "09:00"),
        endDate: formatDateFieldInput(event.startDate),
        endTime: getDefaultTime(event.defaultEndTime, "17:00"),
        name: "",
        functionName: "",
        breakMinutes: "0",
        location: event.location?.trim() || "",
        peopleNeeded: "1",
    };
}

function buildEventDraft(event: PlanningEventDTO): PlanningEventSaveDTO {
    return {
        name: event.eventName,
        startDate: formatDateFieldInput(event.startDate),
        endDate: formatDateFieldInput(event.endDate),
        eventTimezone: event.eventTimezone ?? getBrowserTimeZone(),
        clientCompanyId: event.clientCompanyId ?? "",
        location: event.location ?? "",
        internalDescription: event.internalDescription ?? "",
        externalDescription: event.externalDescription ?? "",
        defaultStartTime: getDefaultTime(event.defaultStartTime, ""),
        defaultEndTime: getDefaultTime(event.defaultEndTime, ""),
        status: event.status ?? "",
    };
}

function buildShiftDraftFromRecord(day: string, shift: PlanningShiftDTO, event: PlanningEventDTO): ShiftDraft {
    const startDateTime = shift.startTime.includes("T") ? shift.startTime : `${day}T${shift.startTime}`;
    const endDateTime = shift.endTime.includes("T") ? shift.endTime : `${day}T${shift.endTime}`;
    const startDate = startDateTime.split("T")[0] || event.startDate;
    const endDate = endDateTime.split("T")[0] || startDate;

    return {
        startDate: formatDateFieldInput(startDate),
        startTime: getDefaultTime(startDateTime, "09:00"),
        endDate: formatDateFieldInput(endDate),
        endTime: getDefaultTime(endDateTime, "17:00"),
        name: shift.name?.trim() || "",
        functionName: shift.functionName,
        breakMinutes: String(shift.breakMinutes ?? 0),
        location: shift.location?.trim() || event.location?.trim() || "",
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

function formatEventRequirement(event: PlanningEventDTO): string {
    return `${getEventRequiredCount(event)}/${getEventScheduledCount(event)}/${getEventCheckedInCount(event)}`;
}

function getEventRequirementTitle(event: PlanningEventDTO): string {
    void event;
    return "Required / Scheduled / Checked in";
}

function formatEventHeaderTitle(event: PlanningEventDTO): string {
    return `${event.eventName}, ${formatEventTitleDateRange(event.startDate, event.endDate)}, ${getEventLocation(event)}, ${getEventClientName(event)}`;
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

function mergeShiftAllocations(event: PlanningEventDTO): PlanningEventDTO {
    return {
        ...event,
        days: event.days.map((day) => ({
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

export default function AdminPlanningEventDetail() {
    const navigate = useNavigate();
    const { eventId } = useParams<{ eventId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const browserTimeZone = useMemo(() => getBrowserTimeZone(), []);
    const timeZoneOptions = useMemo(() => getTimeZoneOptions(), []);
    const [event, setEvent] = useState<PlanningEventDTO | null>(null);
    const [clients, setClients] = useState<PlanningClientCompanyDTO[]>([]);
    const [users, setUsers] = useState<UserResponseDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingClients, setLoadingClients] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [clientError, setClientError] = useState<string | null>(null);
    const [isCreateShiftOpen, setIsCreateShiftOpen] = useState(false);
    const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
    const [isEditEventOpen, setIsEditEventOpen] = useState(false);
    const [savingEvent, setSavingEvent] = useState(false);
    const [savingShift, setSavingShift] = useState(false);
    const [deletingEvent, setDeletingEvent] = useState(false);
    const [deletingShift, setDeletingShift] = useState(false);
    const [eventSaveError, setEventSaveError] = useState<string | null>(null);
    const [editShiftError, setEditShiftError] = useState<string | null>(null);
    const [createShiftError, setCreateShiftError] = useState<string | null>(null);
    const [createdShiftId, setCreatedShiftId] = useState<string | null>(null);
    const [shiftSearchTerm, setShiftSearchTerm] = useState("");
    const [scheduledFilter, setScheduledFilter] = useState<ScheduledFilter>("all");
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
        peopleNeeded: "1",
    });
    const [eventDraft, setEventDraft] = useState<PlanningEventSaveDTO>({
        name: "",
        startDate: "",
        endDate: "",
        eventTimezone: browserTimeZone,
        clientCompanyId: "",
        location: "",
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

    const loadEvent = useCallback(async () => {
        if (!eventId) {
            setError("Missing event id.");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const [company, userList] = await Promise.all([UserServices.getMyCompany(), UserServices.getUsers()]);
            const data = await UserServices.getPlanningOverview(company.companyId, eventId);
            const selectedEvent = data.find((candidate) => candidate.eventId === eventId) ?? null;

            if (!selectedEvent) {
                setEvent(null);
                setUsers([]);
                setError("Event not found.");
                return;
            }

            setEvent(mergeShiftAllocations(selectedEvent));
            setUsers(userList.filter((user) => !user.companyId || user.companyId === company.companyId));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load event.";
            setError(message);
            setEvent(null);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        void loadEvent();
    }, [loadEvent]);

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

    useEffect(() => {
        void loadClients();
    }, [loadClients]);

    const shiftRecords = useMemo(() => (event ? getEventShiftRecords(event) : []), [event]);
    const validShiftIds = useMemo(() => new Set(shiftRecords.map((record) => record.shift.shiftId)), [shiftRecords]);
    const expandedShiftId = requestedShiftId && validShiftIds.has(requestedShiftId) ? requestedShiftId : null;
    const eventStatusLabel = event?.finalized ? "Finalized" : (event?.status?.trim() || "Draft");
    const eventStaffingTone = event ? getEventStaffingTone(event) : "empty";
    const selectedClient = useMemo(
        () => clients.find((client) => client.clientCompanyId === (event?.clientCompanyId ?? "")) ?? null,
        [clients, event?.clientCompanyId]
    );
    const selectedDraftClient = useMemo(
        () => clients.find((client) => client.clientCompanyId === (eventDraft.clientCompanyId ?? "")) ?? null,
        [clients, eventDraft.clientCompanyId]
    );
    const normalizedEventTimezone = eventDraft.eventTimezone?.trim() || "";
    const hasValidEventTimezone = isSupportedTimeZone(normalizedEventTimezone);
    const usersById = useMemo(() => Object.fromEntries(users.map((user) => [user.userId, user] as const)), [users]);
    const expandedShiftRecord = useMemo(
        () => shiftRecords.find((record) => record.shift.shiftId === expandedShiftId) ?? null,
        [expandedShiftId, shiftRecords]
    );
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
    const filteredScheduledAllocations = useMemo(
        () => scheduledAllocations.filter((allocation) => matchesScheduledFilter(allocation, scheduledFilter)),
        [scheduledAllocations, scheduledFilter]
    );
    const availableUsers = useMemo(() => {
        if (!expandedShiftRecord) return [];
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
    }, [expandedShiftRecord, shiftSearchTerm, users]);
    const visibleAvatarUserIds = useMemo(() => {
        const ids = new Set<string>();
        scheduledAllocations.forEach((allocation) => ids.add(allocation.userId));
        availableUsers.forEach((user) => ids.add(user.userId));
        return [...ids];
    }, [availableUsers, scheduledAllocations]);
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
        if (!event || isCreateShiftOpen) return;
        setShiftDraft(buildInitialShiftDraft(event));
    }, [event, isCreateShiftOpen]);

    useEffect(() => {
        if (!event || !editingShiftRecord) return;
        setEditShiftDraft(buildShiftDraftFromRecord(editingShiftRecord.day, editingShiftRecord.shift, event));
    }, [editingShiftRecord, event]);

    useEffect(() => {
        if (!event || isEditEventOpen) return;
        setEventDraft(buildEventDraft(event));
    }, [event, isEditEventOpen]);

    const toggleShift = (shiftId: string) => {
        const nextParams = new URLSearchParams(searchParams);
        if (expandedShiftId === shiftId) nextParams.delete("shift");
        else nextParams.set("shift", shiftId);
        setSearchParams(nextParams, { replace: true });
    };

    const openCreateShiftModal = () => {
        if (!event || event.finalized) return;
        setShiftDraft(buildInitialShiftDraft(event));
        setCreateShiftError(null);
        setIsCreateShiftOpen(true);
    };

    const closeCreateShiftModal = () => {
        if (savingShift) return;
        setIsCreateShiftOpen(false);
        setCreateShiftError(null);
        if (event) setShiftDraft(buildInitialShiftDraft(event));
    };

    const openEditShiftModal = (shiftId: string) => {
        if (!event || event.finalized) return;
        const record = shiftRecords.find((candidate) => candidate.shift.shiftId === shiftId);
        if (!record) return;
        setEditingShiftId(shiftId);
        setEditShiftDraft(buildShiftDraftFromRecord(record.day, record.shift, event));
        setDeletingShift(false);
        setEditShiftError(null);
    };

    const closeEditShiftModal = () => {
        if (savingShift || deletingShift) return;
        setEditingShiftId(null);
        setDeletingShift(false);
        setEditShiftError(null);
        if (event) setEditShiftDraft(buildInitialShiftDraft(event));
    };

    const openEditEventModal = () => {
        if (!event || event.finalized) return;
        setEventDraft(buildEventDraft(event));
        setDeletingEvent(false);
        setEventSaveError(null);
        setIsEditEventOpen(true);
    };

    const closeEditEventModal = () => {
        if (savingEvent || deletingEvent) return;
        setIsEditEventOpen(false);
        setDeletingEvent(false);
        setEventSaveError(null);
        if (event) setEventDraft(buildEventDraft(event));
    };

    const handleUpdateEvent = async (submitEvent: FormEvent) => {
        submitEvent.preventDefault();
        if (!event) return setEventSaveError("Event not found.");

        const defaultStartTime = parseTimeInput(eventDraft.defaultStartTime?.toString() ?? "");
        const defaultEndTime = parseTimeInput(eventDraft.defaultEndTime?.toString() ?? "");
        const startDate = parseDateInput(eventDraft.startDate || "");
        const endDate = parseDateInput(eventDraft.endDate || "");

        const payload: PlanningEventSaveDTO = {
            name: eventDraft.name?.trim() || "",
            startDate: startDate || "",
            endDate: endDate || "",
            eventTimezone: normalizedEventTimezone,
            clientCompanyId: eventDraft.clientCompanyId?.toString().trim() ? eventDraft.clientCompanyId : null,
            location: eventDraft.location?.toString().trim() || null,
            internalDescription: eventDraft.internalDescription?.toString().trim() || null,
            externalDescription: eventDraft.externalDescription?.toString().trim() || null,
            defaultStartTime,
            defaultEndTime,
            status: eventDraft.status?.toString().trim() || null,
        };

        if (!payload.name) {
            return setEventSaveError("Event name is required.");
        }

        if (!payload.startDate || !payload.endDate) {
            return setEventSaveError("Start and end date must use dd/mm/yyyy.");
        }

        if (payload.endDate < payload.startDate) {
            return setEventSaveError("End date cannot be before start date.");
        }

        if (!hasValidEventTimezone) {
            return setEventSaveError("Event time zone must be a valid value like Europe/Amsterdam.");
        }

        if (eventDraft.defaultStartTime?.toString().trim() && !defaultStartTime) {
            return setEventSaveError("Default start time must use 24-hour format: HH:mm.");
        }

        if (eventDraft.defaultEndTime?.toString().trim() && !defaultEndTime) {
            return setEventSaveError("Default end time must use 24-hour format: HH:mm.");
        }

        try {
            setSavingEvent(true);
            setEventSaveError(null);
            await UserServices.updatePlanningEvent(event.eventId, payload);
            setIsEditEventOpen(false);
            await loadEvent();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to update event.";
            setEventSaveError(message);
        } finally {
            setSavingEvent(false);
        }
    };

    const handleDeleteEvent = async () => {
        if (!event) {
            setEventSaveError("Event not found.");
            return;
        }

        const confirmed = window.confirm(
            `Delete event "${event.eventName}"? This will also delete its ${shiftRecords.length} shift${shiftRecords.length === 1 ? "" : "s"}.`
        );
        if (!confirmed) return;

        try {
            setDeletingEvent(true);
            setEventSaveError(null);
            await UserServices.deletePlanningEvent(event.eventId);
            setIsEditEventOpen(false);
            navigate("/admin/planning", { replace: true });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to delete event.";
            setEventSaveError(message);
        } finally {
            setDeletingEvent(false);
        }
    };

    const handleCreateShift = async (submitEvent: FormEvent) => {
        submitEvent.preventDefault();
        if (!event) return setCreateShiftError("Event not found.");
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
        if (shiftStartDate < event.startDate || shiftEndDate > event.endDate) {
            return setCreateShiftError("Shift must stay within the event date range.");
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
            const response = await UserServices.createPlanningShift(event.eventId, {
                startTime: shiftStartDateTime,
                endTime: shiftEndDateTime,
                name: shiftDraft.name.trim() || null,
                functionName: shiftDraft.functionName.trim(),
                breakMinutes,
                location: shiftDraft.location.trim() || null,
                peopleNeeded,
            });
            setIsCreateShiftOpen(false);
            setCreatedShiftId(response.shiftId);
            await loadEvent();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to create shift.";
            setCreateShiftError(message);
        } finally {
            setSavingShift(false);
        }
    };

    const handleUpdateShift = async (submitEvent: FormEvent) => {
        submitEvent.preventDefault();
        if (!event || !editingShiftId) return setEditShiftError("Shift not found.");
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
        if (shiftStartDate < event.startDate || shiftEndDate > event.endDate) {
            return setEditShiftError("Shift must stay within the event date range.");
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
                peopleNeeded,
            });
            setEditingShiftId(null);
            await loadEvent();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to update shift.";
            setEditShiftError(message);
        } finally {
            setSavingShift(false);
        }
    };

    const handleDeleteShift = async () => {
        if (!event || !editingShiftId || !editingShiftRecord) {
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

            await loadEvent();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to delete shift.";
            setEditShiftError(message);
        } finally {
            setDeletingShift(false);
        }
    };

    const handleScheduleUser = useCallback(async (shiftId: string, userId: string) => {
        if (!event || event.finalized) return;
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
            await loadEvent();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to schedule employee.";
            setAssignmentError(message);
        } finally {
            setPendingActionKey(null);
        }
    }, [event, loadEvent, shiftRecords]);

    const handleInviteAgain = useCallback(async (scheduleEntryId: string, userId: string) => {
        if (!event || event.finalized) return;
        try {
            setPendingActionKey(`reinvite:${scheduleEntryId}`);
            setAssignmentError(null);
            await UserServices.updatePlanningAssignment(scheduleEntryId, { userId, status: "ASSIGNED" });
            await loadEvent();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to invite employee again.";
            setAssignmentError(message);
        } finally {
            setPendingActionKey(null);
        }
    }, [event, loadEvent]);

    const handleUnscheduleUser = useCallback(async (scheduleEntryId: string) => {
        if (!event || event.finalized) return;
        try {
            setPendingActionKey(`remove:${scheduleEntryId}`);
            setAssignmentError(null);
            await UserServices.deletePlanningAssignment(scheduleEntryId);
            await loadEvent();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to remove employee from shift.";
            setAssignmentError(message);
        } finally {
            setPendingActionKey(null);
        }
    }, [event, loadEvent]);

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <div className="planningDetailBreadcrumbs">
                            <PageBack label="Back to planning" to="/admin/planning" />
                        </div>

                        <header className="pageHeader">
                            <h1 className="pageTitle">Event</h1>
                            <p className="pageSubtitle">{event?.eventName ?? "Planning event details"}</p>
                        </header>

                        <div className="adminDashboardCard">
                            {loading ? <div className="planningDetailEmpty">Loading event...</div> : null}
                            {!loading && error ? <div className="planningDetailEmpty planningDetailEmpty--error">{error}</div> : null}

                            {!loading && !error && event ? (
                                <Card
                                    title={
                                        <span className="planningDetailEventTitle">
                                            {formatEventHeaderTitle(event)}
                                        </span>
                                    }
                                    className={[
                                        "planningDetailCard",
                                        "planningDetailEventCard",
                                        `planningDetailEventCard--${eventStaffingTone}`,
                                    ].join(" ")}
                                    right={
                                        <span
                                            className={[
                                                "planningDetailShiftRequirement",
                                                "planningDetailShiftRequirement--summary",
                                            ].join(" ")}
                                            data-tooltip={getEventRequirementTitle(event)}
                                            aria-label={getEventRequirementTitle(event)}
                                            tabIndex={0}
                                        >
                                            {formatEventRequirement(event)}
                                        </span>
                                    }
                                >
                                    <div className="planningDetailSplitLayout">
                                        <section className="planningDetailSplitMain">
                                            <div className="planningDetailPanelHeader">
                                                <div>
                                                    <h3 className="planningDetailPanelTitle">Shifts</h3>
                                                    <p className="planningDetailPanelSubtitle">
                                                        {shiftRecords.length === 0
                                                            ? "No shifts created for this event yet."
                                                            : `${shiftRecords.length} shift${shiftRecords.length === 1 ? "" : "s"} planned for this event.`}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="planningDetailPrimaryButton planningDetailHeaderAction"
                                                    onClick={openCreateShiftModal}
                                                    disabled={Boolean(event.finalized)}
                                                >
                                                    Create shift
                                                </button>
                                            </div>

                                            {shiftRecords.length === 0 ? (
                                                <div className="planningDetailEmpty planningDetailEmpty--inset">
                                                    No shifts created for this event yet.
                                                </div>
                                            ) : (
                                                <div className="planningDetailShiftList planningDetailShiftList--main">
                                                    {shiftRecords.map((record) => {
                                                        const isExpanded = expandedShiftId === record.shift.shiftId;
                                                        const shiftDetailId = `planning-shift-panel-${record.shift.shiftId}`;
                                                        const recordAvailableUsers = isExpanded ? availableUsers : [];
                                                        const shiftStaffingTone = getShiftStaffingTone(record.shift);

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
                                                                <div className="planningDetailShiftHeader">
                                                                    <button
                                                                        type="button"
                                                                        className="planningDetailShiftToggle"
                                                                        onClick={() => toggleShift(record.shift.shiftId)}
                                                                        aria-expanded={isExpanded}
                                                                        aria-controls={shiftDetailId}
                                                                    >
                                                                        <div className="planningDetailShiftSummaryLine">
                                                                            {formatShiftSummaryLine(record.day, record.shift)}
                                                                        </div>
                                                                    </button>
                                                                    <div className="planningDetailShiftHeaderAside">
                                                                        <button
                                                                            type="button"
                                                                            className="planningDetailIconButton planningDetailIconButton--header"
                                                                            onClick={() => openEditShiftModal(record.shift.shiftId)}
                                                                            disabled={Boolean(event.finalized)}
                                                                            aria-label={`Edit ${getShiftDisplayName(record.shift)}`}
                                                                            title="Edit shift"
                                                                        >
                                                                            <PencilIcon />
                                                                        </button>
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
                                                                                <span className="planningDetailMiniValue">{getShiftLocation(event, record.shift)}</span>
                                                                            </div>
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
                                                                                                                    disabled={Boolean(pendingActionKey) || Boolean(event.finalized)}
                                                                                                                >
                                                                                                                    {pendingActionKey === inviteAgainActionKey ? "Inviting..." : "Invite again"}
                                                                                                                </button>
                                                                                                            ) : (
                                                                                                                <button
                                                                                                                    type="button"
                                                                                                                    className="planningDetailSecondaryButton"
                                                                                                                    onClick={() => void handleUnscheduleUser(allocation.scheduleEntryId)}
                                                                                                                    disabled={Boolean(pendingActionKey) || Boolean(event.finalized)}
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
                                                                                        Available people ({recordAvailableUsers.length})
                                                                                    </h4>
                                                                                    <input
                                                                                        className="planningDetailSearchInput"
                                                                                        type="search"
                                                                                        placeholder="Search active people"
                                                                                        value={shiftSearchTerm}
                                                                                        onChange={(inputEvent) => setShiftSearchTerm(inputEvent.target.value)}
                                                                                        disabled={Boolean(pendingActionKey) || Boolean(event.finalized)}
                                                                                    />
                                                                                </div>

                                                                                {recordAvailableUsers.length === 0 ? (
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
                                                                                                            disabled={Boolean(pendingActionKey) || Boolean(event.finalized)}
                                                                                                        >
                                                                                                            {pendingActionKey === scheduleActionKey ? "Scheduling..." : "Schedule"}
                                                                                                        </button>
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        })}
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

                                        <aside className="planningDetailSplitSide">
                                            <div className="planningDetailPanelHeader planningDetailPanelHeader--side">
                                                <div>
                                                    <h3 className="planningDetailPanelTitle">Event details</h3>
                                                    <p className="planningDetailPanelSubtitle">Client, timing and staffing summary.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="planningDetailIconButton planningDetailIconButton--side planningDetailSideAction"
                                                    onClick={openEditEventModal}
                                                    disabled={Boolean(event.finalized)}
                                                    aria-label="Edit event details"
                                                    title="Edit event details"
                                                >
                                                    <PencilIcon />
                                                </button>
                                            </div>

                                            <div className="planningDetailRows">
                                                <div className="planningDetailRow"><span className="planningDetailLabel">Client</span><span className="planningDetailValue">{getEventClientName(event)}</span></div>
                                                <div className="planningDetailRow"><span className="planningDetailLabel">Client line</span><span className="planningDetailValue">{selectedClient?.companyLine?.trim() || "No client line"}</span></div>
                                                <div className="planningDetailRow"><span className="planningDetailLabel">Location</span><span className="planningDetailValue">{getEventLocation(event)}</span></div>
                                                <div className="planningDetailRow"><span className="planningDetailLabel">Dates</span><span className="planningDetailValue">{formatDateRange(event.startDate, event.endDate)}</span></div>
                                                <div className="planningDetailRow"><span className="planningDetailLabel">Time</span><span className="planningDetailValue">{getEventTimeLabel(event)}</span></div>
                                                <div className="planningDetailRow"><span className="planningDetailLabel">Time zone</span><span className="planningDetailValue">{formatTimeZoneLabel(event.eventTimezone || browserTimeZone)}</span></div>
                                                <div className="planningDetailRow"><span className="planningDetailLabel">Staffing</span><span className="planningDetailValue">{getEventStaffingLabel(event)}</span></div>
                                                <div className="planningDetailRow"><span className="planningDetailLabel">Status</span><span className="planningDetailValue">{eventStatusLabel}</span></div>
                                                <div className="planningDetailRow">
                                                    <span className="planningDetailLabel">Notes</span>
                                                    <span className="planningDetailValue">
                                                        {event.internalDescription?.trim() || event.externalDescription?.trim() || "No notes added"}
                                                    </span>
                                                </div>
                                            </div>
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
                        <span className="planningWizardSummaryLabel">Event window</span>
                        <span className="planningWizardSummaryValue">
                            {event ? formatDateRange(event.startDate, event.endDate) : "Event dates unavailable"}
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
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Job function</span>
                            <input
                                className="modal_input"
                                value={shiftDraft.functionName}
                                onChange={(inputEvent) => {
                                    setShiftDraft((current) => ({ ...current, functionName: inputEvent.target.value }));
                                    if (createShiftError) setCreateShiftError(null);
                                }}
                                placeholder="Bar staff"
                                disabled={savingShift}
                            />
                        </label>
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

                    <label className="planningDetailModalField">
                        <span className="planningDetailModalLabel">Location</span>
                        <input
                            className="modal_input"
                            value={shiftDraft.location}
                            onChange={(inputEvent) => setShiftDraft((current) => ({ ...current, location: inputEvent.target.value }))}
                            placeholder="Optional"
                            disabled={savingShift}
                        />
                    </label>

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
                        <span className="planningWizardSummaryLabel">Event window</span>
                        <span className="planningWizardSummaryValue">
                            {event ? formatDateRange(event.startDate, event.endDate) : "Event dates unavailable"}
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
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Job function</span>
                            <input
                                className="modal_input"
                                value={editShiftDraft.functionName}
                                onChange={(inputEvent) => {
                                    setEditShiftDraft((current) => ({ ...current, functionName: inputEvent.target.value }));
                                    if (editShiftError) setEditShiftError(null);
                                }}
                                placeholder="Bar staff"
                                disabled={savingShift}
                            />
                        </label>
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

                    <label className="planningDetailModalField">
                        <span className="planningDetailModalLabel">Location</span>
                        <input
                            className="modal_input"
                            value={editShiftDraft.location}
                            onChange={(inputEvent) => setEditShiftDraft((current) => ({ ...current, location: inputEvent.target.value }))}
                            placeholder="Optional"
                            disabled={savingShift}
                        />
                    </label>

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
                open={isEditEventOpen}
                onClose={closeEditEventModal}
                title="Edit event details"
                hideDefaultFooter
                maxHeight={720}
                height={720}
                closeOnEscape={false}
                closeOnOverlayClick={false}
            >
                <form className="planningDetailModalForm" onSubmit={(submitEvent) => void handleUpdateEvent(submitEvent)}>
                    <div className="planningDetailModalGrid">
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Event name</span>
                            <input
                                className="modal_input"
                                value={eventDraft.name ?? ""}
                                onChange={(inputEvent) => {
                                    setEventDraft((current) => ({ ...current, name: inputEvent.target.value }));
                                    if (eventSaveError) setEventSaveError(null);
                                }}
                                placeholder="Example: Breda city run"
                                disabled={savingEvent}
                            />
                        </label>
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Client/company</span>
                            <select
                                className="modal_input"
                                value={eventDraft.clientCompanyId ?? ""}
                                onChange={(inputEvent) => {
                                    setEventDraft((current) => ({ ...current, clientCompanyId: inputEvent.target.value }));
                                    if (eventSaveError) setEventSaveError(null);
                                }}
                                disabled={savingEvent || loadingClients}
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
                                value={eventDraft.startDate ?? ""}
                                onChange={(inputEvent) => {
                                    const startDate = normalizeDateInput(inputEvent.target.value);
                                    setEventDraft((current) => ({
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
                                    if (eventSaveError) setEventSaveError(null);
                                }}
                                inputMode="numeric"
                                placeholder="dd/mm/yyyy"
                                maxLength={10}
                                disabled={savingEvent}
                            />
                        </label>
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">End date</span>
                            <input
                                className="modal_input"
                                type="text"
                                value={eventDraft.endDate ?? ""}
                                onChange={(inputEvent) => {
                                    setEventDraft((current) => ({
                                        ...current,
                                        endDate: normalizeDateInput(inputEvent.target.value),
                                    }));
                                    if (eventSaveError) setEventSaveError(null);
                                }}
                                inputMode="numeric"
                                placeholder="dd/mm/yyyy"
                                maxLength={10}
                                disabled={savingEvent}
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
                                value={eventDraft.defaultStartTime ?? ""}
                                onChange={(inputEvent) => {
                                    setEventDraft((current) => ({ ...current, defaultStartTime: inputEvent.target.value }));
                                    if (eventSaveError) setEventSaveError(null);
                                }}
                                disabled={savingEvent}
                            />
                        </label>
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Default end time</span>
                            <input
                                className="modal_input"
                                type="text"
                                inputMode="numeric"
                                placeholder="HH:mm"
                                value={eventDraft.defaultEndTime ?? ""}
                                onChange={(inputEvent) => {
                                    setEventDraft((current) => ({ ...current, defaultEndTime: inputEvent.target.value }));
                                    if (eventSaveError) setEventSaveError(null);
                                }}
                                disabled={savingEvent}
                            />
                        </label>
                    </div>

                    <label className="planningDetailModalField">
                        <span className="planningDetailModalLabel">Time zone</span>
                        <input
                            className="modal_input"
                            list={EVENT_TIMEZONE_DATALIST_ID}
                            value={eventDraft.eventTimezone ?? ""}
                            onChange={(inputEvent) => {
                                setEventDraft((current) => ({ ...current, eventTimezone: inputEvent.target.value }));
                                if (eventSaveError) setEventSaveError(null);
                            }}
                            placeholder="Europe/Amsterdam"
                            disabled={savingEvent}
                        />
                        <datalist id={EVENT_TIMEZONE_DATALIST_ID}>
                            {timeZoneOptions.map((option) => (
                                <option key={option.value} value={option.value} label={option.label} />
                            ))}
                        </datalist>
                        <span className="roleWizardMeta">
                            {hasValidEventTimezone
                                ? formatTimeZoneLabel(normalizedEventTimezone)
                                : "Use a valid IANA time zone like Europe/Amsterdam."}
                        </span>
                    </label>

                    <label className="planningDetailModalField">
                        <span className="planningDetailModalLabel">Location</span>
                        <input
                            className="modal_input"
                            value={eventDraft.location ?? ""}
                            onChange={(inputEvent) => {
                                setEventDraft((current) => ({ ...current, location: inputEvent.target.value }));
                                if (eventSaveError) setEventSaveError(null);
                            }}
                            placeholder="Optional"
                            disabled={savingEvent}
                        />
                    </label>

                    <div className="planningDetailModalGrid">
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">Internal notes</span>
                            <textarea
                                className="modal_input planningWizardTextarea"
                                value={eventDraft.internalDescription ?? ""}
                                onChange={(inputEvent) => {
                                    setEventDraft((current) => ({ ...current, internalDescription: inputEvent.target.value }));
                                    if (eventSaveError) setEventSaveError(null);
                                }}
                                placeholder="Optional notes for planning"
                                disabled={savingEvent}
                            />
                        </label>
                        <label className="planningDetailModalField">
                            <span className="planningDetailModalLabel">External notes</span>
                            <textarea
                                className="modal_input planningWizardTextarea"
                                value={eventDraft.externalDescription ?? ""}
                                onChange={(inputEvent) => {
                                    setEventDraft((current) => ({ ...current, externalDescription: inputEvent.target.value }));
                                    if (eventSaveError) setEventSaveError(null);
                                }}
                                placeholder="Optional client-facing notes"
                                disabled={savingEvent}
                            />
                        </label>
                    </div>

                    {loadingClients ? <div className="roleWizardMeta">Loading client companies...</div> : null}
                    {!loadingClients && clientError ? <div className="roleWizardMeta">{clientError}</div> : null}
                    <div className="planningWizardSummary planningWizardSummary--stacked">
                        <span className="planningWizardSummaryLabel">Event summary</span>
                        <div className="planningWizardSummaryRow">
                            <span className="planningWizardSummaryItemLabel">Event</span>
                            <span className="planningWizardSummaryValue">{eventDraft.name?.trim() || "Unnamed event"}</span>
                        </div>
                        <div className="planningWizardSummaryRow">
                            <span className="planningWizardSummaryItemLabel">Event window</span>
                            <span className="planningWizardSummaryValue">{eventDraft.startDate || "dd/mm/yyyy"} to {eventDraft.endDate || "dd/mm/yyyy"}</span>
                        </div>
                        <div className="planningWizardSummaryRow">
                            <span className="planningWizardSummaryItemLabel">Default time</span>
                            <span className="planningWizardSummaryValue">
                                {(() => {
                                    const start = parseTimeInput(eventDraft.defaultStartTime ?? "");
                                    const end = parseTimeInput(eventDraft.defaultEndTime ?? "");
                                    if (start && end) return `${start} to ${end}`;
                                    if (start) return `Starts at ${start}`;
                                    if (end) return `Ends at ${end}`;
                                    return "No default time set";
                                })()}
                            </span>
                        </div>
                        <div className="planningWizardSummaryRow">
                            <span className="planningWizardSummaryItemLabel">Time zone</span>
                            <span className="planningWizardSummaryValue">{formatTimeZoneLabel(eventDraft.eventTimezone || browserTimeZone)}</span>
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
                            <span className="planningWizardSummaryValue">{eventDraft.internalDescription?.trim() || "No internal note added"}</span>
                        </div>
                    </div>
                    {eventSaveError ? <div className="planningDetailModalAlert">{eventSaveError}</div> : null}

                    <div className="planningDetailModalActions">
                        <button
                            type="button"
                            className="planningDetailDangerButton"
                            onClick={() => void handleDeleteEvent()}
                            disabled={savingEvent || deletingEvent}
                        >
                            {deletingEvent ? "Deleting..." : "Delete event"}
                        </button>
                        <button
                            type="button"
                            className="planningDetailSecondaryButton"
                            onClick={closeEditEventModal}
                            disabled={savingEvent || deletingEvent}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="planningDetailPrimaryButton" disabled={savingEvent || deletingEvent}>
                            {savingEvent ? "Saving..." : "Save event"}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
