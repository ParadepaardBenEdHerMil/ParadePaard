import axios from "axios";
import type { PayslipResponseDTO } from "./GetMyPayslips";

export default async function GetAllPayslips(API_BASE_URL: string): Promise<PayslipResponseDTO[]> {
    try {
        const res = await axios.get<PayslipResponseDTO[]>(`${API_BASE_URL}/api/payroll`, {
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
