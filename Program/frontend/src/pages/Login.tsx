import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthServices } from "../services/auth-service/AuthServices";
import UsernameLabel from "../components/UsernameLabel";
import PasswordLabel from "../components/PasswordLabel.tsx";
import Button from "../components/Button.tsx";
import "../stylesheets/Login.css"
import { UserServices } from "../services/user-service/UserServices";
import { normalizeUserStatus, type UserStatus, useAuth } from "../context/AuthContext";

function routeForStatus(status: UserStatus | null) {
    if (
        status === "PENDING_SETUP" ||
        status === "PENDING_PROFILE_REVIEW" ||
        status === "CHANGES_REQUESTED" ||
        status === "PENDING_CONTRACT_REVIEW"
    ) {
        return "/onboarding";
    }
    return "/dashboard";
}

export default function Login() {
    const navigate = useNavigate();
    const { setStatus, refreshPermissions } = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErrorMsg(null);
        setLoading(true);

        try {
            const response = await AuthServices.login(username, password);
            console.log("Login successful:", response.message);
            const me = await UserServices.getMe();

            const status = normalizeUserStatus(me.status);
            setStatus(status);
            if (status === "ACTIVE") {
                await refreshPermissions();
            }

            if (response.mustChangePassword) {
                const token = response.passwordResetToken;
                if (!token) {
                    throw new Error("Password reset is required but no reset token was provided.");
                }
                localStorage.setItem("passwordResetToken", token);
                const next = routeForStatus(status);
                navigate(`/reset-password?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`);
                return;
            }

            navigate(routeForStatus(status));
        } catch (err: unknown) {
            const errorMessage = err instanceof Error
                ? err.message
                : "An unknown login error occurred";
            setErrorMsg(errorMessage);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-container">
            <h1 className="login-title">Login</h1>
            <form onSubmit={handleSubmit}>
                <UsernameLabel username={username} setUsername={setUsername} />
                <PasswordLabel
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    placeholder="Your password"
                />
                {errorMsg && (<div className="error-message">{errorMsg}</div>)}
                <p className="existing-account">
                    <Link to="/forgot-password">Forgot your password?</Link>
                </p>
                <Button type="submit" loading={loading}>Login</Button>
            </form>
        </div>
    );
}
