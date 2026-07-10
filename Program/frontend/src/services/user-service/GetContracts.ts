import axios from "axios";

export type ContractStatus =
    | "DRAFT"
    | "SENT_TO_EMPLOYEE"
    | "EMPLOYEE_SIGNED"
    | "FINALIZED"
    | "REJECTED"
    | "EXPIRED"
    | "SIGNED"
    | string;

export type PaymentFrequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "EVERY_5_MINUTES" | "EVERY_10_MINUTES" | string;

export type ContractResponseDTO = {
    contractId: string;
    userId: string;
    functionId?: string | null;
    functionName?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    contractType?: string | null;
    status?: ContractStatus | null;
    grossHourlyWage?: number | null;
    travelAllowance?: boolean | null;
    paymentFrequency?: PaymentFrequency | null;
    weeklyHours?: number | null;
    holidayAllowancePercentage?: number | null;
    leaveEntitlementDays?: number | null;
    workLocation?: string | null;
    probationPeriod?: string | null;
    noticePeriod?: string | null;
    collectiveAgreement?: string | null;
    pensionScheme?: string | null;
    sicknessPolicy?: string | null;
    confidentialityClause?: string | null;
    applyLoonheffingskorting?: boolean | null;
    pensionApplicable?: boolean | null;
    pensionEmployeePercentage?: number | null;
    specialZvwContribution?: boolean | null;
    zvwEmployeePercentage?: number | null;
    reviewComment?: string | null;
    sentToEmployeeAt?: string | null;
    employeeSignedAt?: string | null;
    finalizedAt?: string | null;
    rejectedAt?: string | null;
    signedUserId?: string | null;
    typedSignatureName?: string | null;
    drawnSignatureImage?: string | null;
    agreementCheckboxText?: string | null;
    contractVersion?: string | null;
    documentHash?: string | null;
    ipAddress?: string | null;
    browserUserAgent?: string | null;
    employerSignedUserId?: string | null;
    employerTypedSignatureName?: string | null;
    employerDrawnSignatureImage?: string | null;
    employerAgreementCheckboxText?: string | null;
    employerContractVersion?: string | null;
    employerDocumentHash?: string | null;
    employerIpAddress?: string | null;
    employerBrowserUserAgent?: string | null;
};

export type SignContractRequestDTO = {
    typedSignatureName: string;
    drawnSignatureImage?: string | null;
    agreementCheckboxText: string;
    contractVersion: string;
    documentHash?: string | null;
    ipAddress?: string | null;
    browserUserAgent?: string | null;
};

export type CreateContractRequestDTO = {
    userId: string;
    functionId?: string | null;
    functionName?: string | null;
    startDate: string;
    endDate?: string | null;
    contractType: string;
    grossHourlyWage?: number | null;
    travelAllowance: boolean;
    paymentFrequency?: PaymentFrequency | null;
    // Tax/payroll terms resolved from the Horeca rule version at design time.
    applyLoonheffingskorting?: boolean | null;
    pensionApplicable?: boolean | null;
    pensionEmployeePercentage?: number | null;
    specialZvwContribution?: boolean | null;
    zvwEmployeePercentage?: number | null;
};

export type FunctionResponseDTO = {
    functionId: string;
    functionName: string;
    department?: string | null;
    hourlyWage: number;
    active?: boolean | null;
};

export type MinimumWageResponseDTO = {
    startDate: string;
    dateOfBirth: string;
    age: number | null;
    minimumHourlyWage: number | null;
    effectiveFrom: string | null;
};

/** One age band's hourly rate within a dated minimum wage table. minimumAge 21 = adult (21+). */
export type WageRateDTO = {
    minimumAge: number;
    hourlyRate: number;
};

/** One dated minimum wage table (loontabel): the source document + age-band rates from a date. */
export type WageScheduleEntryDTO = {
    effectiveFrom: string;
    documentName?: string | null;
    documentUrl?: string | null;
    rates: WageRateDTO[];
};

