import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import WorkHistory from "./pages/WorkHistory";
import Onboarding from "./pages/Onboarding";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Settings from "./pages/Settings";
import SettingsOverview from "./pages/SettingsOverview";
import SettingsCompany from "./pages/SettingsCompany";
import AdminOnboarding from "./pages/AdminOnboarding";
import PayslipReview from "./pages/PayslipReview";
import Payslips from "./pages/Payslips";
import PayslipDetails from "./pages/PayslipDetails";
import AdminUserDetails from "./pages/AdminUserDetails";
import AdminPayslipDetails from "./pages/AdminPayslipDetails";
import AdminUsers from "./pages/AdminUsers";
import RequireActiveUser from "./components/RequireActiveUser";
import RequireOnboarding from "./components/RequireOnboarding";
import RequireAdmin from "./components/RequireAdmin";

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
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
            <Route
                path="/admin/payslip-review"
                element={
                    <RequireActiveUser>
                        <RequireAdmin>
                            <PayslipReview />
                        </RequireAdmin>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/payslips"
                element={
                    <RequireActiveUser>
                        <Payslips />
                    </RequireActiveUser>
                }
            />
            <Route
                path="/payslips/:payslipId"
                element={
                    <RequireActiveUser>
                        <PayslipDetails />
                    </RequireActiveUser>
                }
            />
            <Route
                path="/settings"
                element={
                    <RequireActiveUser>
                        <Settings />
                    </RequireActiveUser>
                }
            >
                <Route index element={<SettingsOverview />} />
                <Route path="company" element={<SettingsCompany />} />
            </Route>
            <Route
                path="/admin/user/:userId"
                element={
                    <RequireActiveUser>
                        <RequireAdmin>
                            <AdminUserDetails />
                        </RequireAdmin>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/admin/payslip/:payslipId"
                element={
                    <RequireActiveUser>
                        <RequireAdmin>
                            <AdminPayslipDetails />
                        </RequireAdmin>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/admin/users"
                element={
                    <RequireActiveUser>
                        <RequireAdmin>
                            <AdminUsers />
                        </RequireAdmin>
                    </RequireActiveUser>
                }
            />
            <Route path="/" element={<Home />} />
        </Routes>
    );
}
