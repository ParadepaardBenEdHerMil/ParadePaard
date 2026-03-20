import axios from "axios";
import type { PlanningClientCompanyContactDTO, PlanningClientCompanyDTO } from "./GetPlanningClients";

export type PlanningClientCompanyContactSaveDTO = PlanningClientCompanyContactDTO;

export type PlanningClientCompanySaveDTO = {
    name: string;
    address?: string | null;
    companyLine?: string | null;
    notes?: string | null;
    contacts?: PlanningClientCompanyContactSaveDTO[];
};

export default async function CreatePlanningClient(
    API_BASE_URL: string,
    payload: PlanningClientCompanySaveDTO
): Promise<PlanningClientCompanyDTO> {
    try {
        const res = await axios.post<PlanningClientCompanyDTO>(`${API_BASE_URL}/api/planning/clients`, payload, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        });

        if (res.status < 200 || res.status >= 300) {
            throw new Error("Failed to create client company with status: " + res.status);
        }

        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to create client company");
        }
        throw err;
    }
}