/** The full editable minimum wage schedule from contract-service, newest effective date first. */
export type WageScheduleDTO = {
    entries: WageScheduleEntryDTO[];
};

export type WageScheduleUpdateRequestDTO = {
    effectiveFrom: string;
    documentName?: string | null;
    documentUrl?: string | null;
    rates: WageRateDTO[];
};

/**
 * Reads the editable statutory minimum wage schedule that contract-service enforces. This is
 * the single source of truth the Horeca payroll rules page shows and edits, so the wage table
 * on that page can never drift from what the backend accepts on contract creation.
 */
export async function GetWageSchedule(API_BASE_URL: string): Promise<WageScheduleDTO> {
    const res = await axios.get<WageScheduleDTO>(`${API_BASE_URL}/api/contract/wage-schedule`, {
        withCredentials: true,
    });
    return res.data;
}

/**
 * Creates or replaces one dated minimum wage table. Saving a new effective date adds a new
 * loontabel; reusing an existing date edits it in place. The saved rates immediately become
 * the minimum contract-service enforces.
 */
export async function UpdateWageSchedule(
    API_BASE_URL: string,
    payload: WageScheduleUpdateRequestDTO
): Promise<WageScheduleDTO> {
    try {
        const res = await axios.put<WageScheduleDTO>(`${API_BASE_URL}/api/contract/wage-schedule`, payload, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        });
        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to save the wage schedule");
        }
        throw err;
    }
}

/**
 * Resolves the statutory Dutch minimum hourly wage from contract-service — the SAME
 * date-aware schedule contract creation enforces. This is the single source of truth for
 * the onboarding "suggested minimum" and the horeca rules page, so the suggestion can
 * never be below what the backend will accept.
 */
export async function GetMinimumWage(
    API_BASE_URL: string,
    startDate: string,
    dateOfBirth: string
): Promise<MinimumWageResponseDTO> {
    const res = await axios.get<MinimumWageResponseDTO>(`${API_BASE_URL}/api/contract/minimum-wage`, {
        params: { startDate, dateOfBirth },
        withCredentials: true,
    });
    return res.data;
}

export default async function GetContracts(API_BASE_URL: string): Promise<ContractResponseDTO[]> {
    try {
        const res = await axios.get<ContractResponseDTO[]>(`${API_BASE_URL}/api/contract`, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        });

        if (res.status !== 200) {
            throw new Error("Failed to fetch contracts with status: " + res.status);
        }

        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to fetch contracts");
        }
        throw err;
    }
}

export async function GetMyContracts(API_BASE_URL: string): Promise<ContractResponseDTO[]> {
    try {
        const res = await axios.get<ContractResponseDTO[]>(`${API_BASE_URL}/api/contract/me`, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        });

        if (res.status !== 200) {
            throw new Error("Failed to fetch contracts with status: " + res.status);
        }

        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to fetch contracts");
        }
        throw err;
    }
}

export async function GetCurrentContract(API_BASE_URL: string): Promise<ContractResponseDTO | null> {
    try {
        const res = await axios.get<ContractResponseDTO>(`${API_BASE_URL}/api/contract/me/current`, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        });

        if (res.status !== 200) {
            throw new Error("Failed to fetch current contract with status: " + res.status);
        }

        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            if (err.response?.status === 404 || err.response?.data?.message === "Contract Not Found") return null;
            throw new Error(err.response?.data?.message || "Failed to fetch current contract");
        }
        throw err;
    }
}

export async function GetCurrentContractForUser(API_BASE_URL: string, userId: string): Promise<ContractResponseDTO | null> {
    try {
        const res = await axios.get<ContractResponseDTO>(`${API_BASE_URL}/api/contract/user/${userId}/current`, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        });

        if (res.status !== 200) {
            throw new Error("Failed to fetch current contract with status: " + res.status);
        }

        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            if (err.response?.status === 404 || err.response?.data?.message === "Contract Not Found") return null;
            throw new Error(err.response?.data?.message || "Failed to fetch current contract");
        }
        throw err;
    }
}

