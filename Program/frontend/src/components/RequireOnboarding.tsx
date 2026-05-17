import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Spinner from "./Spinner";
import { spinnerTextForPath } from "./spinnerText";

export default function RequireOnboarding({ children }: { children: React.ReactNode }) {
    const { status, loading } = useAuth();
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
    if (status === "ACTIVE" || status === "PENDING_CONTRACT_SIGNATURE") {
        return <Navigate to="/dashboard" replace />;
    }
    if (!status) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
}
