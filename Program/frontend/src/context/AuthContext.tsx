import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthServices } from "../services/auth-service/AuthServices";
import { UserServices } from "../services/user-service/UserServices";
import { readCachedPermissions, writeCachedPermissions } from "../utils/authCache";
import { publishActiveIdentity, subscribeToIdentityChange } from "../utils/authSync";
import {
    hasAllPermissions as policyHasAllPermissions,
    hasAnyPermission as policyHasAnyPermission,
    hasPermission as policyHasPermission,
} from "../utils/permissionPolicy";

export type UserStatus =
    | "PENDING_SETUP"
    | "PENDING_PROFILE_REVIEW"
    | "CHANGES_REQUESTED"
    | "PENDING_CONTRACT_SIGNATURE"
    | "PENDING_CONTRACT_REVIEW"
    | "ACTIVE";

const USER_STATUSES: UserStatus[] = [
    "PENDING_SETUP",
    "PENDING_PROFILE_REVIEW",
    "CHANGES_REQUESTED",
    "PENDING_CONTRACT_SIGNATURE",
    "PENDING_CONTRACT_REVIEW",
    "ACTIVE",
];

export const normalizeUserStatus = (status?: string | null): UserStatus | null => {
    return USER_STATUSES.includes(status as UserStatus) ? (status as UserStatus) : null;
};

export const shouldRefreshPermissionsForStatus = (status: UserStatus | null) => status !== null;

// Whether the permissions-clearing branch should run. We only clear once auth
// has genuinely resolved to logged-out (status null AND initial load finished).
// During the cold-load window `status` is still null but `loading` is true; the
// status effect runs on mount, well before refreshStatus() resolves, so clearing
// then would flip permissionsLoading to false before the real permissions fetch
// starts. RequirePermission would read the empty permissions as "denied" and
// bounce deep-linked management URLs to /dashboard. See permissionsLoading seed.
export const shouldClearPermissionsState = (status: UserStatus | null, loading: boolean) =>
    !shouldRefreshPermissionsForStatus(status) && !loading;

type AuthContextValue = {
    status: UserStatus | null;
    loading: boolean;
    permissions: string[];
    permissionsLoading: boolean;
    permissionsError: string | null;
    setStatus: (status: UserStatus | null) => void;
    refreshStatus: () => Promise<UserStatus | null>;
    refreshPermissions: () => Promise<string[]>;
    hasPermission: (permission: string) => boolean;
    hasAnyPermission: (permissions: string[]) => boolean;
    hasAllPermissions: (permissions: string[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const cachedPermissions = useMemo(() => readCachedPermissions(), []);
    // C3: tokens live in httpOnly cookies, never in local/session storage, so the old
    // getCachedStatus() token lookup was always null. Status is resolved via refreshStatus().
    const [status, setStatus] = useState<UserStatus | null>(null);
    const [loading, setLoading] = useState(status === null);
    const [permissions, setPermissions] = useState<string[]>(cachedPermissions ?? []);
    // On a cold page load `status` is always still null (httpOnly-cookie auth is
    // resolved async), so we can't derive this from `status`. Seed it from whether
    // we actually have usable cached permissions: no cache => we ARE about to fetch,
    // so treat permissions as loading. This keeps RequirePermission showing a spinner
    // (deny-by-default) instead of briefly reading empty permissions as "denied" and
    // bouncing deep-linked management URLs to /dashboard.
    const [permissionsLoading, setPermissionsLoading] = useState(cachedPermissions === null);
    const [permissionsError, setPermissionsError] = useState<string | null>(null);
    // The user id this tab is currently authenticated as. Kept in a ref (it never
    // needs to trigger a render) so the cross-tab listener can tell a real
    // identity swap from another tab re-publishing the same identity.
    const identityRef = useRef<string | null>(null);
    // Set once we start reloading after a cross-tab identity change, so a burst of
    // storage events can't kick off several reloads.
    const reloadingRef = useRef(false);

    const refreshStatus = useCallback(async (): Promise<UserStatus | null> => {
        try {
            const me = await UserServices.getMe();
            const normalized = normalizeUserStatus(me.status);
            setStatus(normalized);
            identityRef.current = me.userId;
            publishActiveIdentity(me.userId);
            return normalized;
        } catch {
            setStatus(null);
            setPermissions([]);
            identityRef.current = null;
            publishActiveIdentity(null);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const refreshPermissions = useCallback(async () => {
        try {
            setPermissionsLoading(true);
            setPermissionsError(null);
            const next = await AuthServices.getPermissions();
            const normalized = next ?? [];
            setPermissions(normalized);
            writeCachedPermissions(normalized);
            return normalized;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load permissions";
            setPermissionsError(message);
            setPermissions([]);
            return [];
        } finally {
            setPermissionsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refreshStatus();
    }, [refreshStatus]);

    // When another tab logs in as a different user or logs out, the shared cookie
    // has already changed under this tab. Reload so this tab re-derives its auth
    // state from the current cookie from scratch — the same thing a manual reload
    // does. We deliberately do NOT patch state in place: that would race the other
    // tab's in-flight login/logout and can strand this tab on a stale screen or a
    // stuck spinner.
    useEffect(() => {
        return subscribeToIdentityChange(
            () => identityRef.current,
            () => {
                if (reloadingRef.current) return;
                reloadingRef.current = true;
                window.location.reload();
            }
        );
    }, []);

    useEffect(() => {
        if (shouldRefreshPermissionsForStatus(status)) {
            void refreshPermissions();
        } else if (shouldClearPermissionsState(status, loading)) {
            setPermissions([]);
            setPermissionsLoading(false);
            setPermissionsError(null);
        }
    }, [loading, refreshPermissions, status]);

    useEffect(() => {
        try {
            if (status) {
                localStorage.setItem("userStatus", status);
            } else {
                localStorage.removeItem("userStatus");
            }
        } catch {
            // ignore storage failures
        }
    }, [status]);

    const hasPermission = useCallback(
        (permission: string) => policyHasPermission(permissions, permission),
        [permissions]
    );

    const hasAnyPermission = useCallback(
        (required: string[]) => policyHasAnyPermission(permissions, required),
        [permissions]
    );

    const hasAllPermissions = useCallback(
        (required: string[]) => policyHasAllPermissions(permissions, required),
        [permissions]
    );

    const value = useMemo(
        () => ({
            status,
            loading,
            permissions,
            permissionsLoading,
            permissionsError,
            setStatus,
            refreshStatus,
            refreshPermissions,
            hasPermission,
            hasAnyPermission,
            hasAllPermissions,
        }),
        [
            status,
            loading,
            permissions,
            permissionsLoading,
            permissionsError,
            refreshStatus,
            refreshPermissions,
            hasPermission,
            hasAnyPermission,
            hasAllPermissions,
        ]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return ctx;
}
