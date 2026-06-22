import axios from "axios";

export type JaaropgaafDTO = {
    year: number;
    employerName?: string | null;
    employerStreet?: string | null;
    employerPostalCode?: string | null;
    employerCity?: string | null;
    employerCountry?: string | null;
    userId?: string | null;
    employeeName?: string | null;
    dateOfBirth?: string | null;
    bsn?: string | null;
    bsnMasked?: boolean;
    street?: string | null;
    houseNumber?: string | null;
    houseNumberSuffix?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
    fiscalWage?: number | null;
    loonheffing?: number | null;
    arbeidskortingApplied?: number | null;
    employeeZvwWithheld?: number | null;
    employerZvwLevy?: number | null;
    employerInsurancePremiums?: number | null;
    loonheffingskortingApplied?: boolean;
    loonheffingskortingFrom?: string | null;
    pensionEmployee?: number | null;
    travelReimbursement?: number | null;
    hoursWorked?: number | null;
    holidayAllowancePercentage?: number | null;
    totalGross?: number | null;
    totalNet?: number | null;
    payslipCount?: number;
};

export type VerzamelloonstaatDTO = {
    year: number;
    companyId?: string | null;
    employerName?: string | null;
    employeeCount: number;
    totalFiscalWage?: number | null;
    totalLoonheffing?: number | null;
    totalArbeidskortingApplied?: number | null;
    totalEmployeeZvwWithheld?: number | null;
    totalEmployerZvwLevy?: number | null;
    totalEmployerInsurancePremiums?: number | null;
    totalPensionEmployee?: number | null;
    totalGross?: number | null;
    totalNet?: number | null;
    employees: JaaropgaafDTO[];
};

function blobError(err: unknown, fallback: string): Error {
    if (axios.isAxiosError(err)) {
        return new Error(err.response?.data?.message || fallback);
    }
    return err instanceof Error ? err : new Error(fallback);
}

export async function GetMyJaaropgaaf(API_BASE_URL: string, year: number): Promise<JaaropgaafDTO> {
    const res = await axios.get<JaaropgaafDTO>(`${API_BASE_URL}/api/payroll/jaaropgaaf/me/${year}`, {
        withCredentials: true,
    });
    return res.data;
}

export async function GetMyJaaropgaafPdf(API_BASE_URL: string, year: number): Promise<Blob> {
    try {
        const res = await axios.get(`${API_BASE_URL}/api/payroll/jaaropgaaf/me/${year}/pdf`, {
            responseType: "blob",
            withCredentials: true,
        });
        return res.data;
    } catch (err) {
        throw blobError(err, "Failed to download jaaropgaaf");
    }
}

export async function GetJaaropgaaf(API_BASE_URL: string, employeeId: string, year: number): Promise<JaaropgaafDTO> {
    const res = await axios.get<JaaropgaafDTO>(`${API_BASE_URL}/api/payroll/jaaropgaaf/${employeeId}/${year}`, {
        withCredentials: true,
    });
    return res.data;
}

export async function GetJaaropgaafPdf(API_BASE_URL: string, employeeId: string, year: number): Promise<Blob> {
    try {
        const res = await axios.get(`${API_BASE_URL}/api/payroll/jaaropgaaf/${employeeId}/${year}/pdf`, {
            responseType: "blob",
            withCredentials: true,
        });
        return res.data;
    } catch (err) {
        throw blobError(err, "Failed to download jaaropgaaf");
    }
}

export async function GetVerzamelloonstaat(API_BASE_URL: string, year: number): Promise<VerzamelloonstaatDTO> {
    const res = await axios.get<VerzamelloonstaatDTO>(`${API_BASE_URL}/api/payroll/verzamelloonstaat/${year}`, {
        withCredentials: true,
    });
    return res.data;
}

export async function GetVerzamelloonstaatPdf(API_BASE_URL: string, year: number): Promise<Blob> {
    try {
        const res = await axios.get(`${API_BASE_URL}/api/payroll/verzamelloonstaat/${year}/pdf`, {
            responseType: "blob",
            withCredentials: true,
        });
        return res.data;
    } catch (err) {
        throw blobError(err, "Failed to download verzamelloonstaat");
    }
}
