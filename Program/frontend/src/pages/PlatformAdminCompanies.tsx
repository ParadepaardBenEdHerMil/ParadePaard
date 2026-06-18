import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import PageBack from "../components/PageBack";
import Card from "../components/common/Card";
import { UserServices, type PlatformCompanySummaryDTO } from "../services/user-service/UserServices";
import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/PlatformAdmin.css";

type PlatformAdminCompaniesProps = {
    initialCompanies?: PlatformCompanySummaryDTO[];
};

const timesheetLabel = (mode?: string | null) => {
    if (!mode) return "-";
    if (mode === "AUTO_ON_SHIFT_END") return "Auto on shift end";
    if (mode === "ADMIN_FINALIZE") return "Admin finalize";
    return mode;
};

export default function PlatformAdminCompanies({ initialCompanies }: PlatformAdminCompaniesProps) {
    const [companies, setCompanies] = useState<PlatformCompanySummaryDTO[]>(initialCompanies ?? []);
    const [loading, setLoading] = useState(!initialCompanies);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const loadCompanies = useCallback(async () => {
        if (initialCompanies) return;
        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getPlatformCompanies();
            setCompanies(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not load companies.");
        } finally {
            setLoading(false);
        }
    }, [initialCompanies]);

    useEffect(() => {
        void loadCompanies();
    }, [loadCompanies]);

    const filteredCompanies = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return companies;
        return companies.filter((c) => c.name.toLowerCase().includes(term));
    }, [companies, searchTerm]);

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage platformAdminPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header className="pageHeader">
                            <PageBack to="/platform" />
                            <h1 className="pageTitle">Companies</h1>
                            <p className="pageSubtitle">
                                Open a company detail page before entering that company's management workspace.
                            </p>
                        </header>
                        <div className="adminDashboardCard">
                            <Card
                                title="All companies"
                                right={
                                    <div className="adminUsersToolbar">
                                        <div className="adminUsersCount">
                                            {filteredCompanies.length} of {companies.length} companies
                                        </div>
                                        <input
                                            className="adminUsersSearchInput"
                                            type="search"
                                            placeholder="Search by name"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            disabled={loading}
                                        />
                                        <button
                                            className="button buttonSecondary"
                                            onClick={() => void loadCompanies()}
                                            disabled={loading}
                                        >
                                            Refresh
                                        </button>
                                    </div>
                                }
                            >
                                <div className="listContainer">
                                    <div className="listHeaderGrid gridCompanies">
                                        <div>Company</div>
                                        <div>Team members</div>
                                        <div>Active</div>
                                        <div>Pending review</div>
                                        <div>Timesheet mode</div>
                                    </div>
                                    <div className="listScrollArea platformCompaniesScroll">
                                        {loading ? <div className="listEmpty">Loading companies...</div> : null}
                                        {error ? <div className="listEmpty errorText">{error}</div> : null}
                                        {!loading && !error && filteredCompanies.length === 0 ? (
                                            <div className="listEmpty">No companies found.</div>
                                        ) : null}
                                        {!loading && !error
                                            ? filteredCompanies.map((company) => (
                                                  <Link
                                                      key={company.companyId}
                                                      className="listRowGrid gridCompanies clickableRow"
                                                      to={`/platform/companies/${company.companyId}`}
                                                  >
                                                      <div className="cellMain">{company.name}</div>
                                                      <div className="cellSub">
                                                          {company.totalUsers} team member{company.totalUsers === 1 ? "" : "s"}
                                                      </div>
                                                      <div className="cellOk">{company.activeUsers}</div>
                                                      <div className={company.pendingOnboardingReview > 0 ? "cellWarn" : "cellSub"}>
                                                          {company.pendingOnboardingReview}
                                                      </div>
                                                      <div className="cellSub">{timesheetLabel(company.timesheetLoggingMode)}</div>
                                                  </Link>
                                              ))
                                            : null}
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
