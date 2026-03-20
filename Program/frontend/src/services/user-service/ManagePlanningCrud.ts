import axios from "axios";

export type PlanningEventSaveDTO = {
    name: string;
    startDate: string;
    endDate: string;
    clientCompanyId?: string | null;
    internalDescription?: string | null;
    externalDescription?: string | null;
    defaultStartTime?: string | null;
    defaultEndTime?: string | null;
    location?: string | null;
    status?: string | null;
};

export type PlanningShiftSaveDTO = {
    startTime: string;
    endTime: string;
    functionName: string;
    name?: string | null;
    breakMinutes?: number | null;
    location?: string | null;
    peopleNeeded?: number | null;
};

export type PlanningAssignmentSaveDTO = {
    userId: string;
    status?: string;
};

export type PlanningEventMutationResponseDTO = {
    eventId: string;
};

export type PlanningShiftMutationResponseDTO = {
    shiftId: string;
    eventId: string;
};

export type PlanningAssignmentMutationResponseDTO = {
    scheduleEntryId: string;
    shiftId: string;
};

async function unwrap<T>(promise: Promise<{ data: T; status: number }>, fallbackMessage: string): Promise<T> {
    try {
        const response = await promise;
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`${fallbackMessage} with status: ${response.status}`);
        }
        return response.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || fallbackMessage);
        }
        throw err;
    }
}

export async function CreatePlanningEvent(
    apiBaseUrl: string,
    payload: PlanningEventSaveDTO
): Promise<PlanningEventMutationResponseDTO> {
    return unwrap(
        axios.post<PlanningEventMutationResponseDTO>(`${apiBaseUrl}/api/planning/events`, payload, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        }),
        "Failed to create planning event"
    );
}

export async function UpdatePlanningEvent(
    apiBaseUrl: string,
    eventId: string,
    payload: PlanningEventSaveDTO
): Promise<PlanningEventMutationResponseDTO> {
    return unwrap(
        axios.put<PlanningEventMutationResponseDTO>(`${apiBaseUrl}/api/planning/events/${eventId}`, payload, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        }),
        "Failed to update planning event"
    );
}

export async function DeletePlanningEvent(apiBaseUrl: string, eventId: string): Promise<void> {
    await unwrap(
        axios.delete<void>(`${apiBaseUrl}/api/planning/events/${eventId}`, { withCredentials: true }),
        "Failed to delete planning event"
    );
}

export async function CreatePlanningShift(
    apiBaseUrl: string,
    eventId: string,
    payload: PlanningShiftSaveDTO
): Promise<PlanningShiftMutationResponseDTO> {
    return unwrap(
        axios.post<PlanningShiftMutationResponseDTO>(`${apiBaseUrl}/api/planning/events/${eventId}/shifts`, payload, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        }),
        "Failed to create shift"
    );
}

export async function UpdatePlanningShift(
    apiBaseUrl: string,
    shiftId: string,
    payload: PlanningShiftSaveDTO
): Promise<PlanningShiftMutationResponseDTO> {
    return unwrap(
        axios.put<PlanningShiftMutationResponseDTO>(`${apiBaseUrl}/api/planning/shifts/${shiftId}`, payload, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        }),
        "Failed to update shift"
    );
}

export async function DeletePlanningShift(apiBaseUrl: string, shiftId: string): Promise<void> {
    await unwrap(
        axios.delete<void>(`${apiBaseUrl}/api/planning/shifts/${shiftId}`, { withCredentials: true }),
        "Failed to delete shift"
    );
}

export async function CreatePlanningAssignment(
    apiBaseUrl: string,
    shiftId: string,
    payload: PlanningAssignmentSaveDTO
): Promise<PlanningAssignmentMutationResponseDTO> {
    return unwrap(
        axios.post<PlanningAssignmentMutationResponseDTO>(`${apiBaseUrl}/api/planning/shifts/${shiftId}/assignments`, payload, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        }),
        "Failed to assign employee"
    );
}

export async function UpdatePlanningAssignment(
    apiBaseUrl: string,
    scheduleEntryId: string,
    payload: PlanningAssignmentSaveDTO
): Promise<PlanningAssignmentMutationResponseDTO> {
    return unwrap(
        axios.put<PlanningAssignmentMutationResponseDTO>(`${apiBaseUrl}/api/planning/assignments/${scheduleEntryId}`, payload, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        }),
        "Failed to update assignment"
    );
}

export async function DeletePlanningAssignment(apiBaseUrl: string, scheduleEntryId: string): Promise<void> {
    await unwrap(
        axios.delete<void>(`${apiBaseUrl}/api/planning/assignments/${scheduleEntryId}`, { withCredentials: true }),
        "Failed to remove assignment"
    );
}
