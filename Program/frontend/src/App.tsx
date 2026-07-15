import { Navigate, Route, Routes, useParams } from "react-router-dom";
import Login from "./pages/Login";
import Application from "./pages/Application";
import Dashboard from "./pages/Dashboard";
import Management from "./pages/Management";
import Finance from "./pages/Finance";
import { ManagementWorkHistory } from "./pages/WorkHistory";
import WorkHistoryShiftDetail from "./pages/WorkHistoryShiftDetail";
import TravelClaims from "./pages/TravelClaims";
import Messages from "./pages/Messages";
import MyPlanning from "./pages/MyPlanning";
import MyPlanningShiftDetail from "./pages/MyPlanningShiftDetail";
import Onboarding from "./pages/Onboarding";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Account from "./pages/Account";
import AccountPersonalInfo from "./pages/AccountPersonalInfo";
import AccountBankDetails from "./pages/AccountBankDetails";
import AccountEmploymentDetails from "./pages/AccountEmploymentDetails";
import AccountContractSign from "./pages/AccountContractSign";
import SettingsCompany from "./pages/SettingsCompany";
import AdminOnboarding from "./pages/AdminOnboarding";
import AdminOnboardingReview from "./pages/AdminOnboardingReview";
import AdminOnboardingReviewDetails from "./pages/AdminOnboardingReviewDetails";
import AdminApplications from "./pages/AdminApplications";
import AdminApplicationDetails from "./pages/AdminApplicationDetails";
import AdminContracts from "./pages/AdminContracts";
import PayslipReview from "./pages/PayslipReview";
import Payslips from "./pages/Payslips";
import MyFinance from "./pages/MyFinance";
import MyFinanceOverview from "./pages/MyFinanceOverview";
import MyFinancePayslips from "./pages/MyFinancePayslips";
import MyFinanceWorkHistory from "./pages/MyFinanceWorkHistory";
import MyFinanceContract from "./pages/MyFinanceContract";
import MyFinanceDocuments from "./pages/MyFinanceDocuments";
import PayslipDetails from "./pages/PayslipDetails";
import AdminUserDetails from "./pages/AdminUserDetails";
import AdminPayslipDetails from "./pages/AdminPayslipDetails";
import AdminUsers from "./pages/AdminUsers";
import HorecaPayrollRules from "./pages/HorecaPayrollRules";
import ContractRules from "./pages/ContractRules";
import PayrollFinance from "./pages/PayrollFinance";
import AdminAuditLog from "./pages/AdminAuditLog";
import AdminMessages from "./pages/AdminMessages";
import AdminEmailPresets from "./pages/AdminEmailPresets";
import AdminPlanningOverview from "./pages/AdminPlanningOverview";
import AdminPlanningClients from "./pages/AdminPlanningClients";
import AdminPlanningClientDetail from "./pages/AdminPlanningClientDetail";
import AdminPlanningClientBillingRates from "./pages/AdminPlanningClientBillingRates";
import AdminPlanningClientGeneralInfo from "./pages/AdminPlanningClientGeneralInfo";
import AdminPlanningClientLocations from "./pages/AdminPlanningClientLocations";
import AdminPlanningLocations from "./pages/AdminPlanningLocations";
import AdminPlanningProjectDetail from "./pages/AdminPlanningProjectDetail";
import AdminPlanningShiftDetail from "./pages/AdminPlanningShiftDetail";
import PlatformAdminCompanies from "./pages/PlatformAdminCompanies";
import PlatformAdminCompanyDetails from "./pages/PlatformAdminCompanyDetails";
import PlatformAdminHome from "./pages/PlatformAdminHome";
import PlatformAdminOnboarding from "./pages/PlatformAdminOnboarding";
import RequireActiveUser from "./components/RequireActiveUser";
import RequireOnboarding from "./components/RequireOnboarding";
import RequirePermission from "./components/RequirePermission";
import FeedbackWidget from "./components/FeedbackWidget";
import {
    APPLICATION_REVIEW_PERMISSIONS,
    BILLING_RATE_PERMISSIONS,
    CAO_MANAGEMENT_PERMISSIONS,
    COMPANY_SETTINGS_PERMISSIONS,
    CONTRACT_WORKSPACE_PERMISSIONS,
    FINANCE_HUB_PERMISSIONS,
    MANAGEMENT_PERMISSIONS,
    ONBOARDING_REVIEW_PERMISSIONS,
    PAYROLL_FINANCE_PERMISSIONS,
    PLATFORM_ADMIN_PERMISSION,
} from "./utils/permissionPolicy";

