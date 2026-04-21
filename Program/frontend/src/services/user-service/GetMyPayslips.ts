import axios from "axios";
import type { PayrollDeductionLineDTO } from "./Types";

export type PayslipResponseDTO = {
    payslipId: string;
    dateOfIssue: string;
    weekNumber: number;
    weekBasedYear: number;
    functionName: string;
    hourlyWage: number;
    totalHoursWorked: number;
    totalGrossAmount: number;
    wageTaxWithheldTest: number;
    wageTaxWithheldAmount?: number;
    travelExpenses: number;
    totalEmployeeDeductions?: number;
    totalNetAmount: number;
    status?: string;
    errorDescription?: string | null;
    availableToUserAt?: string;
    generatedAt?: string;
    deductionLines?: PayrollDeductionLineDTO[];
    userId: string;
    name: string;
    dateOfBirth: string;
    startDate: string;
    streetName: string;
    houseNumber: string;
    houseNumberSuffix: string | null;
    postalCode: string;
    city: string;
    country: string;
};

export default async function GetMyPayslips(API_BASE_URL: string): Promise<PayslipResponseDTO[]> {
    try {
        const res = await axios.get<PayslipResponseDTO[]>(`${API_BASE_URL}/api/payroll/me`, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        });

        if (res.status !== 200) {
            throw new Error("Failed to fetch payslips with status: " + res.status);
        }

        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to fetch payslips");
        }
        throw err;
    }
}
