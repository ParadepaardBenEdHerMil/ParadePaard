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
    staffingStatus?: "OPEN" | "PARTIALLY_FILLED" | "FILLED" | string | null;
    allocations: PlanningResourceAllocationDTO[];
};

export type PlanningDayDTO = {
    day: string;
    allocations: PlanningResourceAllocationDTO[];
    shifts: PlanningShiftDTO[];
};

export type PlanningEventDTO = {
    eventId: string;
    eventName: string;
    startDate: string;
    endDate: string;
    eventTimezone?: string | null;
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

export type PlanningOverviewQuery = {
    companyId?: string;
    eventId?: string;
    startDate?: string;
    endDate?: string;
    includeAllocationDetails?: boolean;
};

export default async function GetPlanningOverview(
    API_BASE_URL: string,
    query: PlanningOverviewQuery = {}
): Promise<PlanningEventDTO[]> {
    try {
        const res = await axios.get<PlanningEventDTO[]>(`${API_BASE_URL}/api/planning/view`, {
            params: query,
            withCredentials: true,
        });

        if (res.status !== 200) {
            throw new Error("Failed to fetch planning overview with status: " + res.status);
        }

        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to fetch planning overview");
        }
        throw err;
    }
}
