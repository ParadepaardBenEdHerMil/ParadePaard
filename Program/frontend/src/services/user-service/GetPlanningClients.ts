import axios from "axios";

export type PlanningClientCompanyContactDTO = {
    firstName?: string | null;
    lastName?: string | null;
    position?: string | null;
    email?: string | null;
    phone?: string | null;
};

export type PlanningClientCompanyDTO = {
    clientCompanyId: string;
    name: string;
    address?: string | null;
    companyLine?: string | null;
    notes?: string | null;
    contacts: PlanningClientCompanyContactDTO[];
    createdAt?: string | null;
};

export default async function GetPlanningClients(API_BASE_URL: string): Promise<PlanningClientCompanyDTO[]> {
    try {
        const res = await axios.get<PlanningClientCompanyDTO[]>(`${API_BASE_URL}/api/planning/clients`, {
            withCredentials: true,
        });

        if (res.status !== 200) {
            throw new Error("Failed to fetch client companies with status: " + res.status);
        }

        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to fetch client companies");
        }
        throw err;
    }
}
