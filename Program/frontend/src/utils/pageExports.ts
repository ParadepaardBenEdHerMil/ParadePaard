// CSV row builders for pages that are not backed by a DocumentModel (planning project/shift).
// Each returns string[][] for the shared csvExport helpers. Kept framework-free for easy testing.

import { formatDate, formatMaybeDateTime } from "./dateFormat";
import { getAllocationStatusLabel } from "./planningSummary";
import type {
    PlanningProjectDTO,
    PlanningShiftDTO,
} from "../services/user-service/GetPlanningOverview";

const DASH = "-";

function timeText(value?: string | null): string {
    return value ? formatMaybeDateTime(value) : "";
}

function dayText(value?: string | null): string {
    return value ? formatDate(value) : "";
}

function shiftLabel(shift: PlanningShiftDTO): string {
    return (shift.name ?? "").trim() || shift.functionName || "Shift";
}

// One denormalised row per (shift × assigned person). Shifts with nobody assigned still get a row
// so the export shows the gap.
const SHIFT_TABLE_HEADER = [
    "Day",
    "Shift",
    "Start",
    "End",
    "Location",
    "Function",
    "People needed",
    "Assigned",
    "Person",
    "Person function",
    "Status",
];

function allocationRows(dayLabel: string, shift: PlanningShiftDTO): string[][] {
    const base = [
        dayLabel,
        shiftLabel(shift),
        timeText(shift.startTime),
        timeText(shift.endTime),
        shift.location ?? "",
        shift.functionName ?? "",
        shift.peopleNeeded != null ? String(shift.peopleNeeded) : "",
        shift.assignedCount != null ? String(shift.assignedCount) : "",
    ];
    const allocations = shift.allocations ?? [];
    if (allocations.length === 0) {
        return [[...base, "", "", ""]];
    }
    return allocations.map((allocation) => [
        ...base,
        allocation.userDisplayName ?? "",
        allocation.functionName ?? "",
        getAllocationStatusLabel(allocation.status),
    ]);
}

/** Project → a summary block followed by one row per person-per-shift across every day. */
export function buildProjectCsv(project: PlanningProjectDTO): string[][] {
    const rows: string[][] = [
        ["Project", project.projectName],
        ["Client", project.clientCompanyName ?? DASH],
        ["Start date", dayText(project.startDate) || DASH],
        ["End date", dayText(project.endDate) || DASH],
        ["Location", project.location ?? DASH],
        ["Status", project.status ?? DASH],
        ["People needed (total)", project.peopleNeededTotal != null ? String(project.peopleNeededTotal) : DASH],
        [],
        SHIFT_TABLE_HEADER,
    ];
    for (const day of project.days ?? []) {
        const dayLabel = dayText(day.day);
        for (const shift of day.shifts ?? []) {
            for (const row of allocationRows(dayLabel, shift)) {
                rows.push(row);
            }
        }
    }
    return rows;
}

/** Planning overview → one row per person-per-shift across every project. */
export function buildPlanningOverviewCsv(projects: PlanningProjectDTO[]): string[][] {
    const rows: string[][] = [["Project", ...SHIFT_TABLE_HEADER]];
    for (const project of projects ?? []) {
        for (const day of project.days ?? []) {
            const dayLabel = dayText(day.day);
            for (const shift of day.shifts ?? []) {
                for (const row of allocationRows(dayLabel, shift)) {
                    rows.push([project.projectName, ...row]);
                }
            }
        }
    }
    return rows;
}

/** Single shift → a header block followed by one row per assigned person. */
export function buildShiftCsv(
    shift: PlanningShiftDTO,
    context?: { projectName?: string | null; day?: string | null }
): string[][] {
    const rows: string[][] = [];
    if (context?.projectName) rows.push(["Project", context.projectName]);
    rows.push(["Shift", shiftLabel(shift)]);
    if (context?.day) rows.push(["Day", dayText(context.day)]);
    rows.push(["Start", timeText(shift.startTime)]);
    rows.push(["End", timeText(shift.endTime)]);
    rows.push(["Location", shift.location ?? DASH]);
    rows.push(["Function", shift.functionName ?? DASH]);
    rows.push(["People needed", shift.peopleNeeded != null ? String(shift.peopleNeeded) : DASH]);
    rows.push(["Assigned", shift.assignedCount != null ? String(shift.assignedCount) : DASH]);
    rows.push([]);
    rows.push(["Person", "Function", "Start", "End", "Status"]);
    for (const allocation of shift.allocations ?? []) {
        rows.push([
            allocation.userDisplayName ?? "",
            allocation.functionName ?? "",
            timeText(allocation.startTime),
            timeText(allocation.endTime),
            getAllocationStatusLabel(allocation.status),
        ]);
    }
    return rows;
}