function RedirectAdminUser() {
    const { userId } = useParams();
    return <Navigate to={`/management/users/${userId ?? ""}`} replace />;
}

function RedirectAdminPayslip() {
    const { payslipId } = useParams();
    return <Navigate to={`/management/payslips/${payslipId ?? ""}`} replace />;
}

function RedirectAdminPlanningProject() {
    const { projectId, eventId } = useParams();
    const resolvedProjectId = projectId ?? eventId;
    return <Navigate to={`/management/planning/projects/${resolvedProjectId ?? ""}`} replace />;
}

function RedirectAdminPlanningShift() {
    const { projectId, eventId, shiftId } = useParams();
    const resolvedProjectId = projectId ?? eventId;
    return <Navigate to={`/management/planning/projects/${resolvedProjectId ?? ""}/shifts/${shiftId ?? ""}`} replace />;
}

// eslint-disable-next-line react-refresh/only-export-components
export function contractSignPath(contractId?: string) {
    return `/contracts/${contractId ?? ""}/sign`;
}

function RedirectNestedContractSign() {
    const { contractId } = useParams();
    return <Navigate to={contractSignPath(contractId)} replace />;
}

export default function App() {
    return (
        <Routes>
            <Route
                path="/apply"
                element={
                    <>
                        <Application />
                        <FeedbackWidget floating />
                    </>
                }
            />
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
                path="/my-planning"
                element={
                    <RequireActiveUser>
                        <MyPlanning />
                    </RequireActiveUser>
                }
            />
            <Route
                path="/my-planning/:scheduleEntryId"
                element={
                    <RequireActiveUser>
                        <MyPlanningShiftDetail />
                    </RequireActiveUser>
                }
            />
            {/* The standalone employee work-history page was removed: past shifts
                live in My planning's Past tab and the logged-hours/travel table in
                My finance -> Work history. Old links keep working via redirects.
                The management work-history (below) is unchanged. */}
            <Route path="/work-history" element={<Navigate to="/my-planning?tab=past" replace />} />
            <Route path="/work-history/:timesheetId" element={<Navigate to="/my-finance/work-history" replace />} />
            <Route
                path="/messages"
                element={
                    <RequireActiveUser>
                        <Messages />
                    </RequireActiveUser>
                }
            />
            <Route
                path="/platform"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission={PLATFORM_ADMIN_PERMISSION}>
                            <PlatformAdminHome />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/platform/onboarding"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission={PLATFORM_ADMIN_PERMISSION}>
                            <PlatformAdminOnboarding />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/platform/companies"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission={PLATFORM_ADMIN_PERMISSION}>
                            <PlatformAdminCompanies />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/platform/companies/:companyId"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission={PLATFORM_ADMIN_PERMISSION}>
                            <PlatformAdminCompanyDetails />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management"
                element={
                    <RequireActiveUser>
                        <RequirePermission anyOf={MANAGEMENT_PERMISSIONS}>
                            <Management />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/work-history"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_VIEW_ALL_TIMESHEETS">
                            <ManagementWorkHistory />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/work-history/:timesheetId"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_VIEW_ALL_TIMESHEETS">
                            <WorkHistoryShiftDetail />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/onboarding"
                element={
                    <RequireOnboarding>
                        <Onboarding />
                        <FeedbackWidget floating />
                    </RequireOnboarding>
                }
            />
            <Route
                path="/management/applications"
                element={
                    <RequireActiveUser>
                        <RequirePermission anyOf={APPLICATION_REVIEW_PERMISSIONS}>
                            <AdminApplications />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/applications/:applicationId"
                element={
                    <RequireActiveUser>
                        <RequirePermission anyOf={APPLICATION_REVIEW_PERMISSIONS}>
                            <AdminApplicationDetails />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/onboarding"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_ONBOARD_USERS">
                            <AdminOnboarding />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/onboarding-review"
                element={
                    <RequireActiveUser>
                        <RequirePermission anyOf={ONBOARDING_REVIEW_PERMISSIONS}>
                            <AdminOnboardingReview />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/onboarding-review/:userId"
                element={
                    <RequireActiveUser>
                        <RequirePermission anyOf={ONBOARDING_REVIEW_PERMISSIONS}>
                            <AdminOnboardingReviewDetails />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/contracts"
                element={
                    <RequireActiveUser>
                        <RequirePermission anyOf={CONTRACT_WORKSPACE_PERMISSIONS}>
                            <AdminContracts />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/payslip-review"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_REVIEW_PAYSLIPS">
                            <PayslipReview />
                        </RequirePermission>
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
                path="/my-finance"
                element={
                    <RequireActiveUser>
                        <MyFinance />
                    </RequireActiveUser>
                }
            >
                <Route index element={<MyFinanceOverview />} />
                <Route
                    path="payslips"
                    element={
                        <RequirePermission anyOf={["CAN_VIEW_PAYSLIPS", "CAN_VIEW_ALL_PAYSLIPS"]}>
                            <MyFinancePayslips />
                        </RequirePermission>
                    }
                />
                <Route path="work-history" element={<MyFinanceWorkHistory />} />
                <Route
                    path="contract"
                    element={
                        <RequirePermission anyOf={["CAN_VIEW_OWN_CONTRACTS", "CAN_VIEW_ALL_CONTRACTS"]}>
                            <MyFinanceContract />
                        </RequirePermission>
                    }
                />
                <Route
                    path="documents"
                    element={
                        <RequirePermission anyOf={["CAN_VIEW_PAYSLIPS", "CAN_VIEW_ALL_PAYSLIPS"]}>
                            <MyFinanceDocuments />
                        </RequirePermission>
                    }
                />
            </Route>
            <Route
                path="/account/employment/contracts/:contractId/sign"
                element={<RedirectNestedContractSign />}
            />
            <Route
                path="/contracts/:contractId/sign"
                element={
                    <RequireActiveUser>
                        <AccountContractSign />
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
                <Route
                    path="company"
                    element={
                        <RequirePermission anyOf={COMPANY_SETTINGS_PERMISSIONS}>
                            <SettingsCompany />
                        </RequirePermission>
                    }
                />
            </Route>
            <Route path="/profile" element={<Navigate to="/account" replace />} />
            <Route path="/settings/company" element={<Navigate to="/account/company" replace />} />
            <Route path="/settings" element={<Navigate to="/account" replace />} />
            <Route
                path="/management/users/:userId/billing-rates"
                element={
                    <RequireActiveUser>
                        <RequirePermission anyOf={["CAN_VIEW_USERS", ...ONBOARDING_REVIEW_PERMISSIONS]}>
                            <RequirePermission anyOf={BILLING_RATE_PERMISSIONS}>
                                <AdminUserDetails />
                            </RequirePermission>
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/users/:userId"
                element={
                    <RequireActiveUser>
                        <RequirePermission anyOf={["CAN_VIEW_USERS", ...ONBOARDING_REVIEW_PERMISSIONS]}>
                            <AdminUserDetails />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/payslips/:payslipId"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_VIEW_ALL_PAYSLIPS">
                            <AdminPayslipDetails />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/users"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_VIEW_USERS">
                            <AdminUsers />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/messages"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_MANAGE_MESSAGES">
                            <AdminMessages />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/planning"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_MANAGE_PLANNING">
                            <AdminPlanningOverview />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/planning/projects/:projectId"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_MANAGE_PLANNING">
                            <AdminPlanningProjectDetail />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/planning/projects/:projectId/shifts/:shiftId"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_MANAGE_PLANNING">
                            <AdminPlanningShiftDetail />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route path="/management/planning/events/:eventId" element={<RedirectAdminPlanningProject />} />
            <Route path="/management/planning/events/:eventId/shifts/:shiftId" element={<RedirectAdminPlanningShift />} />
            <Route
                path="/management/contract-rules"
                element={
                    <RequireActiveUser>
                        <RequirePermission anyOf={CAO_MANAGEMENT_PERMISSIONS}>
                            <ContractRules />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/horeca-payroll-rules"
                element={
                    <RequireActiveUser>
                        <RequirePermission anyOf={CAO_MANAGEMENT_PERMISSIONS}>
                            <HorecaPayrollRules />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/finance"
                element={
                    <RequireActiveUser>
                        <RequirePermission anyOf={FINANCE_HUB_PERMISSIONS}>
                            <Finance />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/payroll-finance"
                element={
                    <RequireActiveUser>
                        <RequirePermission anyOf={PAYROLL_FINANCE_PERMISSIONS}>
                            <PayrollFinance />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route path="/management/cao" element={<Navigate to="/management/horeca-payroll-rules" replace />} />
            <Route path="/management/cao/:caoId" element={<Navigate to="/management/horeca-payroll-rules" replace />} />
            <Route
                path="/management/clients"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_MANAGE_PLANNING">
                            <AdminPlanningClients />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/clients/:clientCompanyId"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_MANAGE_PLANNING">
                            <AdminPlanningClientDetail />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            >
                <Route index element={<AdminPlanningClientGeneralInfo />} />
                <Route path="locations" element={<AdminPlanningClientLocations />} />
                <Route
                    path="billing-rates"
                    element={
                        <RequirePermission anyOf={BILLING_RATE_PERMISSIONS}>
                            <AdminPlanningClientBillingRates />
                        </RequirePermission>
                    }
                />
            </Route>
            <Route
                path="/management/audit-log"
                element={
                    <RequireActiveUser>
                        <RequirePermission anyOf={CAO_MANAGEMENT_PERMISSIONS}>
                            <AdminAuditLog />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/locations"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_MANAGE_PLANNING">
                            <AdminPlanningLocations />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/email-presets"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_MANAGE_MESSAGES">
                            <AdminEmailPresets />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route
                path="/management/travel-claims"
                element={
                    <RequireActiveUser>
                        <RequirePermission permission="CAN_MANAGE_TIMESHEETS">
                            <TravelClaims />
                        </RequirePermission>
                    </RequireActiveUser>
                }
            />
            <Route path="/travel-claims" element={<Navigate to="/management/travel-claims" replace />} />
            <Route path="/admin/users" element={<Navigate to="/management/users" replace />} />
            <Route path="/admin/user/:userId" element={<RedirectAdminUser />} />
            <Route path="/admin/onboarding" element={<Navigate to="/management/onboarding" replace />} />
            <Route path="/admin/payslip-review" element={<Navigate to="/management/payslip-review" replace />} />
            <Route path="/admin/payslip/:payslipId" element={<RedirectAdminPayslip />} />
            <Route path="/admin/planning" element={<Navigate to="/management/planning" replace />} />
            <Route path="/admin/planning/projects/:projectId" element={<RedirectAdminPlanningProject />} />
            <Route path="/admin/planning/projects/:projectId/shifts/:shiftId" element={<RedirectAdminPlanningShift />} />
            <Route path="/admin/planning/events/:eventId" element={<RedirectAdminPlanningProject />} />
            <Route path="/admin/planning/events/:eventId/shifts/:shiftId" element={<RedirectAdminPlanningShift />} />
            <Route path="/admin/clients" element={<Navigate to="/management/clients" replace />} />
            <Route path="/admin/locations" element={<Navigate to="/management/locations" replace />} />
            <Route
                path="/"
                element={
                    <RequireActiveUser>
                        <Navigate to="/dashboard" replace />
                    </RequireActiveUser>
                }
            />
        </Routes>
    );
}
