import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import { UserServices, type UserResponseDTO } from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/AdminUsers.css";

const REVIEW_STATUSES = new Set([
    "PENDING_PROFILE_REVIEW",
    "CHANGES_REQUESTED",
    "PENDING_CONTRACT_SIGNATURE",
    "PENDING_CONTRACT_REVIEW",
]);

const STATUS_PRIORITY: Record<string, number> = {
    PENDING_PROFILE_REVIEW: 0,
    PENDING_CONTRACT_REVIEW: 1,
    CHANGES_REQUESTED: 2,
    PENDING_CONTRACT_SIGNATURE: 3,
};

function displayNameForUser(user: UserResponseDTO): string {
    const parts = [user.firstNames, user.middleNamePrefix, user.lastName]
        .map((part) => (part ?? "").trim())
        .filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    const preferred = (user.preferredName ?? "").trim();
    return preferred || user.email;
}

function statusLabel(status?: string | null): string {
    const normalized = (status ?? "").toUpperCase();
    if (normalized === "PENDING_PROFILE_REVIEW") return "Profile review";
    if (normalized === "CHANGES_REQUESTED") return "Changes requested";
    if (normalized === "PENDING_CONTRACT_SIGNATURE") return "Awaiting signature";
    if (normalized === "PENDING_CONTRACT_REVIEW") return "Contract review";
    return status ?? "-";
}

function statusClass(status?: string | null): string {
    const normalized = (status ?? "").toUpperCase();
    if (normalized === "PENDING_CONTRACT_REVIEW" || normalized === "PENDING_PROFILE_REVIEW") return "cellWarn";
    if (normalized === "CHANGES_REQUESTED") return "cellBad";
    return "cellSub";
}

export default function AdminOnboardingReview() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserResponseDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadUsers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getUsers();
            setUsers(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load onboarding review.";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadUsers();
    }, [loadUsers]);

    const reviewUsers = useMemo(() => {
        return users
            .filter((user) => REVIEW_STATUSES.has((user.status ?? "").toUpperCase()))
            .sort((a, b) => {
                const aStatus = (a.status ?? "").toUpperCase();
                const bStatus = (b.status ?? "").toUpperCase();
                const statusSort = (STATUS_PRIORITY[aStatus] ?? 99) - (STATUS_PRIORITY[bStatus] ?? 99);
                if (statusSort !== 0) return statusSort;
                return (b.registeredDate ?? "").localeCompare(a.registeredDate ?? "");
            });
    }, [users]);

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header className="pageHeader">
                            <PageBack label="Back to management" to="/management" />
                            <h1 className="pageTitle">Onboarding review</h1>
                        </header>
                        <div className="adminDashboardCard">
                            <Card
                                title="Review queue"
                                right={
                                    <div className="adminUsersToolbar">
                                        <div className="adminUsersCount">
                                            {reviewUsers.length} open review item{reviewUsers.length === 1 ? "" : "s"}
                                        </div>
                                        <button
                                            className="button buttonSecondary"
                                            onClick={() => void loadUsers()}
                                            disabled={loading}
                                        >
                                            Refresh
                                        </button>
                                    </div>
                                }
                            >
                                <div className="listContainer">
                                    <div className="listHeaderGrid gridOnboardingReview">
                                        <div>Employee</div>
                                        <div>Email</div>
                                        <div>Status</div>
                                        <div>Date added</div>
                                        <div>Action</div>
                                    </div>
                                    <div className="listScrollArea adminUsersScroll">
                                        {loading ? <div className="listEmpty">Loading review queue...</div> : null}
                                        {error ? <div className="listEmpty errorText">{error}</div> : null}
                                        {!loading && !error && reviewUsers.length === 0 ? (
                                            <div className="listEmpty">No onboarding review items found.</div>
                                        ) : null}

                                        {!loading && !error
                                            ? reviewUsers.map((user) => (
                                                  <div
                                                      key={user.userId}
                                                      className="listRowGrid gridOnboardingReview clickableRow"
                                                      onClick={() => navigate(`/management/users/${user.userId}`)}
                                                  >
                                                      <div className="cellMain">{displayNameForUser(user)}</div>
                                                      <div className="cellSub">{user.email}</div>
                                                      <div className={statusClass(user.status)}>{statusLabel(user.status)}</div>
                                                      <div className="cellSub">{formatDate(user.registeredDate)}</div>
                                                      <button
                                                          type="button"
                                                          className="listLink"
                                                          onClick={(event) => {
                                                              event.stopPropagation();
                                                              navigate(`/management/users/${user.userId}`);
                                                          }}
                                                      >
                                                          Open profile
                                                      </button>
                                                  </div>
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
