import axios from "axios";

export type PlanningAllocationStatus = "ASSIGNED" | "CONFIRMED" | "CANCELLED" | string;

export type PlanningResourceAllocationDTO = {
    scheduleEntryId: string;
    shiftId: string;
    userId: string;
    userDisplayName?: string | null;
    startTime: string;
    endTime: string;
    functionName: string;
    status: PlanningAllocationStatus;
};

export type ShiftApplicantDTO = {
    userId: string;
    userDisplayName?: string | null;
    appliedAt: string;
};

export type PlanningShiftDTO = {
    shiftId: string;
    startTime: string;
    endTime: string;
    name?: string | null;
    breakMinutes?: number | null;
    location?: string | null;
    peopleNeeded?: number | null;
    functionName: string;
    assignedCount?: number | null;
    checkedInCount?: number | null;
    applicantCount?: number | null;
    staffingStatus?: "OPEN" | "PARTIALLY_FILLED" | "FILLED" | string | null;
    clientBillingRatePerHour?: number | null;
    allocations: PlanningResourceAllocationDTO[];
    applicants?: ShiftApplicantDTO[] | null;
};

export type PlanningDayDTO = {
    day: string;
    allocations: PlanningResourceAllocationDTO[];
    shifts: PlanningShiftDTO[];
};

export type PlanningProjectDTO = {
    projectId: string;
    projectName: string;
    startDate: string;
    endDate: string;
    projectTimezone?: string | null;
    clientCompanyId?: string | null;
    clientCompanyName?: string | null;
    internalDescription?: string | null;
    externalDescription?: string | null;
    defaultStartTime?: string | null;
    defaultEndTime?: string | null;
    location?: string | null;
    status?: string | null;
    createdByUserId?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    finalized?: boolean | null;
    finalizedAt?: string | null;
    peopleNeededTotal?: number | null;
    days: PlanningDayDTO[];
};

export type PlanningEventDTO = PlanningProjectDTO;

export type PlanningOverviewQuery = {
    companyId?: string;
    projectId?: string;
    eventId?: string;
    startDate?: string;
    endDate?: string;
    includeAllocationDetails?: boolean;
};

function normalizePlanningOverview(projects: PlanningProjectDTO[]): PlanningProjectDTO[] {
    return projects.map((project) => ({
        ...project,
        days: Array.isArray(project.days)
            ? project.days.map((day) => ({
                ...day,
                allocations: Array.isArray(day.allocations) ? day.allocations : [],
                shifts: Array.isArray(day.shifts)
                    ? day.shifts.map((shift) => ({
                        ...shift,
                        allocations: Array.isArray(shift.allocations) ? shift.allocations : [],
                        applicants: Array.isArray(shift.applicants) ? shift.applicants : [],
                    }))
                    : [],
            }))
            : [],
    }));
}

export default async function GetPlanningOverview(
    API_BASE_URL: string,
    query: PlanningOverviewQuery = {}
): Promise<PlanningProjectDTO[]> {
    try {
        const res = await axios.get<PlanningProjectDTO[]>(`${API_BASE_URL}/api/planning/view`, {
            params: {
                ...query,
                projectId: query.projectId ?? query.eventId,
            },
            withCredentials: true,
        });

        if (res.status !== 200) {
            throw new Error("Failed to fetch planning overview with status: " + res.status);
        }

        return normalizePlanningOverview(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to fetch planning overview");
        }
        throw err;
    }
}
