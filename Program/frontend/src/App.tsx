import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import WorkHistory from "./pages/WorkHistory";
import Onboarding from "./pages/Onboarding";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminOnboarding from "./pages/AdminOnboarding";
import RequireActiveUser from "./components/RequireActiveUser";
import RequireOnboarding from "./components/RequireOnboarding";
import RequireAdmin from "./components/RequireAdmin";

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
                path="/dashboard"
                element={
                    <RequireActiveUser>
                        <Dashboard />
                    </RequireActiveUser>
                }
            />
            <Route
                path="/profile"
                element={
                    <RequireActiveUser>
                        <Profile />
                    </RequireActiveUser>
                }
            />
            <Route
                path="/work-history"
                element={
                    <RequireActiveUser>
                        <WorkHistory />
                    </RequireActiveUser>
                }
            />
            <Route
                path="/onboarding"
                element={
                    <RequireOnboarding>
                        <Onboarding />
                    </RequireOnboarding>
                }
            />
            <Route
                path="/admin/onboarding"
                element={
                    <RequireActiveUser>
                        <RequireAdmin>
                            <AdminOnboarding />
                        </RequireAdmin>
                    </RequireActiveUser>
                }
            />
            <Route path="/" element={<Home />} />
        </Routes>
    );
}
