import axios from "axios";
import type { UserResponseDTO } from "./Types";

export type OnboardingReviewContractSetupDraft = {
    selectedFunctionId?: string | null;
    functionName: string;
    contractType: string;
    startDate: string;
    endDate: string;
    grossHourlyWage: string;
    paymentFrequency: string;
    travelAllowance: boolean;
};

export type OnboardingReviewUpdateRequest = {
    decision: string;
    note?: string | null;
    status?: string | null;
    checkedSections?: Record<string, boolean> | null;
    contractSetupDraft?: OnboardingReviewContractSetupDraft | null;
};

export default async function UpdateOnboardingReview(
    apiBaseUrl: string,
    userId: string,
    payload: OnboardingReviewUpdateRequest
): Promise<UserResponseDTO> {
    try {
        const res = await axios.put<UserResponseDTO>(`${apiBaseUrl}/api/users/${userId}/onboarding-review`, payload, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        });

        if (res.status !== 200) {
            throw new Error("Failed to save onboarding review with status: " + res.status);
        }

        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to save onboarding review");
        }
        throw err;
    }
}
