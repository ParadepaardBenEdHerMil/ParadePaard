import axios from "axios";

export type OpenShiftDTO = {
    shiftId: string;
    projectId: string;
    projectName: string;
    externalDescription?: string | null;
    projectLocation?: string | null;
    shiftName?: string | null;
    shiftDate: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number | null;
    functionName: string;
    shiftLocation?: string | null;
    peopleNeeded?: number | null;
    spotsRemaining?: number | null;
    applied?: boolean | null;
    appliedAt?: string | null;
};

function unwrapMessage(err: unknown, fallback: string): never {
    if (axios.isAxiosError(err)) {
        throw new Error(err.response?.data?.message || fallback);
    }
    throw err;
}

export async function GetOpenShifts(API_BASE_URL: string): Promise<OpenShiftDTO[]> {
    try {
        const response = await axios.get<OpenShiftDTO[]>(`${API_BASE_URL}/api/planning/open-shifts`, {
            withCredentials: true,
        });
        return Array.isArray(response.data) ? response.data : [];
    } catch (err) {
        unwrapMessage(err, "Failed to load open shifts");
    }
}

export async function ApplyToOpenShift(API_BASE_URL: string, shiftId: string): Promise<OpenShiftDTO> {
    try {
        const response = await axios.post<OpenShiftDTO>(
            `${API_BASE_URL}/api/planning/open-shifts/${shiftId}/application`,
            null,
            { withCredentials: true }
        );
        return response.data;
    } catch (err) {
        unwrapMessage(err, "Failed to apply to this shift");
    }
}

export async function WithdrawOpenShiftApplication(API_BASE_URL: string, shiftId: string): Promise<OpenShiftDTO> {
    try {
        const response = await axios.delete<OpenShiftDTO>(
            `${API_BASE_URL}/api/planning/open-shifts/${shiftId}/application`,
            { withCredentials: true }
        );
        return response.data;
    } catch (err) {
        unwrapMessage(err, "Failed to withdraw your application");
    }
}
