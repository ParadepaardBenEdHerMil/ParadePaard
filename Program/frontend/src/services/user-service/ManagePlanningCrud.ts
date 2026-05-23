import axios from "axios";

export type PlanningProjectSaveDTO = {
    name: string;
    startDate: string;
    endDate: string;
    projectTimezone?: string | null;
    clientCompanyId?: string | null;
    internalDescription?: string | null;
    externalDescription?: string | null;
    defaultStartTime?: string | null;
    defaultEndTime?: string | null;
    location?: string | null;
    status?: string | null;
};

// Backwards-compatible aliases: the frontend historically used "Event" naming.
// The backend and DTOs have been migrated to "Project", but most UI and services
// still refer to "events". Keep these exports so existing imports keep working.
export type PlanningEventSaveDTO = PlanningProjectSaveDTO;

export type PlanningShiftSaveDTO = {
    startTime: string;
    endTime: string;
    functionName: string;
    name?: string | null;
    breakMinutes?: number | null;
    location?: string | null;
    peopleNeeded?: number | null;
    clientBillingRatePerHour?: number | null;
};

export type PlanningAssignmentSaveDTO = {
    userId: string;
    status?: string;
};

export type PlanningProjectMutationResponseDTO = {
    projectId: string;
};

export type PlanningEventMutationResponseDTO = PlanningProjectMutationResponseDTO;

export type PlanningShiftMutationResponseDTO = {
    shiftId: string;
    projectId: string;
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

export async function CreatePlanningProject(
    apiBaseUrl: string,
    payload: PlanningProjectSaveDTO
): Promise<PlanningProjectMutationResponseDTO> {
    return unwrap(
        axios.post<PlanningProjectMutationResponseDTO>(`${apiBaseUrl}/api/planning/projects`, payload, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        }),
        "Failed to create planning project"
    );
}

export async function CreatePlanningEvent(
    apiBaseUrl: string,
    payload: PlanningEventSaveDTO
): Promise<PlanningEventMutationResponseDTO> {
    return CreatePlanningProject(apiBaseUrl, payload);
}

export async function UpdatePlanningProject(
    apiBaseUrl: string,
    projectId: string,
    payload: PlanningProjectSaveDTO
): Promise<PlanningProjectMutationResponseDTO> {
    return unwrap(
        axios.put<PlanningProjectMutationResponseDTO>(`${apiBaseUrl}/api/planning/projects/${projectId}`, payload, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        }),
        "Failed to update planning project"
    );
}

export async function UpdatePlanningEvent(
    apiBaseUrl: string,
    eventId: string,
    payload: PlanningEventSaveDTO
): Promise<PlanningEventMutationResponseDTO> {
    return UpdatePlanningProject(apiBaseUrl, eventId, payload);
}

export async function DeletePlanningProject(apiBaseUrl: string, projectId: string): Promise<void> {
    await unwrap(
        axios.delete<void>(`${apiBaseUrl}/api/planning/projects/${projectId}`, { withCredentials: true }),
        "Failed to delete planning project"
    );
}

export async function DeletePlanningEvent(apiBaseUrl: string, eventId: string): Promise<void> {
    return DeletePlanningProject(apiBaseUrl, eventId);
}

export async function CreatePlanningShift(
    apiBaseUrl: string,
    projectId: string,
    payload: PlanningShiftSaveDTO
): Promise<PlanningShiftMutationResponseDTO> {
    return unwrap(
        axios.post<PlanningShiftMutationResponseDTO>(`${apiBaseUrl}/api/planning/projects/${projectId}/shifts`, payload, {
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
