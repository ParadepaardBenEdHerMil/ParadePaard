import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import {
    UserServices,
    type PlanningClientCompanyDTO,
    type PlanningEventDTO,
    type PlanningEventSaveDTO,
} from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";
import {
    getEventClientName,
    getEventShiftRecords,
    getEventStaffingLabel,
    getEventTimeLabel,
    getShiftDisplayName,
    getShiftLocation,
    getShiftStaffingLabel,
    getShiftTimeLabel,
} from "../utils/planningSummary";
import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminPlanningOverview.css";
import "../stylesheets/Settings.css";

type PlannerMode = "events" | "shifts";
type EventCreateStep = "details" | "client" | "notes";

type PlannerEntry = {
    id: string;
    title: string;
    meta: string;
    submeta?: string;
    badge?: string;
    tone: PlannerMode;
    href?: string;
    detailRows?: Array<{
        label: string;
        value: string;
    }>;
};

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

function getEventEntriesByDay(events: PlanningEventDTO[]): Map<string, PlannerEntry[]> {
    const entriesByDay = new Map<string, PlannerEntry[]>();

    for (const event of events) {
        const totalShiftCount = getEventShiftRecords(event).length;

        for (const day of buildDayRange(event.startDate, event.endDate)) {
            const entries = entriesByDay.get(day) ?? [];
            const dateLabel = event.startDate === event.endDate
                ? formatDate(event.startDate)
                : `${formatDate(event.startDate)} to ${formatDate(event.endDate)}`;

            entries.push({
                id: `${event.eventId}-${day}`,
                title: event.eventName,
                meta: dateLabel,
                submeta: totalShiftCount === 0
                    ? "No shifts planned"
                    : `${totalShiftCount} shift${totalShiftCount === 1 ? "" : "s"} planned`,
                badge: event.finalized ? "Finalized" : undefined,
                tone: "events",
                href: `/admin/planning/events/${event.eventId}`,
                detailRows: [
                    {
                        label: "Staffing",
                        value: getEventStaffingLabel(event),
                    },
                    {
                        label: "Location",
                        value: event.location?.trim() || "No location",
                    },
                    {
                        label: "Time",
                        value: getEventTimeLabel(event),
                    },
                    {
                        label: "Client",
                        value: getEventClientName(event),
                    },
                ],
            });

            entriesByDay.set(day, entries);
        }
    }

    for (const [day, entries] of entriesByDay.entries()) {
        entriesByDay.set(day, [...entries].sort((left, right) => left.title.localeCompare(right.title)));
    }

    return entriesByDay;
}

