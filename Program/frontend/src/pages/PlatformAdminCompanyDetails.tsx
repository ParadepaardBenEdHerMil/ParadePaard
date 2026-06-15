import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import PageBack from "../components/PageBack";
import Card from "../components/common/Card";
import CompanyManagementAction from "../components/platform/CompanyManagementAction";
import { usePlatformAdmin } from "../context/PlatformAdminContext";
import { UserServices, type PlatformCompanyDetailDTO } from "../services/user-service/UserServices";
import { toActingCompany } from "../utils/platformCompany";
import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/PlatformAdmin.css";

type PlatformAdminCompanyDetailsProps = {
    initialCompany?: PlatformCompanyDetailDTO;
};

function formatFrequency(minutes?: number | null) {
    if (!minutes || minutes <= 0) return "Not set";
    if (minutes % 10080 === 0) return "Weekly";
    if (minutes % 1440 === 0) return `${Math.round(minutes / 1440)} days`;
    return `${minutes} minutes`;
}

function formatTimesheetMode(mode?: string | null) {
    if (!mode) return "Not set";
    if (mode === "AUTO_ON_SHIFT_END") return "Auto on shift end";
    if (mode === "ADMIN_FINALIZE") return "Admin finalize";
    return mode;
}

function formatTravelClaimMode(mode?: string | null) {
    if (!mode) return "Not set";
    if (mode === "AUTO_APPROVE") return "Auto approve";
    if (mode === "REQUIRES_APPROVAL") return "Requires approval";
    return mode;
}

export default function PlatformAdminCompanyDetails({ initialCompany }: PlatformAdminCompanyDetailsProps) {
    const { companyId = "" } = useParams();
    const { startActingAsCompany } = usePlatformAdmin();
    const [company, setCompany] = useState<PlatformCompanyDetailDTO | null>(initialCompany ?? null);
    const [loading, setLoading] = useState(!initialCompany);
    const [error, setError] = useState<string | null>(null);
    const [currentUserCompanyId, setCurrentUserCompanyId] = useState<string | null | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;

        const loadCurrentUser = async () => {
            try {
                const currentUser = await UserServices.getMe();
                if (!cancelled) setCurrentUserCompanyId(currentUser.companyId ?? null);
            } catch {
                if (!cancelled) setCurrentUserCompanyId(null);
            }
        };

        void loadCurrentUser();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (initialCompany || !companyId) return;
        let cancelled = false;

        const load = async () => {
            try {
                setLoading(true);
                const data = await UserServices.getPlatformCompany(companyId);
                if (!cancelled) setCompany(data);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Could not load company.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [companyId, initialCompany]);

    const handleGoToManagement = async () => {
        if (!company || currentUserCompanyId === undefined || currentUserCompanyId === company.companyId) return;
        try {
            await startActingAsCompany(toActingCompany(company), "/management");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not switch company scope.");
        }
    };

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage platformAdminPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header className="pageHeader">
                            <PageBack to="/platform/companies" />
                            <h1 className="pageTitle">{loading ? "Loading..." : company?.name ?? "Company"}</h1>
                            <p className="pageSubtitle">
                                Review the company snapshot, then open the selected company's management workspace.
                            </p>
                        </header>
                        {error ? (
                            <div className="adminDashboardCard">
                                <Card title="Error"><div className="listEmpty errorText">{error}</div></Card>
                            </div>
                        ) : null}
                        {loading ? (
                            <div className="adminDashboardCard">
                                <Card title="Loading"><div className="listEmpty">Loading company details...</div></Card>
                            </div>
                        ) : null}
                        {company ? (
                            <div className="adminDashboardCard">
                                <div className="companyDetailActions">
                                    <CompanyManagementAction
                                        selectedCompanyId={company.companyId}
                                        currentUserCompanyId={currentUserCompanyId}
                                        onOpen={() => void handleGoToManagement()}
                                    />
                                </div>
                                <Card title="Company settings">
                                    <div className="listContainer">
                                        <div className="listHeaderGrid gridCompanyDetail">
                                            <div>Setting</div>
                                            <div>Value</div>
                                        </div>
                                        <div className="listScrollArea">
                                            <div className="listRowGrid gridCompanyDetail">
                                                <div className="cellMain">Company ID</div>
                                                <div className="cellSub companyDetailMono">{company.companyId}</div>
                                            </div>
                                            <div className="listRowGrid gridCompanyDetail">
                                                <div className="cellMain">Payout frequency</div>
                                                <div className="cellSub">{formatFrequency(company.payoutFrequencyMinutes)}</div>
                                            </div>
                                            <div className="listRowGrid gridCompanyDetail">
                                                <div className="cellMain">Timesheet mode</div>
                                                <div className="cellSub">{formatTimesheetMode(company.timesheetLoggingMode)}</div>
                                            </div>
                                            <div className="listRowGrid gridCompanyDetail">
                                                <div className="cellMain">Travel claim mode</div>
                                                <div className="cellSub">{formatTravelClaimMode(company.travelClaimMode)}</div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                                <Card title="People snapshot">
                                    <div className="listContainer">
                                        <div className="listHeaderGrid gridCompanyDetail">
                                            <div>Metric</div>
                                            <div>Count</div>
                                        </div>
                                        <div className="listScrollArea">
                                            <div className="listRowGrid gridCompanyDetail">
                                                <div className="cellMain">Total team members</div>
                                                <div className="cellSub">{company.totalUsers}</div>
                                            </div>
                                            <div className="listRowGrid gridCompanyDetail">
                                                <div className="cellMain">Active employees</div>
                                                <div className="cellOk">{company.activeUsers}</div>
                                            </div>
                                            <div className="listRowGrid gridCompanyDetail">
                                                <div className="cellMain">Pending onboarding review</div>
                                                <div className={company.pendingOnboardingReview > 0 ? "cellWarn" : "cellSub"}>
                                                    {company.pendingOnboardingReview}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </>
    );
}
