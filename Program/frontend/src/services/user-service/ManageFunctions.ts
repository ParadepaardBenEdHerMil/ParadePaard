import axios from "axios";
import { extractApiErrorMessage } from "../../utils/apiError";
import type { FunctionResponseDTO } from "./GetContracts";

// Write shape for the admin function CRUD (POST/PUT /api/contract/function).
export type FunctionSaveDTO = {
    functionName: string;
    department?: string | null;
    hourlyWage?: number | null;
    active?: boolean | null;
};

// Minimal public view returned by the anonymous application-form lookup.
export type PublicJobFunctionDTO = {
    functionId: string;
    functionName: string;
};

export async function CreateFunction(
    API_BASE_URL: string,
    payload: FunctionSaveDTO
): Promise<FunctionResponseDTO> {
    try {
        const response = await axios.post<FunctionResponseDTO>(
            `${API_BASE_URL}/api/contract/function`,
            payload,
            { headers: { "Content-Type": "application/json" }, withCredentials: true }
        );
        return response.data;
    } catch (error: unknown) {
        throw new Error(extractApiErrorMessage(error, "Failed to create the job function."));
    }
}

export async function UpdateFunction(
    API_BASE_URL: string,
    functionId: string,
    payload: FunctionSaveDTO
): Promise<FunctionResponseDTO> {
    try {
        const response = await axios.put<FunctionResponseDTO>(
            `${API_BASE_URL}/api/contract/function/${functionId}`,
            payload,
            { headers: { "Content-Type": "application/json" }, withCredentials: true }
        );
        return response.data;
    } catch (error: unknown) {
        throw new Error(extractApiErrorMessage(error, "Failed to update the job function."));
    }
}

export async function DeleteFunction(API_BASE_URL: string, functionId: string): Promise<void> {
    try {
        await axios.delete(`${API_BASE_URL}/api/contract/function/${functionId}`, {
            withCredentials: true,
        });
    } catch (error: unknown) {
        throw new Error(extractApiErrorMessage(error, "Failed to delete the job function."));
    }
}

// Anonymous read for the public application form — no credentials, active functions only.
export async function GetPublicJobFunctions(API_BASE_URL: string): Promise<PublicJobFunctionDTO[]> {
    try {
        const response = await axios.get<PublicJobFunctionDTO[]>(`${API_BASE_URL}/api/public/functions`);
        return response.data;
    } catch (error: unknown) {
        throw new Error(extractApiErrorMessage(error, "Failed to load job functions."));
    }
}
