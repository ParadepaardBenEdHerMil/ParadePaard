import axios from "axios";
import type { CreateRoleRequestDTO, RoleResponseDTO } from "./types";

export default async function CreateRole(
    apiBaseUrl: string,
    payload: CreateRoleRequestDTO
): Promise<RoleResponseDTO> {
    const response = await axios.post<RoleResponseDTO>(
        `${apiBaseUrl}/auth/admin/roles`,
        payload,
        {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        }
    );

    if (response.status !== 201 && response.status !== 200) {
        throw new Error("Failed to create role: " + response.status);
    }

    return response.data;
}
