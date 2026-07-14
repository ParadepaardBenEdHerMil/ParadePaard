import axios from "axios";

// Re-enables a disabled login (the counterpart to DisableUser). Used to reopen a rejected
// account so the employee can be re-invited through the onboarding flow.
export default async function EnableUser(apiBaseUrl: string, userId: string): Promise<void> {
    const response = await axios.put(
        `${apiBaseUrl}/auth/admin/users/${userId}/enable`,
        null,
        {
            withCredentials: true,
        }
    );

    if (response.status !== 204 && response.status !== 200) {
        throw new Error("Failed to enable user: " + response.status);
    }
}
