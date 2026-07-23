import type {
    PlanningProjectDTO,
    PlanningResourceAllocationDTO,
    PlanningShiftDTO,
} from "../services/user-service/UserServices";

export type PlanningProjectShiftRecord = {
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

export function getProjectClientName(project: PlanningProjectDTO): string {
    return normalizeText(project.clientCompanyName, "No client");
}

export function getProjectLocation(project: PlanningProjectDTO): string {
    return normalizeText(project.location, "No location");
}

export function getShiftLocation(project: PlanningProjectDTO, shift: PlanningShiftDTO): string {
    return normalizeText(shift.location, getProjectLocation(project));
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

export function getShiftApplicantCount(shift: PlanningShiftDTO): number {
    if (typeof shift.applicantCount === "number") {
        return shift.applicantCount;
    }

    return shift.applicants?.length ?? 0;
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

export function getProjectShiftRecords(project: PlanningProjectDTO): PlanningProjectShiftRecord[] {
    return project.days
        .flatMap((day) => day.shifts.map((shift) => ({ day: day.day, shift })))
        .sort((left, right) => {
            return (
                left.day.localeCompare(right.day) ||
                left.shift.startTime.localeCompare(right.shift.startTime) ||
                getShiftDisplayName(left.shift).localeCompare(getShiftDisplayName(right.shift))
            );
        });
}

export function getProjectRequiredCount(project: PlanningProjectDTO): number {
    if (typeof project.peopleNeededTotal === "number") {
        return project.peopleNeededTotal;
    }

    return project.days.reduce(
        (total, day) => total + day.shifts.reduce((dayTotal, shift) => dayTotal + getShiftRequiredCount(shift), 0),
        0
    );
}

export function getProjectScheduledCount(project: PlanningProjectDTO): number {
    return project.days.reduce(
        (total, day) => total + day.shifts.reduce((dayTotal, shift) => dayTotal + getShiftScheduledCount(shift), 0),
        0
    );
}

export function getProjectCheckedInCount(project: PlanningProjectDTO): number {
    return project.days.reduce(
        (total, day) => total + day.shifts.reduce((dayTotal, shift) => dayTotal + getShiftCheckedInCount(shift), 0),
        0
    );
}

export function getProjectStaffingLabel(project: PlanningProjectDTO): string {
    return `${getProjectRequiredCount(project)} required, ${getProjectScheduledCount(project)} scheduled, ${getProjectCheckedInCount(project)} checked in`;
}

export function getProjectStaffingTone(project: PlanningProjectDTO): PlanningStaffingTone {
    return getStaffingTone(getProjectRequiredCount(project), getProjectScheduledCount(project));
}

export function isProjectStaffed(project: PlanningProjectDTO): boolean {
    return getProjectStaffingTone(project) === "staffed";
}

export function getShiftTimeLabel(shift: PlanningShiftDTO): string {
    const start = toTimeLabel(shift.startTime);
    const end = toTimeLabel(shift.endTime);

    if (start && end) return `${start} - ${end}`;
    if (start) return `Starts ${start}`;
    if (end) return `Until ${end}`;
    return "No time set";
}

export function getProjectTimeLabel(project: PlanningProjectDTO): string {
    const start = toTimeLabel(project.defaultStartTime);
    const end = toTimeLabel(project.defaultEndTime);

    if (start && end) return `${start} - ${end}`;
    if (start) return `Starts ${start}`;
    if (end) return `Until ${end}`;
    return "No time set";
}

// Backwards-compatible aliases: the UI still uses "event" wording in many places.
export const getEventClientName = getProjectClientName;
export const getEventLocation = getProjectLocation;
export const getEventShiftRecords = getProjectShiftRecords;
export const getEventRequiredCount = getProjectRequiredCount;
export const getEventScheduledCount = getProjectScheduledCount;
export const getEventCheckedInCount = getProjectCheckedInCount;
export const getEventStaffingLabel = getProjectStaffingLabel;
export const getEventStaffingTone = getProjectStaffingTone;
export const getEventTimeLabel = getProjectTimeLabel;

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
    project: PlanningProjectDTO,
    shiftId: string
): PlanningProjectShiftRecord | null {
    return getProjectShiftRecords(project).find((record) => record.shift.shiftId === shiftId) ?? null;
}
