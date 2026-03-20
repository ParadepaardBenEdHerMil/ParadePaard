import type {
    PlanningEventDTO,
    PlanningResourceAllocationDTO,
} from "../services/user-service/UserServices";

export type PlanningRangeMode = "all" | "upcoming" | "thisWeek" | "thisMonth" | "thisYear" | "custom";
export type PlanningGroupKey = "none" | "day" | "week" | "month" | "year" | "event" | "employee" | "function" | "status";
export type PlanningStatusFilter = "ALL" | "ASSIGNED" | "CONFIRMED" | "CANCELLED" | "UNASSIGNED";

export type PlanningExplorerFilters = {
    rangeMode: PlanningRangeMode;
    startDate: string;
    endDate: string;
    eventId: string;
    employeeId: string;
    status: PlanningStatusFilter;
};

export type PlanningExplorerRow = {
    rowId: string;
    shiftId: string;
    allocationId: string | null;
    eventId: string;
    eventName: string;
    eventStartDate: string;
    eventEndDate: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
    functionName: string;
    employeeId: string | null;
    employeeName: string | null;
    status: string;
    finalized: boolean;
    finalizedAt: string | null;
};

export type PlanningGroupSummary = {
    shiftCount: number;
    assignedCount: number;
    openCount: number;
};

export type PlanningGroup = {
    value: string;
    label: string;
    dimension: PlanningGroupKey;
    rows: PlanningExplorerRow[];
    subgroups: PlanningGroup[];
    summary: PlanningGroupSummary;
};

type GroupInfo = {
    value: string;
    label: string;
    sortValue: string;
};

function normalizeStatus(value: string | null | undefined): string {
    const normalized = (value ?? "").trim().toUpperCase();
    return normalized || "UNASSIGNED";
}

