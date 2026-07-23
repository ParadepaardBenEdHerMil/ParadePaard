import axios from "axios";
import { extractApiErrorMessage } from "../../utils/apiError";
import type { FunctionResponseDTO } from "./GetContracts";

// Write shape for the admin function CRUD (POST/PUT /api/contract/function).
export type FunctionSaveDTO = {
    functionName: string;
    department?: string | null;
    active?: boolean | null;
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
