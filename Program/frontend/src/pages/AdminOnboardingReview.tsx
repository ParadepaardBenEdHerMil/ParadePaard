import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import { FilterPanelBody, FilterToggleButton } from "../components/common/FilterPanel";
import type { FilterFieldConfig } from "../components/common/FilterPanel.types";
import { useFilterPanel } from "../components/common/useFilterPanel";
import { applyFilterRows, dateFromAtLeast, dateToAtMost, textIncludes } from "../utils/applyFilterRows";
import { UserServices, type ContractResponseDTO, type UserResponseDTO } from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/AdminUsers.css";

const FILTER_FIELDS: FilterFieldConfig[] = [
    {
        field: "search",
        label: "Search",
        section: "Identity",
        placeholder: "Name or email",
        kind: { kind: "search" },
    },
    {
        field: "email",
        label: "Email",
        section: "Identity",
        placeholder: "Email contains",
        kind: { kind: "text" },
    },
    {
        field: "status",
        label: "Status",
        section: "Status",
        kind: {
            kind: "select",
            options: [
                { value: "PENDING_PROFILE_REVIEW", label: "Profile review" },
                { value: "PENDING_CONTRACT_REVIEW", label: "Contract review" },
                { value: "CHANGES_REQUESTED", label: "Changes requested" },
                { value: "PENDING_CONTRACT_SIGNATURE", label: "Awaiting signature" },
            ],
            emptyLabel: "Any status",
        },
    },
    {
        field: "dateFrom",
        label: "Registered from",
        section: "Dates",
        placeholder: "dd/mm/yyyy",
        maxLength: 10,
        kind: { kind: "date" },
    },
    {
        field: "dateTo",
        label: "Registered to",
        section: "Dates",
        placeholder: "dd/mm/yyyy",
        maxLength: 10,
        kind: { kind: "date" },
    },
];

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

type OnboardingReviewQueueListProps = {
    reviewUsers: UserResponseDTO[];
    downloadableContracts: Map<string, ContractResponseDTO>;
    loading: boolean;
    error: string | null;
    downloadingContractId: string | null;
    onOpenReview: (userId: string) => void;
    onDownloadContract: (contract: ContractResponseDTO) => void;
};

export function OnboardingReviewQueueList({
    reviewUsers,
    downloadableContracts,
    loading,
    error,
    downloadingContractId,
    onOpenReview,
    onDownloadContract,
}: OnboardingReviewQueueListProps) {
    return (
        <div className="listContainer">
            <div className="listHeaderGrid gridOnboardingReview">
                <div>Employee</div>
                <div>Email</div>
                <div>Status</div>
                <div>Date added</div>
                <div>Action</div>
                <div>Download</div>
            </div>
            <div className="listScrollArea adminUsersScroll">
                {loading ? <div className="listEmpty">Loading review queue...</div> : null}
                {error ? <div className="listEmpty errorText">{error}</div> : null}
                {!loading && !error && reviewUsers.length === 0 ? (
                    <div className="listEmpty">No onboarding review items found.</div>
                ) : null}

                {!loading && !error
                    ? reviewUsers.map((user) => {
                          const contract = downloadableContracts.get(user.userId) ?? null;
                          const userName = displayNameForUser(user);
                          const isDownloading = contract != null && downloadingContractId === contract.contractId;

                          return (
                              <div
                                  key={user.userId}
                                  className="listRowGrid gridOnboardingReview clickableRow"
                                  onClick={() => onOpenReview(user.userId)}
                              >
                                  <div className="cellMain">{userName}</div>
                                  <div className="cellSub">{user.email}</div>
                                  <div className={statusClass(user.status)}>{statusLabel(user.status)}</div>
                                  <div className="cellSub">{formatDate(user.registeredDate)}</div>
                                  <button
                                      type="button"
                                      className="listLink"
                                      onClick={(event) => {
                                          event.stopPropagation();
                                          onOpenReview(user.userId);
                                      }}
                                  >
                                      Open review
                                  </button>
                                  {contract ? (
                                      <button
                                          type="button"
                                          className="listLink"
                                          aria-label={`Download contract PDF for ${userName}`}
                                          onClick={(event) => {
                                              event.stopPropagation();
                                              onDownloadContract(contract);
                                          }}
                                      >
                                          {isDownloading ? "Downloading..." : "Download"}
                                      </button>
                                  ) : (
                                      <div aria-hidden="true" />
                                  )}
                              </div>
                          );
                      })
                    : null}
            </div>
        </div>
    );
}

