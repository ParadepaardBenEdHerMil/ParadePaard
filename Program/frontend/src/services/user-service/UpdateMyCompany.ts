import axios from "axios";
import type { CompanyResponseDTO, PayrollTaxTemplateDTO } from "./Types";

export type UpdateCompanyRequestDTO = {
    name?: string;
    payoutFrequencyMinutes?: number;
    timesheetLoggingMode?: "AUTO_ON_SHIFT_END" | "ADMIN_FINALIZE" | string;
    travelClaimMode?: "AUTO_APPROVE" | "REQUIRES_APPROVAL" | string;
    payrollTaxTemplates?: PayrollTaxTemplateDTO[];
};

export default async function UpdateMyCompany(
    API_BASE_URL: string,
    payload: UpdateCompanyRequestDTO
): Promise<CompanyResponseDTO> {
    try {
        const res = await axios.put<CompanyResponseDTO>(
            `${API_BASE_URL}/api/users/me/company`,
            payload,
            {
                headers: { "Content-Type": "application/json" },
                withCredentials: true,
            }
        );
        if (res.status !== 200) {
            throw new Error("Failed to update company with status: " + res.status);
        }
        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to update company");
        }
        throw err;
    }
}
