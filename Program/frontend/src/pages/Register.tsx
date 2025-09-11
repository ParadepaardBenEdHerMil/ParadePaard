import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

type RegisterResponse = { token: string };

export default function Register() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErrorMsg(null);

        if (password !== confirm) {
            setErrorMsg("Passwords do not match");
            return;
        }

        try {
            setLoading(true);
            const response = await axios.post<RegisterResponse>(
                "http://localhost:4004/auth/register",
                { email, password },
                { headers: { "Content-Type": "application/json" } }
            );
            if (!response.data?.token) throw new Error("No token in response");
            localStorage.setItem("accessToken", `Bearer ${response.data.token}`);
            navigate("/");
        } catch (err) {
            const msg = axios.isAxiosError(err)
                ? err.response?.data?.error || err.message
                : "Register failed";
            setErrorMsg(String(msg));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ maxWidth: 380, margin: "80px auto", padding: 20 }}>
            <h1 style={{ marginBottom: 16 }}>Register</h1>

            <form onSubmit={handleSubmit}>
                <label>
                    Email
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.currentTarget.value)}
                        required
                        placeholder="you@example.com"
                        style={{ width: "100%", padding: 10, marginTop: 6, marginBottom: 12 }}
                    />
                </label>

                <label>
                    Password
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.currentTarget.value)}
                        required
                        placeholder="Your password"
                        style={{ width: "100%", padding: 10, marginTop: 6, marginBottom: 12 }}
                    />
                </label>

                <label>
                    Confirm password
                    <input
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.currentTarget.value)}
                        required
                        placeholder="Repeat password"
                        style={{ width: "100%", padding: 10, marginTop: 6, marginBottom: 12 }}
                    />
                </label>

                {errorMsg && (
                    <div style={{ color: "red", marginBottom: 12 }}>{errorMsg}</div>
                )}

                <button type="submit" disabled={loading} style={{ width: "100%", padding: 12 }}>
                    {loading ? "Creating account..." : "Create account"}
                </button>
            </form>

            <p style={{ marginTop: 12 }}>
                Already have an account? <Link to="/login">Login</Link>
            </p>
        </div>
    );
}