export async function GetContractsForUser(API_BASE_URL: string, userId: string): Promise<ContractResponseDTO[]> {
    try {
        const res = await axios.get<ContractResponseDTO[]>(`${API_BASE_URL}/api/contract/user/${userId}`, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        });

        if (res.status !== 200) {
            throw new Error("Failed to fetch contracts with status: " + res.status);
        }

        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to fetch contracts");
        }
        throw err;
    }
}

export async function GetFunctions(API_BASE_URL: string): Promise<FunctionResponseDTO[]> {
    try {
        const res = await axios.get<FunctionResponseDTO[]>(`${API_BASE_URL}/api/contract/function`, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        });

        if (res.status !== 200) {
            throw new Error("Failed to fetch job positions with status: " + res.status);
        }

        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to fetch job positions");
        }
        throw err;
    }
}

export async function GetContractPdf(API_BASE_URL: string, contractId: string): Promise<Blob> {
    try {
        const res = await axios.get(`${API_BASE_URL}/api/contract/${contractId}/pdf`, {
            responseType: "blob",
            withCredentials: true,
        });

        if (res.status !== 200) {
            throw new Error("Failed to fetch contract PDF with status: " + res.status);
        }

        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to fetch contract PDF");
        }
        throw err;
    }
}

export async function CreateContract(
    API_BASE_URL: string,
    payload: CreateContractRequestDTO
): Promise<ContractResponseDTO> {
    try {
        const res = await axios.post<ContractResponseDTO>(`${API_BASE_URL}/api/contract`, payload, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        });
        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to create contract draft");
        }
        throw err;
    }
}

export async function UpdateContract(
    API_BASE_URL: string,
    contractId: string,
    payload: CreateContractRequestDTO
): Promise<ContractResponseDTO> {
    try {
        const res = await axios.put<ContractResponseDTO>(`${API_BASE_URL}/api/contract/${contractId}`, payload, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        });
        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to update contract draft");
        }
        throw err;
    }
}

export async function SignContract(
    API_BASE_URL: string,
    contractId: string,
    payload: SignContractRequestDTO
): Promise<ContractResponseDTO> {
    const res = await axios.post<ContractResponseDTO>(`${API_BASE_URL}/api/contract/${contractId}/sign`, payload, {
        withCredentials: true,
    });
    return res.data;
}

export async function SendContract(API_BASE_URL: string, contractId: string): Promise<ContractResponseDTO> {
    try {
        const res = await axios.post<ContractResponseDTO>(`${API_BASE_URL}/api/contract/${contractId}/send`, null, {
            withCredentials: true,
        });
        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to send contract email");
        }
        throw err;
    }
}

export async function PrepareEmployerSignature(
    API_BASE_URL: string,
    contractId: string,
    payload: SignContractRequestDTO
): Promise<ContractResponseDTO> {
    const res = await axios.post<ContractResponseDTO>(`${API_BASE_URL}/api/contract/${contractId}/employer-signature`, payload, {
        withCredentials: true,
    });
    return res.data;
}

export async function FinalizeContract(
    API_BASE_URL: string,
    contractId: string,
    payload: SignContractRequestDTO
): Promise<ContractResponseDTO> {
    const res = await axios.post<ContractResponseDTO>(`${API_BASE_URL}/api/contract/${contractId}/finalize`, payload, {
        withCredentials: true,
    });
    return res.data;
}

export async function RejectContract(API_BASE_URL: string, contractId: string, comment: string): Promise<ContractResponseDTO> {
    const res = await axios.post<ContractResponseDTO>(
        `${API_BASE_URL}/api/contract/${contractId}/reject`,
        { comment },
        { withCredentials: true }
    );
    return res.data;
}
