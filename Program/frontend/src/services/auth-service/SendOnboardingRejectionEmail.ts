import axios from "axios";
import {
    normalizeOnboardingEmailError,
    type OnboardingEmailResponse,
} from "./SendOnboardingChangesEmail";

// Emails the applicant that their onboarding was rejected, with the reviewer's reason. No
// setup link — rejection is final unless an admin re-enables the account and re-invites.
export default async function SendOnboardingRejectionEmail(
    apiBaseUrl: string,
    userId: string,
    reason: string | null
): Promise<OnboardingEmailResponse> {
    try {
        const response = await axios.post<OnboardingEmailResponse>(
            `${apiBaseUrl}/auth/admin/users/${userId}/onboarding-rejected-email`,
            { reason },
            {
                headers: { "Content-Type": "application/json" },
                withCredentials: true,
            }
        );
        return response.data;
    } catch (err) {
        throw normalizeOnboardingEmailError(err, "Failed to send onboarding rejection email");
    }
}