function formatDisplayDate(value: string): string {
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat("nl-NL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(parsed);
}

function formatDisplayMonth(value: string): string {
    const parsed = new Date(`${value}-01T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat("nl-NL", {
        month: "long",
        year: "numeric",
    }).format(parsed);
}

function startOfIsoWeek(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    const day = normalized.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    normalized.setDate(normalized.getDate() + diff);
    return normalized;
}

function toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getIsoWeekInfo(dateValue: string): GroupInfo {
    const parsed = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
        return { value: dateValue, label: dateValue, sortValue: dateValue };
    }

    const weekStart = startOfIsoWeek(parsed);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const target = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
    const dayNumber = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
    const weekYear = target.getUTCFullYear();
    const yearStart = new Date(Date.UTC(weekYear, 0, 1));
    const weekNumber = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

    return {
        value: `${weekYear}-W${String(weekNumber).padStart(2, "0")}`,
        label: `Week ${weekNumber} (${formatDisplayDate(toIsoDate(weekStart))} - ${formatDisplayDate(toIsoDate(weekEnd))})`,
        sortValue: toIsoDate(weekStart),
    };
}

function getGroupInfo(row: PlanningExplorerRow, key: PlanningGroupKey): GroupInfo {
    switch (key) {
        case "day":
            return {
                value: row.shiftDate,
                label: formatDisplayDate(row.shiftDate),
                sortValue: row.shiftDate,
            };
        case "week":
            return getIsoWeekInfo(row.shiftDate);
        case "month": {
            const month = row.shiftDate.slice(0, 7);
            return {
                value: month,
                label: formatDisplayMonth(month),
                sortValue: month,
            };
        }
        case "year": {
            const year = row.shiftDate.slice(0, 4);
            return {
                value: year,
                label: year,
                sortValue: year,
            };
        }
        case "event":
            return {
                value: row.eventId,
                label: row.eventName,
                sortValue: `${row.eventStartDate}-${row.eventName.toLowerCase()}`,
            };
        case "employee":
            return {
                value: row.employeeId ?? "unassigned",
                label: row.employeeName ?? "Unassigned",
                sortValue: (row.employeeName ?? "Unassigned").toLowerCase(),
            };
        case "function":
            return {
                value: row.functionName,
                label: row.functionName,
                sortValue: row.functionName.toLowerCase(),
            };
        case "status": {
            const status = normalizeStatus(row.status);
            const order = ["UNASSIGNED", "ASSIGNED", "CONFIRMED", "CANCELLED"];
            const sortIndex = order.indexOf(status);
            return {
                value: status,
                label: status === "UNASSIGNED" ? "Unassigned" : status,
                sortValue: `${String(sortIndex === -1 ? order.length : sortIndex).padStart(2, "0")}-${status}`,
            };
        }
        case "none":
        default:
            return {
                value: "all",
                label: "All results",
                sortValue: "all",
            };
    }
}

function sortRows(rows: PlanningExplorerRow[]): PlanningExplorerRow[] {
    return [...rows].sort((left, right) => {
        return (
            left.shiftDate.localeCompare(right.shiftDate) ||
            left.startTime.localeCompare(right.startTime) ||
            left.eventName.localeCompare(right.eventName) ||
            left.functionName.localeCompare(right.functionName) ||
            (left.employeeName ?? "").localeCompare(right.employeeName ?? "")
        );
    });
}

function summarize(rows: PlanningExplorerRow[]): PlanningGroupSummary {
    const shiftIds = new Set(rows.map((row) => row.shiftId));
    const assignedCount = rows.filter((row) => row.employeeId).length;
    const openCount = rows.filter((row) => !row.employeeId).length;

    return {
        shiftCount: shiftIds.size,
        assignedCount,
        openCount,
    };
}

function groupRows(rows: PlanningExplorerRow[], key: PlanningGroupKey): PlanningGroup[] {
    const buckets = new Map<string, PlanningExplorerRow[]>();
    const labels = new Map<string, GroupInfo>();

    for (const row of rows) {
        const info = getGroupInfo(row, key);
        labels.set(info.value, info);
        const bucket = buckets.get(info.value);
        if (bucket) {
            bucket.push(row);
        } else {
            buckets.set(info.value, [row]);
        }
    }

    return [...buckets.entries()]
        .map(([value, bucketRows]) => {
            const info = labels.get(value) ?? { value, label: value, sortValue: value };
            const sortedRows = sortRows(bucketRows);
            return {
                value,
                label: info.label,
                sortValue: info.sortValue,
                rows: sortedRows,
                summary: summarize(sortedRows),
            };
        })
        .sort((left, right) => left.sortValue.localeCompare(right.sortValue))
        .map((group) => ({
            value: group.value,
            label: group.label,
            rows: group.rows,
            summary: group.summary,
            dimension: key,
            subgroups: [],
        }));
}

function createRangeBounds(filters: PlanningExplorerFilters): { start: string; end: string } | null {
    const now = new Date();
    const today = toIsoDate(now);

    switch (filters.rangeMode) {
        case "upcoming":
            return { start: today, end: "" };
        case "thisWeek": {
            const start = startOfIsoWeek(now);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            return { start: toIsoDate(start), end: toIsoDate(end) };
        }
        case "thisMonth": {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return { start: toIsoDate(start), end: toIsoDate(end) };
        }
        case "thisYear":
            return {
                start: `${now.getFullYear()}-01-01`,
                end: `${now.getFullYear()}-12-31`,
            };
        case "custom":
            if (!filters.startDate && !filters.endDate) return null;
            return { start: filters.startDate, end: filters.endDate };
        case "all":
        default:
            return null;
    }
}

function matchesRange(date: string, bounds: { start: string; end: string } | null): boolean {
    if (!bounds) return true;
    if (bounds.start && date < bounds.start) return false;
    if (bounds.end && date > bounds.end) return false;
    return true;
}

export function flattenPlanningEvents(
    events: PlanningEventDTO[],
    resolveDisplayName?: (allocation: PlanningResourceAllocationDTO) => string
): PlanningExplorerRow[] {
    const rows: PlanningExplorerRow[] = [];

    for (const event of events) {
        for (const day of event.days) {
            for (const shift of day.shifts) {
                if (shift.allocations.length === 0) {
                    rows.push({
                        rowId: `${shift.shiftId}::unassigned`,
                        shiftId: shift.shiftId,
                        allocationId: null,
                        eventId: event.eventId,
                        eventName: event.eventName,
                        eventStartDate: event.startDate,
                        eventEndDate: event.endDate,
                        shiftDate: day.day,
                        startTime: shift.startTime,
                        endTime: shift.endTime,
                        functionName: shift.functionName,
                        employeeId: null,
                        employeeName: null,
                        status: "UNASSIGNED",
                        finalized: Boolean(event.finalized),
                        finalizedAt: event.finalizedAt ?? null,
                    });
                    continue;
                }

                for (const allocation of shift.allocations) {
                    rows.push({
                        rowId: allocation.scheduleEntryId,
                        shiftId: shift.shiftId,
                        allocationId: allocation.scheduleEntryId,
                        eventId: event.eventId,
                        eventName: event.eventName,
                        eventStartDate: event.startDate,
                        eventEndDate: event.endDate,
                        shiftDate: day.day,
                        startTime: allocation.startTime || shift.startTime,
                        endTime: allocation.endTime || shift.endTime,
                        functionName: allocation.functionName || shift.functionName,
                        employeeId: allocation.userId,
                        employeeName: resolveDisplayName
                            ? resolveDisplayName(allocation)
                            : allocation.userDisplayName?.trim() || allocation.userId,
                        status: normalizeStatus(allocation.status),
                        finalized: Boolean(event.finalized),
                        finalizedAt: event.finalizedAt ?? null,
                    });
                }
            }
        }
    }

    return sortRows(rows);
}

export function applyPlanningFilters(
    rows: PlanningExplorerRow[],
    filters: PlanningExplorerFilters
): PlanningExplorerRow[] {
    const bounds = createRangeBounds(filters);

    return rows.filter((row) => {
        if (!matchesRange(row.shiftDate, bounds)) return false;
        if (filters.eventId && row.eventId !== filters.eventId) return false;
        if (filters.employeeId && row.employeeId !== filters.employeeId) return false;
        if (filters.status !== "ALL" && normalizeStatus(row.status) !== filters.status) return false;
        return true;
    });
}

export function groupPlanningRows(
    rows: PlanningExplorerRow[],
    primary: PlanningGroupKey,
    secondary: PlanningGroupKey
): PlanningGroup[] {
    const primaryGroups = groupRows(rows, primary);

    return primaryGroups.map((group) => ({
        ...group,
        subgroups:
            secondary !== "none"
                ? groupRows(group.rows, secondary)
                : [],
    }));
}

export function summarizePlanningRows(rows: PlanningExplorerRow[]): PlanningGroupSummary {
    return summarize(rows);
}
