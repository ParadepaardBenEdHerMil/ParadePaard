import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthServices } from "../services/auth-service/AuthServices";
import { UserServices } from "../services/user-service/UserServices";
import { readCachedPermissions, writeCachedPermissions } from "../utils/authCache";
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

type AuthContextValue = {
    status: UserStatus | null;
    loading: boolean;
    permissions: string[];
    permissionsLoading: boolean;
    permissionsError: string | null;
    setStatus: (status: UserStatus | null) => void;
    refreshStatus: () => Promise<void>;
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
    const [permissionsLoading, setPermissionsLoading] = useState(status !== null && cachedPermissions === null);
    const [permissionsError, setPermissionsError] = useState<string | null>(null);

    const refreshStatus = useCallback(async () => {
        try {
            const me = await UserServices.getMe();
            setStatus(normalizeUserStatus(me.status));
        } catch {
            setStatus(null);
            setPermissions([]);
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

    useEffect(() => {
        if (shouldRefreshPermissionsForStatus(status)) {
            void refreshPermissions();
        } else {
            setPermissions([]);
            setPermissionsLoading(false);
            setPermissionsError(null);
        }
    }, [refreshPermissions, status]);

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
