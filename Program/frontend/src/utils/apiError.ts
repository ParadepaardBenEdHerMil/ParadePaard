import axios from "axios";

/**
 * Turns backend error responses into human-readable messages for the UI.
 *
 * Backend contract (shared by every service's GlobalExceptionHandler):
 *   - business / domain errors  ->  { "message": "Invalid BSN: ..." }
 *   - bean-validation errors     ->  { "<field>": "<message>", ... }  (a field
 *                                    map with NO top-level "message" key)
 *   - gateway JWT errors         ->  { "token": "<message>" }
 *
 * The real message lives in `error.response.data`; a bare AxiosError only
 * carries "Request failed with status code 400". These helpers bridge that gap.
 */

export const DEFAULT_API_ERROR_MESSAGE = "Something went wrong. Please try again.";
const NETWORK_ERROR_MESSAGE = "Cannot reach the server. Please check your connection and try again.";
// Shown for a 403 that carries no specific backend message. The raw "Forbidden" /
// "Request failed with status code 403" is opaque to users; this reads as an
// access problem (usually a session that changed under the tab; the app re-syncs
// in the background) rather than a bug.
export const FORBIDDEN_MESSAGE = "You don't have permission to do this. Your access may have changed — try refreshing the page.";

// Keys that belong to an error *envelope* (our handlers + Spring's default error
// body) rather than to a per-field validation message. We never surface these as
// if they were the error itself (e.g. a path like "/api/user/setup").
const ENVELOPE_KEYS = new Set(["message", "error", "status", "path", "timestamp", "trace", "errors"]);

function nonEmptyString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Extracts a human-readable message from a backend error, or returns null when
 * the error carries nothing worth showing (so callers can fall back).
 */
export function resolveApiErrorMessage(error: unknown): string | null {
    if (!axios.isAxiosError(error)) {
        return error instanceof Error ? nonEmptyString(error.message) : null;
    }

    // No response at all: the request never reached the server or timed out.
    if (!error.response) {
        return NETWORK_ERROR_MESSAGE;
    }

    const data = error.response.data;

    // Some endpoints return the body as a raw string.
    const asString = nonEmptyString(data);
    if (asString) {
        return asString;
    }

    if (data && typeof data === "object") {
        const record = data as Record<string, unknown>;

        // 1) Preferred: an explicit message field.
        const message = nonEmptyString(record.message);
        if (message) {
            return message;
        }

        // 2) Validation / field-error maps: { field: "msg", ... } or { token: "msg" }.
        //    Collect the field-level strings, skipping envelope metadata.
        const fieldMessages = Object.entries(record)
            .filter(([key]) => !ENVELOPE_KEYS.has(key))
            .map(([, value]) => nonEmptyString(value))
            .filter((value): value is string => value !== null);
        if (fieldMessages.length > 0) {
            return fieldMessages.join(" ");
        }

        // 3) A 403 with no specific message above is an authorization failure
        //    (Spring's body is just { error: "Forbidden", status: 403 }). Surface a
        //    clear access message instead of the bare "Forbidden" phrase.
        if (error.response.status === 403) {
            return FORBIDDEN_MESSAGE;
        }

        // 4) Spring's generic error phrase ("Not Found", "Forbidden") as a last resort.
        const errorPhrase = nonEmptyString(record.error);
        if (errorPhrase) {
            return errorPhrase;
        }
    }

    // A 403 whose body is a raw string / empty is still an authorization failure.
    if (axios.isAxiosError(error) && error.response?.status === 403) {
        return FORBIDDEN_MESSAGE;
    }

    return null;
}

/**
 * Like {@link resolveApiErrorMessage} but always returns a string, using
 * `fallback` when the error carries nothing usable. Use this inside service
 * functions that wrap failures in a fresh Error.
 */
export function extractApiErrorMessage(error: unknown, fallback: string = DEFAULT_API_ERROR_MESSAGE): string {
    return resolveApiErrorMessage(error) ?? fallback;
}

let interceptorInstalled = false;

/**
 * Registers a single global axios response interceptor that rewrites the
 * ambiguous default AxiosError message ("Request failed with status code 400")
 * with the backend's human-readable message.
 *
 * The AxiosError itself is preserved and re-rejected, so existing handling that
 * relies on `axios.isAxiosError(err)` / `err.response` / `err.config` keeps
 * working; only `.message` is upgraded. This is what makes surfacing backend
 * messages app-wide: any component that displays `err.message` benefits without
 * per-page changes. Safe to call more than once.
 */
export function installApiErrorInterceptor(): void {
    if (interceptorInstalled) {
        return;
    }
    interceptorInstalled = true;

    axios.interceptors.response.use(
        (response) => response,
        (error: unknown) => {
            if (axios.isAxiosError(error)) {
                const friendly = resolveApiErrorMessage(error);
                if (friendly) {
                    error.message = friendly;
                }
            }
            return Promise.reject(error);
        }
    );
}
