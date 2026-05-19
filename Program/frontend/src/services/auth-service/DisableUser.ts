import axios from "axios";

export default async function DisableUser(apiBaseUrl: string, userId: string): Promise<void> {
    const response = await axios.put(
        `${apiBaseUrl}/auth/admin/users/${userId}/disable`,
        null,
        {
            withCredentials: true,
        }
    );

    if (response.status !== 204 && response.status !== 200) {
        throw new Error("Failed to disable user: " + response.status);
    }
}

