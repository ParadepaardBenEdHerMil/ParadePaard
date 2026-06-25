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


export type MarginOverview = {
    from: string;
    to: string;
    totalRevenue: number;
    totalEmployerCost: number;
    totalMargin: number;
    marginPercentage: number;
    totalHours: number;
    shiftCount: number;
    missingRateCount: number;
    negativeMarginCount: number;
    tag: string;
};

export type MarginBreakdownRow = {
    groupId: string;
    label: string;
    revenue: number;
    employerCost: number;
    margin: number;
    marginPercentage: number;
    hours: number;
    shiftCount: number;
    missingRateCount: number;
    negativeMarginCount: number;
};

export type ShiftFinanceRow = {
    timesheetId: string;
    userId: string | null;
    projectId: string | null;
    projectName: string | null;
    clientCompanyId: string | null;
    clientName: string | null;
    function: string | null;
    shiftDate: string | null;
    hours: number;
    hourlyWage: number;
    grossWage: number;
    holidayAllowance: number;
    employerZvw: number;
    employerInsurancePremiums: number;
    totalEmployerCost: number;
    ratePerHour: number | null;
    clientRevenue: number;
    margin: number;
    marginPercentage: number;
    marginStatus: string;
    rateSource: string | null;
    tag: string;
};

export type MarginDimension = "CLIENT" | "PROJECT" | "EMPLOYEE" | "FUNCTION" | "MONTH";

export async function getMarginOverview(from: string, to: string): Promise<MarginOverview> {
    const res = await axios.get<MarginOverview>(`${API_BASE_URL}/api/payroll/finance/margin/overview`, {
        params: { from, to },
        withCredentials: true,
    });
    return res.data;
}

export async function getMarginBreakdown(
    from: string,
    to: string,
    dimension: MarginDimension
): Promise<MarginBreakdownRow[]> {
    const res = await axios.get<MarginBreakdownRow[]>(`${API_BASE_URL}/api/payroll/finance/margin/breakdown`, {
        params: { from, to, dimension },
        withCredentials: true,
    });
    return res.data;
}

export async function getMarginShifts(from: string, to: string): Promise<ShiftFinanceRow[]> {
    const res = await axios.get<ShiftFinanceRow[]>(`${API_BASE_URL}/api/payroll/finance/margin/shifts`, {
        params: { from, to },
        withCredentials: true,
    });
    return res.data;
}

export async function downloadMarginCsv(from: string, to: string): Promise<void> {
    const res = await axios.get(`${API_BASE_URL}/api/payroll/finance/margin/export`, {
        params: { from, to, format: "csv" },
        withCredentials: true,
        responseType: "blob",
    });
    const url = window.URL.createObjectURL(res.data as Blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `margin-${from}_${to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}
