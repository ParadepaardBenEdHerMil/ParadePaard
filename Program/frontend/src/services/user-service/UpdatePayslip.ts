import axios from "axios";
import type { PayslipResponseDTO } from "./GetMyPayslips";
import type { PayrollDeductionLineDTO } from "./Types";

export type UpdatePayslipRequestDTO = {
    userId: string;
    dateOfIssue: string;
    functionName?: string;
    hourlyWage?: number;
    totalHoursWorked?: number;
    wageTaxWithheldTest?: number;
    wageTaxWithheldAmount?: number;
    travelExpenses?: number;
    status?: string;
    errorDescription?: string | null;
    deductionLines?: PayrollDeductionLineDTO[];
};

export default async function UpdatePayslip(
    API_BASE_URL: string,
    payslipId: string,
    payload: UpdatePayslipRequestDTO
): Promise<PayslipResponseDTO> {
    try {
        const res = await axios.put<PayslipResponseDTO>(
            `${API_BASE_URL}/api/payroll/${payslipId}`,
            payload,
            {
                headers: { "Content-Type": "application/json" },
                withCredentials: true,
            }
        );

        if (res.status !== 200) {
            throw new Error("Failed to update payslip with status: " + res.status);
        }

        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to update payslip");
        }
        throw err;
    }
}
