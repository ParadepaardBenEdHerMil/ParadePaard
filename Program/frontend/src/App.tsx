import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import WorkHistory from "./pages/WorkHistory";
import Onboarding from "./pages/Onboarding";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Account from "./pages/Account";
import AccountPersonalInfo from "./pages/AccountPersonalInfo";
import AccountBankDetails from "./pages/AccountBankDetails";
import AccountEmploymentDetails from "./pages/AccountEmploymentDetails";
import SettingsCompany from "./pages/SettingsCompany";
import AdminOnboarding from "./pages/AdminOnboarding";
import PayslipReview from "./pages/PayslipReview";
import Payslips from "./pages/Payslips";
import PayslipDetails from "./pages/PayslipDetails";
import AdminUserDetails from "./pages/AdminUserDetails";
import AdminPayslipDetails from "./pages/AdminPayslipDetails";
import AdminUsers from "./pages/AdminUsers";
import AdminPlanningOverview from "./pages/AdminPlanningOverview";
import AdminPlanningClients from "./pages/AdminPlanningClients";
import AdminPlanningEventDetail from "./pages/AdminPlanningEventDetail";
import AdminPlanningShiftDetail from "./pages/AdminPlanningShiftDetail";
import RequireActiveUser from "./components/RequireActiveUser";
import RequireOnboarding from "./components/RequireOnboarding";
import RequireAdmin from "./components/RequireAdmin";
import RequirePermission from "./components/RequirePermission";

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
                path="/account"
                element={
                    <RequireActiveUser>
                        <Account />
                    </RequireActiveUser>
                }
            >
                <Route index element={<AccountPersonalInfo />} />
                <Route path="bank" element={<AccountBankDetails />} />
                <Route path="employment" element={<AccountEmploymentDetails />} />
                <Route path="company" element={<SettingsCompany />} />
            </Route>
            <Route path="/profile" element={<Navigate to="/account" replace />} />
            <Route path="/settings/company" element={<Navigate to="/account/company" replace />} />
            <Route path="/settings" element={<Navigate to="/account" replace />} />
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
            <Route
                path="/admin/planning"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_MANAGE_PLANNING">
                            <AdminPlanningOverview />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/admin/planning/events/:eventId"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_MANAGE_PLANNING">
                            <AdminPlanningEventDetail />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/admin/planning/events/:eventId/shifts/:shiftId"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_MANAGE_PLANNING">
                            <AdminPlanningShiftDetail />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/admin/clients"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_MANAGE_PLANNING">
                            <AdminPlanningClients />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route path="/" element={<Home />} />
        </Routes>
    );
}
