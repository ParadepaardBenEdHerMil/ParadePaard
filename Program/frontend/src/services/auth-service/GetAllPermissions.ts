import axios from "axios";

export default async function GetAllPermissions(apiBaseUrl: string): Promise<string[]> {
    const response = await axios.get<string[]>(`${apiBaseUrl}/auth/admin/permissions`, {
        withCredentials: true,
    });

    if (response.status !== 200) {
        throw new Error("Failed to retrieve permission catalog: " + response.status);
    }

    return response.data ?? [];
}
