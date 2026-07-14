import axios from "axios";

// Reads the auth-account gate for a single user so the Users detail page can show
// "Disabled"/"Enabled" and gate the resend-onboarding action until the account is enabled.
export type AccountState = {
    userId: string;
    disabled: boolean;
};

export default async function GetAccountState(apiBaseUrl: string, userId: string): Promise<AccountState> {
    const response = await axios.get<AccountState>(
        `${apiBaseUrl}/auth/admin/users/${userId}/account-state`,
        {
            withCredentials: true,
        }
    );
    return response.data;
}
