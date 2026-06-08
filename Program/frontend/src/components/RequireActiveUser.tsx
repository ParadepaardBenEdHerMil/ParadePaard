import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canAccessManagement } from "../utils/permissionPolicy";
import Spinner from "./Spinner";
import { spinnerTextForPath } from "./spinnerText";

export default function RequireActiveUser({ children }: { children: React.ReactNode }) {
    const { status, loading, permissions } = useAuth();
    const location = useLocation();

    const resetToken = localStorage.getItem("passwordResetToken");
    if (resetToken) {
        return (
            <Navigate
                to={`/reset-password?token=${encodeURIComponent(resetToken)}&next=${encodeURIComponent(location.pathname)}`}
                replace
            />
        );
    }

    if (loading) {
        return <Spinner text={spinnerTextForPath(location.pathname)} />;
    }
    const isContractSigningRoute =
        location.pathname.startsWith("/contracts/") && location.pathname.endsWith("/sign");
    if (
        !canAccessManagement(permissions) &&
        (status === "PENDING_SETUP" ||
            (status === "PENDING_PROFILE_REVIEW" && !isContractSigningRoute) ||
            status === "CHANGES_REQUESTED" ||
            status === "PENDING_CONTRACT_REVIEW")
    ) {
        return <Navigate to="/onboarding" replace />;
    }
    if (!status) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
}
