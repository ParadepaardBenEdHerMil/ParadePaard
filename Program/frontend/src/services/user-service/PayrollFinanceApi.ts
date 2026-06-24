import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4004";

export type FinanceOverview = {
    from: string;
    to: string;
    totalGross: number;
    totalNet: number;
    totalLoonheffing: number;
    totalEmployeeDeductions: number;
    totalEmployeeZvw: number;
    totalEmployerZvw: number;
    totalEmployerInsurancePremiums: number;
    totalPensionEmployee: number;
    totalToBelastingdienst: number;
    totalEmployerCost: number;
    totalHours: number;
    payslipCount: number;
    employeeCount: number;
};

export type FinanceBreakdownRow = {
    label: string;
    groupId: string;
    gross: number;
    net: number;
    loonheffing: number;
    employerCost: number;
    hours: number;
    payslipCount: number;
};

export type FinanceDimension = "EMPLOYEE" | "FUNCTION" | "MONTH";

export async function getFinanceOverview(from: string, to: string): Promise<FinanceOverview> {
    const res = await axios.get<FinanceOverview>(`${API_BASE_URL}/api/payroll/finance/overview`, {
        params: { from, to },
        withCredentials: true,
    });
    return res.data;
}

export async function getFinanceBreakdown(
    from: string,
    to: string,
    dimension: FinanceDimension
): Promise<FinanceBreakdownRow[]> {
    const res = await axios.get<FinanceBreakdownRow[]>(`${API_BASE_URL}/api/payroll/finance/breakdown`, {
        params: { from, to, dimension },
        withCredentials: true,
    });
    return res.data;
}
