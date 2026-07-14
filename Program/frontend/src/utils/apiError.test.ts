import axios from "axios";
import { describe, expect, it } from "vitest";
import {
    DEFAULT_API_ERROR_MESSAGE,
    FORBIDDEN_MESSAGE,
    extractApiErrorMessage,
    installApiErrorInterceptor,
    resolveApiErrorMessage,
} from "./apiError";

/**
 * Builds an object that satisfies axios.isAxiosError (which checks the
 * `isAxiosError` flag), so we can exercise the extractor without real requests.
 */
function axiosError(response?: { status?: number; data?: unknown }): unknown {
    return {
        isAxiosError: true,
        message: "Request failed with status code 400",
        response: response
            ? { status: response.status ?? 400, data: response.data }
            : undefined,
    };
}

describe("resolveApiErrorMessage", () => {
    it("returns the backend message field (the BSN case)", () => {
        const error = axiosError({
            status: 400,
            data: { message: "Invalid BSN: it does not pass the 11-proef checksum" },
        });
        expect(resolveApiErrorMessage(error)).toBe(
            "Invalid BSN: it does not pass the 11-proef checksum"
        );
    });

    it("joins bean-validation field maps that have no message key", () => {
        const error = axiosError({
            status: 400,
            data: { iban: "IBAN is invalid", postalCode: "Postal code is required" },
        });
        expect(resolveApiErrorMessage(error)).toBe("IBAN is invalid Postal code is required");
    });

    it("reads gateway token errors from the field map", () => {
        const error = axiosError({ status: 400, data: { token: "Token has expired" } });
        expect(resolveApiErrorMessage(error)).toBe("Token has expired");
    });

    it("prefers the message key over other fields", () => {
        const error = axiosError({
            status: 400,
            data: { message: "Email Already Exists", email: "duplicate" },
        });
        expect(resolveApiErrorMessage(error)).toBe("Email Already Exists");
    });

    it("handles a raw string response body", () => {
        const error = axiosError({ status: 400, data: "Plain text failure" });
        expect(resolveApiErrorMessage(error)).toBe("Plain text failure");
    });

    it("falls back to Spring's generic error phrase", () => {
        const error = axiosError({
            status: 404,
            data: { status: 404, error: "Not Found", path: "/api/user/setup", timestamp: "2026-07-08" },
        });
        expect(resolveApiErrorMessage(error)).toBe("Not Found");
    });

    it("gives a clear access message for a 403 with only the generic Forbidden phrase", () => {
        const error = axiosError({
            status: 403,
            data: { status: 403, error: "Forbidden", path: "/auth/roles" },
        });
        expect(resolveApiErrorMessage(error)).toBe(FORBIDDEN_MESSAGE);
    });

    it("still surfaces a specific backend message on a 403", () => {
        const error = axiosError({
            status: 403,
            data: { message: "This company is locked for edits." },
        });
        expect(resolveApiErrorMessage(error)).toBe("This company is locked for edits.");
    });

    it("gives the access message for a 403 with an empty body", () => {
        const error = axiosError({ status: 403, data: "" });
        expect(resolveApiErrorMessage(error)).toBe(FORBIDDEN_MESSAGE);
    });

    it("never surfaces envelope metadata (path/timestamp) as the message", () => {
        const error = axiosError({
            status: 500,
            data: { status: 500, path: "/api/user/setup", timestamp: "2026-07-08" },
        });
        expect(resolveApiErrorMessage(error)).toBeNull();
    });

    it("returns a friendly network message when there is no response", () => {
        const error = axiosError();
        expect(resolveApiErrorMessage(error)).toBe(
            "Cannot reach the server. Please check your connection and try again."
        );
    });

    it("passes through a plain (non-axios) Error message", () => {
        expect(resolveApiErrorMessage(new Error("boom"))).toBe("boom");
    });

    it("returns null for unknown thrown values", () => {
        expect(resolveApiErrorMessage("just a string")).toBeNull();
        expect(resolveApiErrorMessage(undefined)).toBeNull();
    });
});

describe("extractApiErrorMessage", () => {
    it("uses the provided fallback when nothing usable is present", () => {
        const error = axiosError({ status: 500, data: { status: 500 } });
        expect(extractApiErrorMessage(error, "Failed to load billing rates")).toBe(
            "Failed to load billing rates"
        );
    });

    it("uses the default fallback when none is provided", () => {
        expect(extractApiErrorMessage({})).toBe(DEFAULT_API_ERROR_MESSAGE);
    });

    it("returns the backend message when present", () => {
        const error = axiosError({ status: 409, data: { message: "Phone Number Already Exists" } });
        expect(extractApiErrorMessage(error, "fallback")).toBe("Phone Number Already Exists");
    });
});

describe("installApiErrorInterceptor", () => {
    it("rewrites the raw axios message with the backend message end-to-end", async () => {
        installApiErrorInterceptor();

        // A per-request adapter that rejects lets us drive the real axios
        // interceptor chain without any network access.
        const failure = axiosError({
            status: 400,
            data: { message: "Invalid BSN: it does not pass the 11-proef checksum" },
        }) as { message: string };
        const adapter = () => Promise.reject(failure);

        await expect(axios.get("http://example.test/api/user/setup", { adapter })).rejects.toMatchObject({
            isAxiosError: true,
            message: "Invalid BSN: it does not pass the 11-proef checksum",
            response: { status: 400 },
        });
    });
});
