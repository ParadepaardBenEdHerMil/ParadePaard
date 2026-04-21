import type {
    PlanningEventDTO,
    PlanningResourceAllocationDTO,
    PlanningShiftDTO,
} from "../services/user-service/UserServices";

export type PlanningEventShiftRecord = {
    day: string;
    shift: PlanningShiftDTO;
};

export type PlanningStaffingTone = "empty" | "partial" | "staffed";
export type PlanningAllocationTone = "pending" | "declined" | "confirmed";

function normalizeText(value: string | null | undefined, fallback: string): string {
    const trimmed = value?.trim();
    return trimmed || fallback;
}

function normalizeAllocationStatus(value: string | null | undefined): string {
    return (value ?? "").trim().toUpperCase();
}

function toTimeLabel(value: string | null | undefined): string {
    if (!value) return "";
    const timePart = value.includes("T") ? value.split("T")[1] ?? "" : value;
    const normalized = timePart.trim();
    if (!normalized) return "";
    return normalized.slice(0, 5);
}

export function getShiftDisplayName(shift: PlanningShiftDTO): string {
    return normalizeText(shift.name, shift.functionName || "Unnamed shift");
}

export function getEventClientName(event: PlanningEventDTO): string {
    return normalizeText(event.clientCompanyName, "No client");
}

export function getEventLocation(event: PlanningEventDTO): string {
    return normalizeText(event.location, "No location");
}

export function getShiftLocation(event: PlanningEventDTO, shift: PlanningShiftDTO): string {
    return normalizeText(shift.location, getEventLocation(event));
}

export function getShiftRequiredCount(shift: PlanningShiftDTO): number {
    return shift.peopleNeeded ?? 0;
}

export function getShiftScheduledCount(shift: PlanningShiftDTO): number {
    if (typeof shift.assignedCount === "number") {
        return shift.assignedCount;
    }

    return shift.allocations.filter((allocation) => normalizeAllocationStatus(allocation.status) !== "CANCELLED").length;
}

export function getShiftCheckedInCount(shift: PlanningShiftDTO): number {
    if (typeof shift.checkedInCount === "number") {
        return shift.checkedInCount;
    }

    return shift.allocations.filter((allocation) => normalizeAllocationStatus(allocation.status) === "CONFIRMED").length;
}

export function getShiftStaffingLabel(shift: PlanningShiftDTO): string {
    return `${getShiftRequiredCount(shift)} required, ${getShiftScheduledCount(shift)} scheduled, ${getShiftCheckedInCount(shift)} checked in`;
}

function getStaffingTone(required: number, scheduled: number): PlanningStaffingTone {
    if (scheduled <= 0) {
        return "empty";
    }

    if (scheduled >= required) {
        return "staffed";
    }

    return "partial";
}

export function getShiftStaffingTone(shift: PlanningShiftDTO): PlanningStaffingTone {
    return getStaffingTone(getShiftRequiredCount(shift), getShiftScheduledCount(shift));
}

export function isShiftStaffed(shift: PlanningShiftDTO): boolean {
    return getShiftStaffingTone(shift) === "staffed";
}

export function getEventShiftRecords(event: PlanningEventDTO): PlanningEventShiftRecord[] {
    return event.days
        .flatMap((day) => day.shifts.map((shift) => ({ day: day.day, shift })))
        .sort((left, right) => {
            return (
                left.day.localeCompare(right.day) ||
                left.shift.startTime.localeCompare(right.shift.startTime) ||
                getShiftDisplayName(left.shift).localeCompare(getShiftDisplayName(right.shift))
            );
        });
}

export function getEventRequiredCount(event: PlanningEventDTO): number {
    if (typeof event.peopleNeededTotal === "number") {
        return event.peopleNeededTotal;
    }

    return event.days.reduce(
        (total, day) => total + day.shifts.reduce((dayTotal, shift) => dayTotal + getShiftRequiredCount(shift), 0),
        0
    );
}

export function getEventScheduledCount(event: PlanningEventDTO): number {
    return event.days.reduce(
        (total, day) => total + day.shifts.reduce((dayTotal, shift) => dayTotal + getShiftScheduledCount(shift), 0),
        0
    );
}

export function getEventCheckedInCount(event: PlanningEventDTO): number {
    return event.days.reduce(
        (total, day) => total + day.shifts.reduce((dayTotal, shift) => dayTotal + getShiftCheckedInCount(shift), 0),
        0
    );
}

export function getEventStaffingLabel(event: PlanningEventDTO): string {
    return `${getEventRequiredCount(event)} required, ${getEventScheduledCount(event)} scheduled, ${getEventCheckedInCount(event)} checked in`;
}

export function getEventStaffingTone(event: PlanningEventDTO): PlanningStaffingTone {
    return getStaffingTone(getEventRequiredCount(event), getEventScheduledCount(event));
}

export function isEventStaffed(event: PlanningEventDTO): boolean {
    return getEventStaffingTone(event) === "staffed";
}

export function getShiftTimeLabel(shift: PlanningShiftDTO): string {
    const start = toTimeLabel(shift.startTime);
    const end = toTimeLabel(shift.endTime);

    if (start && end) return `${start} - ${end}`;
    if (start) return `Starts ${start}`;
    if (end) return `Until ${end}`;
    return "No time set";
}

export function getEventTimeLabel(event: PlanningEventDTO): string {
    const start = toTimeLabel(event.defaultStartTime);
    const end = toTimeLabel(event.defaultEndTime);

    if (start && end) return `${start} - ${end}`;
    if (start) return `Starts ${start}`;
    if (end) return `Until ${end}`;
    return "No time set";
}

export function getAllocationDisplayName(allocation: PlanningResourceAllocationDTO): string {
    return normalizeText(allocation.userDisplayName, "Unnamed employee");
}

export function getAllocationStatusLabel(status: string | null | undefined): string {
    switch (normalizeAllocationStatus(status)) {
        case "ASSIGNED":
            return "Scheduled";
        case "CONFIRMED":
            return "Accepted";
        case "CANCELLED":
            return "Declined";
        default:
            return normalizeText(status, "Scheduled");
    }
}

export function getAllocationStatusTone(status: string | null | undefined): PlanningAllocationTone {
    switch (normalizeAllocationStatus(status)) {
        case "CONFIRMED":
            return "confirmed";
        case "CANCELLED":
            return "declined";
        case "ASSIGNED":
        default:
            return "pending";
    }
}

export function findShiftRecord(
    event: PlanningEventDTO,
    shiftId: string
): PlanningEventShiftRecord | null {
    return getEventShiftRecords(event).find((record) => record.shift.shiftId === shiftId) ?? null;
}