export default function AdminOnboardingReview() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserResponseDTO[]>([]);
    const [downloadableContracts, setDownloadableContracts] = useState<Map<string, ContractResponseDTO>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloadingContractId, setDownloadingContractId] = useState<string | null>(null);

    const loadUsers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getUsers();
            const reviewUserIds = data
                .filter((user) => REVIEW_STATUSES.has((user.status ?? "").toUpperCase()))
                .map((user) => user.userId);
            const contractPairs = await Promise.all(
                reviewUserIds.map(async (reviewUserId) => [reviewUserId, await UserServices.getCurrentContractForUser(reviewUserId)] as const)
            );
            const nextContracts = new Map<string, ContractResponseDTO>();
            contractPairs.forEach(([reviewUserId, contract]) => {
                if (contract) {
                    nextContracts.set(reviewUserId, contract);
                }
            });
            setUsers(data);
            setDownloadableContracts(nextContracts);
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

    const filter = useFilterPanel({ fields: FILTER_FIELDS });

    const reviewUsers = useMemo(() => {
        const all = users
            .filter((user) => REVIEW_STATUSES.has((user.status ?? "").toUpperCase()))
            .sort((a, b) => {
                const aStatus = (a.status ?? "").toUpperCase();
                const bStatus = (b.status ?? "").toUpperCase();
                const statusSort = (STATUS_PRIORITY[aStatus] ?? 99) - (STATUS_PRIORITY[bStatus] ?? 99);
                if (statusSort !== 0) return statusSort;
                return (b.registeredDate ?? "").localeCompare(a.registeredDate ?? "");
            });
        return applyFilterRows(all, filter.rows, {
            search: (user, value) =>
                textIncludes(displayNameForUser(user), value) || textIncludes(user.email, value),
            email: (user, value) => textIncludes(user.email, value),
            status: (user, value) => (user.status ?? "").toUpperCase() === value.toUpperCase(),
            dateFrom: (user, value) => dateFromAtLeast(user.registeredDate, value),
            dateTo: (user, value) => dateToAtMost(user.registeredDate, value),
        });
    }, [filter.rows, users]);

    const handleDownloadContract = useCallback(async (contract: ContractResponseDTO) => {
        try {
            setDownloadingContractId(contract.contractId);
            setError(null);
            const blob = await UserServices.getContractPdf(contract.contractId);
            const url = URL.createObjectURL(blob);
            try {
                const a = document.createElement("a");
                a.href = url;
                a.download = `contract_${contract.contractId}.pdf`;
                a.rel = "noopener";
                document.body.appendChild(a);
                a.click();
                a.remove();
            } finally {
                URL.revokeObjectURL(url);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to download contract PDF.";
            setError(message);
        } finally {
            setDownloadingContractId(null);
        }
    }, []);

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header className="pageHeader">
                            <PageBack to="/management" />
                            <h1 className="pageTitle">Onboarding Review</h1>
                        </header>
                        <div className="adminDashboardCard">
                            <Card
                                title="Review queue"
                                right={
                                    <div className="adminUsersToolbar">
                                        <div className="adminUsersCount">
                                            {reviewUsers.length} open review item{reviewUsers.length === 1 ? "" : "s"}
                                        </div>
                                        <FilterToggleButton controller={filter} />
                                    </div>
                                }
                            >
                                <FilterPanelBody
                                    controller={filter}
                                    resultMeta={`${reviewUsers.length} open review item${reviewUsers.length === 1 ? "" : "s"}`}
                                />
                                <OnboardingReviewQueueList
                                    reviewUsers={reviewUsers}
                                    downloadableContracts={downloadableContracts}
                                    loading={loading}
                                    error={error}
                                    downloadingContractId={downloadingContractId}
                                    onOpenReview={(reviewUserId) => navigate(`/management/onboarding-review/${reviewUserId}`)}
                                    onDownloadContract={(contract) => void handleDownloadContract(contract)}
                                />
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
