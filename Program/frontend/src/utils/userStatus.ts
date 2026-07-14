// Shared admin-facing labels for the employee onboarding -> active lifecycle. Collapses the
// granular UserStatus enum into the buckets managers care about (Onboarding / Contract pending
// / Active / Disabled), and folds the auth account-disabled gate in so a rejected-but-reopened
// account reads as the transient "Enabled".
//
// Pass `disabled` (from the auth account-state) where it's known (the user-detail page). Where
// it isn't (the users list), REJECTED alone renders as "Disabled".

export type UserStatusTone = "ok" | "warn" | "bad" | "sub";

type UserStatusOpts = { disabled?: boolean };

function normalize(status?: string | null): string {
    return (status ?? "").trim().toUpperCase();
}

export function userStatusLabel(status?: string | null, opts?: UserStatusOpts): string {
    const normalized = normalize(status);
    if (normalized === "REJECTED") {
        // A rejected user whose auth account has been re-enabled is mid-reopening: "Enabled".
        return opts?.disabled === false ? "Enabled" : "Disabled";
    }
    if (opts?.disabled) return "Disabled";
    if (normalized === "ACTIVE") return "Active";
    if (
        normalized === "PENDING_SETUP" ||
        normalized === "PENDING_PROFILE_REVIEW" ||
        normalized === "CHANGES_REQUESTED"
    ) {
        return "Onboarding";
    }
    if (normalized === "PENDING_CONTRACT_SIGNATURE" || normalized === "PENDING_CONTRACT_REVIEW") {
        return "Contract pending";
    }
    return status ?? "-";
}

export function userStatusTone(status?: string | null, opts?: UserStatusOpts): UserStatusTone {
    const normalized = normalize(status);
    if (normalized === "REJECTED") {
        return opts?.disabled === false ? "warn" : "bad";
    }
    if (opts?.disabled) return "bad";
    if (normalized === "ACTIVE") return "ok";
    if (
        normalized === "PENDING_SETUP" ||
        normalized === "PENDING_PROFILE_REVIEW" ||
        normalized === "CHANGES_REQUESTED" ||
        normalized === "PENDING_CONTRACT_SIGNATURE" ||
        normalized === "PENDING_CONTRACT_REVIEW"
    ) {
        return "warn";
    }
    return "sub";
}

// Maps the tone to the AdminLists cell class used across the admin tables.
export function userStatusCellClass(status?: string | null, opts?: UserStatusOpts): string {
    const tone = userStatusTone(status, opts);
    if (tone === "ok") return "cellOk";
    if (tone === "warn") return "cellWarn";
    if (tone === "bad") return "cellBad";
    return "cellSub";
}

// Stable bucket options for the Users-page status filter (label doubles as the filter value).
export const USER_STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
    { value: "Onboarding", label: "Onboarding" },
    { value: "Contract pending", label: "Contract pending" },
    { value: "Active", label: "Active" },
    { value: "Disabled", label: "Disabled" },
];