function getShiftEntriesByDay(events: PlanningEventDTO[]): Map<string, PlannerEntry[]> {
    const entriesByDay = new Map<string, PlannerEntry[]>();

    for (const event of events) {
        for (const day of event.days) {
            const entries = entriesByDay.get(day.day) ?? [];
            const sortedShifts = [...day.shifts].sort((left, right) => left.startTime.localeCompare(right.startTime));

            for (const shift of sortedShifts) {
                const shiftName = getShiftDisplayName(shift);

                entries.push({
                    id: `${day.day}-${shift.shiftId}`,
                    title: event.eventName,
                    meta: shiftName,
                    submeta: shift.functionName && shift.functionName !== shiftName ? shift.functionName : undefined,
                    badge: shift.staffingStatus ?? undefined,
                    tone: "shifts",
                    href: `/admin/planning/events/${event.eventId}/shifts/${shift.shiftId}`,
                    detailRows: [
                        {
                            label: "Staffing",
                            value: getShiftStaffingLabel(shift),
                        },
                        {
                            label: "Location",
                            value: getShiftLocation(event, shift),
                        },
                        {
                            label: "Time",
                            value: getShiftTimeLabel(shift),
                        },
                        {
                            label: "Client",
                            value: getEventClientName(event),
                        },
                    ],
                });
            }

            entriesByDay.set(day.day, entries);
        }
    }

    for (const [day, entries] of entriesByDay.entries()) {
        entriesByDay.set(day, [...entries].sort((left, right) => left.meta.localeCompare(right.meta)));
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

export default function AdminPlanningOverview() {
    const navigate = useNavigate();
    const today = useMemo(() => toIsoDate(new Date()), []);
    const [loading, setLoading] = useState(true);
    const [loadingClients, setLoadingClients] = useState(true);
    const [savingEvent, setSavingEvent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [clientError, setClientError] = useState<string | null>(null);
    const [eventSaveError, setEventSaveError] = useState<string | null>(null);
    const [eventSaveSuccess, setEventSaveSuccess] = useState<string | null>(null);
    const [events, setEvents] = useState<PlanningEventDTO[]>([]);
    const [clients, setClients] = useState<PlanningClientCompanyDTO[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(today);
    const [expandedDay, setExpandedDay] = useState<string>(today);
    const [plannerMode, setPlannerMode] = useState<PlannerMode>("events");
    const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
    const [createEventStep, setCreateEventStep] = useState<EventCreateStep>("details");
    const [eventDraft, setEventDraft] = useState<PlanningEventSaveDTO>({
        name: "",
        startDate: today,
        endDate: today,
        clientCompanyId: "",
        location: "",
        internalDescription: "",
    });

    const loadPlanningOverview = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const company = await UserServices.getMyCompany();
            const data = await UserServices.getPlanningOverview(company.companyId);
            setEvents(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load planning overview";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadPlanningClients = useCallback(async () => {
        try {
            setLoadingClients(true);
            setClientError(null);
            const data = await UserServices.getPlanningClients();
            setClients(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load planning clients";
            setClientError(message);
        } finally {
            setLoadingClients(false);
        }
    }, []);

    useEffect(() => {
        void loadPlanningOverview();
    }, [loadPlanningOverview]);

    useEffect(() => {
        void loadPlanningClients();
    }, [loadPlanningClients]);

    useEffect(() => {
        if (!eventSaveSuccess) return;
        const timeoutId = window.setTimeout(() => setEventSaveSuccess(null), 3200);
        return () => window.clearTimeout(timeoutId);
    }, [eventSaveSuccess]);

    const eventEntriesByDay = useMemo(() => getEventEntriesByDay(events), [events]);
    const shiftEntriesByDay = useMemo(() => getShiftEntriesByDay(events), [events]);
    const weekDays = useMemo(() => buildWeek(selectedDate), [selectedDate]);
    const visibleMonthLabel = useMemo(() => getMajorityMonthLabel(weekDays, selectedDate), [selectedDate, weekDays]);

    const shiftVisibleWeek = (direction: -1 | 1) => {
        setSelectedDate((current) => addDays(current, direction * 7));
        setExpandedDay((current) => current ? addDays(current, direction * 7) : current);
    };

    const resetCreateEventForm = useCallback(() => {
        setCreateEventStep("details");
        setEventSaveError(null);
        setEventSaveSuccess(null);
        setEventDraft({
            name: "",
            startDate: selectedDate,
            endDate: selectedDate,
            clientCompanyId: "",
            location: "",
            internalDescription: "",
        });
    }, [selectedDate]);

    const openCreateEventModal = () => {
        resetCreateEventForm();
        setIsCreateEventOpen(true);
    };

    const closeCreateEventModal = () => {
        if (savingEvent) return;
        setIsCreateEventOpen(false);
        resetCreateEventForm();
    };

    const handleCreateEvent = async (event: FormEvent) => {
        event.preventDefault();

        const payload: PlanningEventSaveDTO = {
            name: eventDraft.name.trim(),
            startDate: eventDraft.startDate,
            endDate: eventDraft.endDate,
            clientCompanyId: eventDraft.clientCompanyId?.trim() ? eventDraft.clientCompanyId : null,
            location: eventDraft.location?.trim() || null,
            internalDescription: eventDraft.internalDescription?.trim() || null,
        };

        if (!payload.name) {
            setEventSaveError("Event name is required.");
            return;
        }

        if (!payload.startDate || !payload.endDate) {
            setEventSaveError("Start and end date are required.");
            return;
        }

        if (payload.endDate < payload.startDate) {
            setEventSaveError("End date cannot be before start date.");
            return;
        }

        try {
            setSavingEvent(true);
            setEventSaveError(null);
            setEventSaveSuccess(null);
            await UserServices.createPlanningEvent(payload);
            await loadPlanningOverview();
            setSelectedDate(payload.startDate);
            setExpandedDay(payload.startDate);
            setPlannerMode("events");
            setIsCreateEventOpen(false);
            resetCreateEventForm();
            setEventSaveSuccess("Event created.");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to create event";
            setEventSaveError(message);
        } finally {
            setSavingEvent(false);
        }
    };

    const canSubmitCreateEvent = Boolean(eventDraft.name.trim())
        && Boolean(eventDraft.startDate)
        && Boolean(eventDraft.endDate)
        && eventDraft.endDate >= eventDraft.startDate;

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header className="pageHeader">
                            <h1 className="pageTitle">Planning Overview</h1>
                            <p className="pageSubtitle">Week view for events and shifts.</p>
                        </header>

                        <div className="adminDashboardCard">
                            <Card
                                title={(
                                    <div className="planningTitleNavigation" aria-label="Week navigation">
                                        <button
                                            type="button"
                                            className="planningIconButton"
                                            onClick={() => shiftVisibleWeek(-1)}
                                            aria-label="Previous week"
                                            disabled={loading}
                                        >
                                            <ChevronLeftIcon />
                                        </button>
                                        <span className="planningTitleLabel">{visibleMonthLabel}</span>
                                        <button
                                            type="button"
                                            className="planningIconButton"
                                            onClick={() => shiftVisibleWeek(1)}
                                            aria-label="Next week"
                                            disabled={loading}
                                        >
                                            <ChevronRightIcon />
                                        </button>
                                    </div>
                                )}
                                className="dashboardCardHeight planningOverviewCard"
                                right={(
                                    <div className="planningHeaderRow">
                                        <div className="planningHeaderDateActions">
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
                                            <div className="planningModeToggle" role="tablist" aria-label="Planning content">
                                                {(["events", "shifts"] as PlannerMode[]).map((mode) => (
                                                    <button
                                                        key={mode}
                                                        type="button"
                                                        role="tab"
                                                        aria-selected={plannerMode === mode}
                                                        className={`planningModeButton${plannerMode === mode ? " planningModeButton--active" : ""}`}
                                                        onClick={() => setPlannerMode(mode)}
                                                    >
                                                        {mode === "events" ? "Events" : "Shifts"}
                                                    </button>
                                                ))}
                                            </div>

                                            <button
                                                type="button"
                                                className="button"
                                                onClick={openCreateEventModal}
                                                disabled={loading || savingEvent}
                                            >
                                                Create event
                                            </button>
                                        </div>
                                    </div>
                                )}
                            >
                                {loading ? <div className="listEmpty">Loading planning...</div> : null}
                                {!loading && error ? <div className="listEmpty errorText">{error}</div> : null}

                                {!loading && !error && events.length === 0 ? (
                                    <div className="planningEmptyState">
                                        <div className="listEmpty">No events found for this company.</div>
                                    </div>
                                ) : null}

                                {!loading && !error && events.length > 0 ? (
                                    <div className="planningWeekLayout">
                                        <div className="planningWeekGrid">
                                            {weekDays.map((day) => {
                                                const dayEntries = plannerMode === "events"
                                                    ? eventEntriesByDay.get(day) ?? []
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
                                                                {dayEntries.length} {plannerMode === "events" ? "events" : "shifts"}
                                                            </span>
                                                        </button>

                                                        <div className="planningDayItems">
                                                            {visibleEntries.length === 0 ? (
                                                                <div className="planningDayEmpty">
                                                                    {plannerMode === "events" ? "No events" : "No shifts"}
                                                                </div>
                                                            ) : (
                                                                visibleEntries.map((entry) => (
                                                                    <button
                                                                        type="button"
                                                                        key={`${day}-${entry.id}`}
                                                                        className={`planningEntryCard planningEntryCard--compact planningEntryCard--${entry.tone}${entry.href ? " planningEntryCard--interactive" : ""}`}
                                                                        onClick={() => {
                                                                            if (entry.href) navigate(entry.href);
                                                                        }}
                                                                    >
                                                                        <div className="planningEntryCardTop">
                                                                            <div className="planningEntryTitle">{entry.title}</div>
                                                                            {entry.badge ? (
                                                                                <span className="planningEntryBadge">{entry.badge}</span>
                                                                            ) : null}
                                                                        </div>
                                                                        <div className="planningEntryMeta">{entry.meta}</div>
                                                                        {entry.submeta ? (
                                                                            <div className="planningEntrySubmeta">{entry.submeta}</div>
                                                                        ) : null}
                                                                        {entry.detailRows?.length ? (
                                                                            <div className="planningEntryDetails">
                                                                                {entry.detailRows.map((detail) => (
                                                                                    <div key={`${entry.id}-${detail.label}`} className="planningEntryDetailRow">
                                                                                        <span className="planningEntryDetailLabel">{detail.label}</span>
                                                                                        <span className="planningEntryDetailValue">{detail.value}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        ) : null}
                                                                    </button>
                                                                ))
                                                            )}

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
                                ) : null}
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
            {eventSaveSuccess ? (
                <div className="planningCreateEventToast" role="status" aria-live="polite">
                    <span className="planningCreateEventToastIcon">
                        <SuccessCheckIcon />
                    </span>
                    <div className="planningCreateEventToastBody">
                        <span className="planningCreateEventToastTitle">Event created</span>
                        <span className="planningCreateEventToastMessage">{eventSaveSuccess}</span>
                    </div>
                </div>
            ) : null}
            <Modal
                open={isCreateEventOpen}
                onClose={closeCreateEventModal}
                title="Create event"
                maxHeight={560}
                height={560}
                hideDefaultFooter
                closeOnEscape={false}
                closeOnOverlayClick={false}
            >
                <form className="roleWizard" onSubmit={(event) => void handleCreateEvent(event)}>
                    <div className="roleWizardTabs" role="tablist" aria-label="Event setup steps">
                        <button
                            type="button"
                            className={`roleWizardTab ${createEventStep === "details" ? "roleWizardTab--active" : ""}`}
                            onClick={() => setCreateEventStep("details")}
                            role="tab"
                            aria-selected={createEventStep === "details"}
                            disabled={savingEvent}
                        >
                            Details
                        </button>
                        <button
                            type="button"
                            className={`roleWizardTab ${createEventStep === "client" ? "roleWizardTab--active" : ""}`}
                            onClick={() => setCreateEventStep("client")}
                            role="tab"
                            aria-selected={createEventStep === "client"}
                            disabled={savingEvent}
                        >
                            Client
                        </button>
                        <button
                            type="button"
                            className={`roleWizardTab ${createEventStep === "notes" ? "roleWizardTab--active" : ""}`}
                            onClick={() => setCreateEventStep("notes")}
                            role="tab"
                            aria-selected={createEventStep === "notes"}
                            disabled={savingEvent}
                        >
                            Notes
                        </button>
                    </div>

                    {createEventStep === "details" ? (
                        <div className="roleWizardPanel">
                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Event name</span>
                                <input
                                    className="modal_input"
                                    value={eventDraft.name}
                                    onChange={(event) => {
                                        setEventDraft((current) => ({ ...current, name: event.target.value }));
                                        if (eventSaveError) setEventSaveError(null);
                                        if (eventSaveSuccess) setEventSaveSuccess(null);
                                    }}
                                    placeholder="Example: Breda city run"
                                    disabled={savingEvent}
                                />
                            </label>

                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Start date</span>
                                <input
                                    className="modal_input"
                                    type="date"
                                    value={eventDraft.startDate}
                                    onChange={(event) => {
                                        const startDate = event.target.value;
                                        setEventDraft((current) => ({
                                            ...current,
                                            startDate,
                                            endDate: current.endDate < startDate ? startDate : current.endDate,
                                        }));
                                        if (eventSaveError) setEventSaveError(null);
                                    }}
                                    disabled={savingEvent}
                                />
                            </label>

                            <label className="roleWizardField">
                                <span className="roleWizardLabel">End date</span>
                                <input
                                    className="modal_input"
                                    type="date"
                                    value={eventDraft.endDate}
                                    min={eventDraft.startDate}
                                    onChange={(event) => {
                                        setEventDraft((current) => ({ ...current, endDate: event.target.value }));
                                        if (eventSaveError) setEventSaveError(null);
                                    }}
                                    disabled={savingEvent}
                                />
                            </label>

                            <div className="planningWizardSummary">
                                <span className="planningWizardSummaryLabel">Event window</span>
                                <span className="planningWizardSummaryValue">
                                    {formatDate(eventDraft.startDate)} to {formatDate(eventDraft.endDate)}
                                </span>
                            </div>
                        </div>
                    ) : null}

                    {createEventStep === "client" ? (
                        <div className="roleWizardPanel">
                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Client/company</span>
                                <select
                                    className="modal_input"
                                    value={eventDraft.clientCompanyId ?? ""}
                                    onChange={(event) => {
                                        setEventDraft((current) => ({ ...current, clientCompanyId: event.target.value }));
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

                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Location</span>
                                <input
                                    className="modal_input"
                                    value={eventDraft.location ?? ""}
                                    onChange={(event) => {
                                        setEventDraft((current) => ({ ...current, location: event.target.value }));
                                        if (eventSaveError) setEventSaveError(null);
                                    }}
                                    placeholder="Optional"
                                    disabled={savingEvent}
                                />
                            </label>

                            {loadingClients ? (
                                <div className="roleWizardMeta">Loading client companies...</div>
                            ) : null}
                            {!loadingClients && !clientError && clients.length === 0 ? (
                                <div className="roleWizardMeta">No saved client companies yet. You can still create the event without one.</div>
                            ) : null}
                        </div>
                    ) : null}

                    {createEventStep === "notes" ? (
                        <div className="roleWizardPanel">
                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Internal description</span>
                                <textarea
                                    className="modal_input planningWizardTextarea"
                                    value={eventDraft.internalDescription ?? ""}
                                    onChange={(event) => {
                                        setEventDraft((current) => ({ ...current, internalDescription: event.target.value }));
                                        if (eventSaveError) setEventSaveError(null);
                                    }}
                                    placeholder="Optional notes for planning"
                                    disabled={savingEvent}
                                />
                            </label>

                            <div className="planningWizardSummary planningWizardSummary--stacked">
                                <span className="planningWizardSummaryLabel">Ready to create</span>
                                <span className="planningWizardSummaryValue">{eventDraft.name.trim() || "Unnamed event"}</span>
                                <span className="roleWizardMeta">
                                    {eventDraft.clientCompanyId
                                        ? clients.find((client) => client.clientCompanyId === eventDraft.clientCompanyId)?.name ?? "Assigned client"
                                        : "No client/company selected"}
                                </span>
                            </div>
                        </div>
                    ) : null}

                    {clientError ? (
                        <div className="roleWizardAlert roleWizardAlert--error">{clientError}</div>
                    ) : null}
                    {eventSaveError ? (
                        <div className="roleWizardAlert roleWizardAlert--error">{eventSaveError}</div>
                    ) : null}

                    <div className="roleWizardActions planningWizardActions">
                        <button
                            type="button"
                            className="buttonSecondary planningWizardCancel"
                            onClick={closeCreateEventModal}
                            disabled={savingEvent}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="roleWizardPrimary"
                            disabled={!canSubmitCreateEvent || savingEvent}
                        >
                            {savingEvent ? "Creating..." : "Create event"}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
