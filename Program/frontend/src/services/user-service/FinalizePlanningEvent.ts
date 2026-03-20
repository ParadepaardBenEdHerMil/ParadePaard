import axios from "axios";

export type FinalizePlanningRequestDTO = {
    companyId: string;
    eventId?: string;
    isoWeek?: number;
    weekBasedYear?: number;
};

export type FinalizePlanningResponseDTO = {
    createdTimesheets: number;
    finalizedEventIds: string[];
    warnings: string[];
};

export default async function FinalizePlanningEvent(
    API_BASE_URL: string,
    payload: FinalizePlanningRequestDTO
): Promise<FinalizePlanningResponseDTO> {
    try {
        const res = await axios.post<FinalizePlanningResponseDTO>(
            `${API_BASE_URL}/api/planning/finalization`,
            payload,
            { withCredentials: true }
        );

        if (res.status !== 200) {
            throw new Error("Failed to finalize planning with status: " + res.status);
        }

        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to finalize planning");
        }
        throw err;
    }
}
