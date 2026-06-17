import axios from "axios";

export type BillingRateDTO = {
    id: string;
    scope: string;
    clientCompanyId: string;
    clientName?: string | null;
    projectId?: string | null;
    projectName?: string | null;
    userId?: string | null;
    functionName: string;
    ratePerHour: number;
    comparedRatePerHour?: number | null;
    sourceClientFunctionBillingRateId?: string | null;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    active?: boolean | null;
    notes?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type BillingRateSaveDTO = {
    projectId?: string | null;
    userId?: string | null;
    functionName: string;
    ratePerHour: number;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    notes?: string | null;
};

export type ClientBillingRatesDTO = {
    defaultRates: BillingRateDTO[];
    projectRates: BillingRateDTO[];
    employeeOverrides: BillingRateDTO[];
    projectEmployeeOverrides: BillingRateDTO[];
};

export type UserBillingRatesDTO = {
    userId: string;
    clientOverrides: BillingRateDTO[];
    projectOverrides: BillingRateDTO[];
};

async function unwrap<T>(promise: Promise<{ data: T; status: number }>, fallbackMessage: string): Promise<T> {
    try {
        const response = await promise;
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`${fallbackMessage} with status: ${response.status}`);
        }
        return response.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || fallbackMessage);
        }
        throw err;
    }
}

export async function GetClientBillingRates(
    apiBaseUrl: string,
    clientCompanyId: string
): Promise<ClientBillingRatesDTO> {
    return unwrap(
        axios.get<ClientBillingRatesDTO>(`${apiBaseUrl}/api/planning/billing-rates/clients/${clientCompanyId}`, {
            withCredentials: true,
        }),
        "Failed to load client billing rates"
    );
}

export async function GetUserBillingRates(apiBaseUrl: string, userId: string): Promise<UserBillingRatesDTO> {
    return unwrap(
        axios.get<UserBillingRatesDTO>(`${apiBaseUrl}/api/planning/billing-rates/users/${userId}`, {
            withCredentials: true,
        }),
        "Failed to load user billing rates"
    );
}

export async function SaveClientDefaultBillingRate(
    apiBaseUrl: string,
    clientCompanyId: string,
    payload: BillingRateSaveDTO
): Promise<BillingRateDTO> {
    return unwrap(
        axios.post<BillingRateDTO>(`${apiBaseUrl}/api/planning/billing-rates/clients/${clientCompanyId}/defaults`, payload, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        }),
        "Failed to save client default billing rate"
    );
}

export async function SaveProjectBillingRate(
    apiBaseUrl: string,
    clientCompanyId: string,
    payload: BillingRateSaveDTO
): Promise<BillingRateDTO> {
    return unwrap(
        axios.post<BillingRateDTO>(`${apiBaseUrl}/api/planning/billing-rates/clients/${clientCompanyId}/project-rates`, payload, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        }),
        "Failed to save project billing rate"
    );
}

export async function SaveClientEmployeeBillingRate(
    apiBaseUrl: string,
    clientCompanyId: string,
    payload: BillingRateSaveDTO
): Promise<BillingRateDTO> {
    return unwrap(
        axios.post<BillingRateDTO>(`${apiBaseUrl}/api/planning/billing-rates/clients/${clientCompanyId}/employee-overrides`, payload, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        }),
        "Failed to save employee billing-rate override"
    );
}

export async function SaveProjectEmployeeBillingRate(
    apiBaseUrl: string,
    clientCompanyId: string,
    payload: BillingRateSaveDTO
): Promise<BillingRateDTO> {
    return unwrap(
        axios.post<BillingRateDTO>(
            `${apiBaseUrl}/api/planning/billing-rates/clients/${clientCompanyId}/project-employee-overrides`,
            payload,
            {
                headers: { "Content-Type": "application/json" },
                withCredentials: true,
            }
        ),
        "Failed to save project employee billing-rate override"
    );
}
