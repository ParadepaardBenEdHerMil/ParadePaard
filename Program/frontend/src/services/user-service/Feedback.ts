import axios from "axios";

export type FeedbackCategory = "FEATURE" | "BUG" | "CLEANUP";

export type FeedbackStatus = "PENDING" | "FINISHED";

export type FeedbackEntryDTO = {
    feedbackId: string;
    authorUserId: string;
    authorName: string;
    category: FeedbackCategory | string;
    status: FeedbackStatus | string;
    body: string;
    createdAt?: string | null;
    updatedAt?: string | null;
    mine: boolean;
};

export type FeedbackRequestDTO = {
    category: FeedbackCategory;
    body: string;
};

const feedbackError = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) {
        // The feedback API is sign-in gated. On navbar-less public pages (e.g. /apply)
        // an anonymous visitor gets a 401 — surface a friendly nudge rather than a raw error.
        if (error.response?.status === 401 || error.response?.status === 403) {
            return new Error("Please sign in to leave feedback.");
        }
        return new Error(error.response?.data?.message || fallback);
    }
    return error;
};

export async function GetFeedback(API_BASE_URL: string): Promise<FeedbackEntryDTO[]> {
    try {
        const response = await axios.get<FeedbackEntryDTO[]>(`${API_BASE_URL}/api/feedback`, {
            withCredentials: true,
        });
        return response.data;
    } catch (error) {
        throw feedbackError(error, "Could not load feedback");
    }
}

export async function CreateFeedback(
    API_BASE_URL: string,
    payload: FeedbackRequestDTO
): Promise<FeedbackEntryDTO> {
    try {
        const response = await axios.post<FeedbackEntryDTO>(`${API_BASE_URL}/api/feedback`, payload, {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
        });
        return response.data;
    } catch (error) {
        throw feedbackError(error, "Could not submit your feedback");
    }
}

export async function UpdateFeedback(
    API_BASE_URL: string,
    feedbackId: string,
    payload: FeedbackRequestDTO
): Promise<FeedbackEntryDTO> {
    try {
        const response = await axios.put<FeedbackEntryDTO>(
            `${API_BASE_URL}/api/feedback/${feedbackId}`,
            payload,
            {
                headers: { "Content-Type": "application/json" },
                withCredentials: true,
            }
        );
        return response.data;
    } catch (error) {
        throw feedbackError(error, "Could not update your feedback");
    }
}

export async function UpdateFeedbackStatus(
    API_BASE_URL: string,
    feedbackId: string,
    status: FeedbackStatus
): Promise<FeedbackEntryDTO> {
    try {
        const response = await axios.put<FeedbackEntryDTO>(
            `${API_BASE_URL}/api/feedback/${feedbackId}/status`,
            { status },
            {
                headers: { "Content-Type": "application/json" },
                withCredentials: true,
            }
        );
        return response.data;
    } catch (error) {
        throw feedbackError(error, "Could not update the feedback status");
    }
}

export async function DeleteFeedback(API_BASE_URL: string, feedbackId: string): Promise<void> {
    try {
        await axios.delete(`${API_BASE_URL}/api/feedback/${feedbackId}`, {
            withCredentials: true,
        });
    } catch (error) {
        throw feedbackError(error, "Could not delete your feedback");
    }
}
