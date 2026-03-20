import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthServices } from "../services/auth-service/AuthServices";
import Spinner from "./Spinner";
import { spinnerTextForPath } from "./spinnerText";
import { readCachedPermissions, writeCachedPermissions } from "../utils/authCache";

type RequirePermissionProps = {
    permission: string;
    children: React.ReactNode;
};

export default function RequirePermission({ permission, children }: RequirePermissionProps) {
    const location = useLocation();
    const cachedPermissions = useMemo(() => readCachedPermissions(), []);
    const [permissions, setPermissions] = useState<string[] | null>(cachedPermissions);

    useEffect(() => {
        let cancelled = false;

        AuthServices.getPermissions()
            .then((value) => {
                if (cancelled) return;
                const next = value ?? [];
                setPermissions(next);
                writeCachedPermissions(next);
            })
            .catch(() => {
                if (!cancelled && cachedPermissions === null) setPermissions([]);
            });

        return () => {
            cancelled = true;
        };
    }, [cachedPermissions]);

    if (permissions === null) {
        return <Spinner text={spinnerTextForPath(location.pathname)} />;
    }

    if (!permissions.includes(permission)) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
}
