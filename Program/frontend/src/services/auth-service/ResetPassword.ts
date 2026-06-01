import axios, { AxiosError } from "axios";

type ResetPasswordErrorBody = {
    code?: string;
    message?: string;
};

// Fallback messages used when the backend returns a known code but no message,
// or when the network call fails before we can read a body.
const CODE_MESSAGES: Record<string, string> = {
    MISSING_TOKEN:
        "Reset token is missing. Please open the link from your password reset email again.",
    INVALID_TOKEN:
        "This password reset link is not valid. Please request a new one.",
    EXPIRED_TOKEN:
        "Your password reset link has expired. Please request a new one.",
    TOKEN_ALREADY_USED:
        "This reset link has already been used. Please request a new one to change your password again.",
    USER_NOT_FOUND:
        "We could not find an account for this reset link. Please request a new one.",
    SERVER_MISCONFIGURED:
        "Password reset is temporarily unavailable. Please try again later or contact support.",
};

export class ResetPasswordError extends Error {
    readonly code: string;
    readonly status?: number;

    constructor(code: string, message: string, status?: number) {
        super(message);
        this.name = "ResetPasswordError";
        this.code = code;
        this.status = status;
    }
}

export default async function ResetPassword(
    token: string,
    newPassword: string,
    API_BASE_URL: string
): Promise<void> {
    try {
        await axios.post(
            `${API_BASE_URL}/auth/reset-password`,
            { token, newPassword },
            {
                headers: { "Content-Type": "application/json" },
                withCredentials: true,
            }
        );
    } catch (err) {
        throw toResetPasswordError(err);
    }
}

function toResetPasswordError(err: unknown): ResetPasswordError {
    if (axios.isAxiosError(err)) {
        const axiosErr = err as AxiosError<ResetPasswordErrorBody>;
        const status = axiosErr.response?.status;
        const body = axiosErr.response?.data;
        const code = body?.code ?? statusToCode(status);
        const message =
            body?.message ??
            CODE_MESSAGES[code] ??
            defaultMessageForStatus(status);
        return new ResetPasswordError(code, message, status);
    }
    if (err instanceof Error) {
        return new ResetPasswordError("UNKNOWN", err.message);
    }
    return new ResetPasswordError(
        "UNKNOWN",
        "Something went wrong while resetting your password. Please try again."
    );
}

function statusToCode(status?: number): string {
    if (status === 400) return "INVALID_TOKEN";
    if (status === 401 || status === 403) return "NOT_AUTHORIZED";
    if (status && status >= 500) return "SERVER_ERROR";
    if (status === undefined) return "NETWORK_ERROR";
    return "UNKNOWN";
}

function defaultMessageForStatus(status?: number): string {
    if (status === undefined) {
        return "Could not reach the server. Please check your connection and try again.";
    }
    if (status >= 500) {
        return "The server ran into a problem resetting your password. Please try again in a moment.";
    }
    if (status === 400) {
        return "Your password reset link is invalid or has expired. Please request a new one.";
    }
    return `Reset password failed (status ${status}). Please request a new reset link.`;
}
