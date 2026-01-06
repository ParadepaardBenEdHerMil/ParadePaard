import axios from "axios";

export default async function GetPermissions(apiBaseUrl: string): Promise<string[]> {
    const response = await axios.get<string[]>(`${apiBaseUrl}/auth/permissions`, {
        withCredentials: true,
    });

    if (response.status !== 200) {
        throw new Error("Failed to retrieve permissions: " + response.status);
    }

    return response.data ?? [];
}
