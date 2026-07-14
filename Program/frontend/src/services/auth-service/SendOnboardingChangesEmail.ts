import axios from "axios";

// Emails the employee that their onboarding needs changes: the reviewer's overall note plus
// the per-field flags (already formatted as "Section · Field: explanation" lines) and a fresh
// setup link. Pairs with putting the user back into CHANGES_REQUESTED.
export type OnboardingEmailResponse = {
    userId: string;
    email: string;
    emailSent: boolean;
};

export default async function SendOnboardingChangesEmail(
    apiBaseUrl: string,
    userId: string,
    note: string | null,
    flags: string[]
): Promise<OnboardingEmailResponse> {
    try {
        const response = await axios.post<OnboardingEmailResponse>(
            `${apiBaseUrl}/auth/admin/users/${userId}/onboarding-changes-email`,
            { note, flags },
            {
                headers: { "Content-Type": "application/json" },
                withCredentials: true,
            }
        );
        return response.data;
    } catch (err) {
        throw normalizeOnboardingEmailError(err, "Failed to send onboarding changes email");
    }
}

export function normalizeOnboardingEmailError(err: unknown, fallback: string): Error {
    if (axios.isAxiosError(err)) {
        const data = err.response?.data as { message?: string } | string | undefined;
        const message =
            (typeof data === "string" && data.trim()) ||
            (typeof data === "object" && data?.message) ||
            fallback;
        return new Error(message);
    }
    return err instanceof Error ? err : new Error(fallback);
}
