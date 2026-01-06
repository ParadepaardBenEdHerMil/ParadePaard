import axios from "axios";
import type { RoleResponseDTO } from "./types";

export default async function GetRoles(apiBaseUrl: string): Promise<RoleResponseDTO[]> {
    const response = await axios.get<RoleResponseDTO[]>(`${apiBaseUrl}/auth/admin/roles`, {
        withCredentials: true,
    });

    if (response.status !== 200) {
        throw new Error("Failed to retrieve roles: " + response.status);
    }

    return response.data ?? [];
}
