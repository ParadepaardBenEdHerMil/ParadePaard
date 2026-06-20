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
import { UserServices, type ContractResponseDTO } from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/AdminUsers.css";

const STATUS_PRIORITY: Record<string, number> = {
    EMPLOYEE_SIGNED: 0,
    SIGNED: 1,
    DRAFT: 2,
    SENT_TO_EMPLOYEE: 3,
    FINALIZED: 4,
    REJECTED: 5,
    EXPIRED: 6,
};

function formatContractStatus(status?: string | null): string {
    if (!status) return "-";
    return status
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function contractStatusClass(status?: string | null): string {
    const normalized = (status ?? "").toUpperCase();
    if (normalized === "FINALIZED") return "cellOk";
    if (normalized === "EMPLOYEE_SIGNED" || normalized === "SIGNED" || normalized === "SENT_TO_EMPLOYEE") {
        return "cellWarn";
    }
    if (normalized === "REJECTED" || normalized === "EXPIRED") return "cellBad";
    return "cellSub";
}

const STATUS_BUCKET_MATCHERS: Record<string, (status: string) => boolean> = {
    review: (status) => status === "EMPLOYEE_SIGNED" || status === "SIGNED",
    draft: (status) => status === "DRAFT" || status === "SENT_TO_EMPLOYEE",
    finalized: (status) => status === "FINALIZED",
    rejected: (status) => status === "REJECTED" || status === "EXPIRED",
};

const FILTER_FIELDS: FilterFieldConfig[] = [
    {
        field: "search",
        label: "Search",
        section: "Identity",
        placeholder: "Employee or function",
        kind: { kind: "search" },
    },
    {
        field: "employee",
        label: "Employee",
        section: "Identity",
        kind: { kind: "text" },
    },
    {
        field: "function",
        label: "Function",
        section: "Identity",
        kind: { kind: "text" },
    },
    {
        field: "statusBucket",
        label: "Status group",
        section: "Status",
        kind: {
            kind: "select",
            options: [
                { value: "review", label: "Needs review" },
                { value: "draft", label: "Draft or sent" },
                { value: "finalized", label: "Finalized" },
                { value: "rejected", label: "Rejected or expired" },
            ],
            emptyLabel: "All statuses",
        },
    },
    {
        field: "status",
        label: "Status (exact)",
        section: "Status",
        kind: {
            kind: "select",
            options: [
                { value: "DRAFT", label: "Draft" },
                { value: "SENT_TO_EMPLOYEE", label: "Sent to employee" },
                { value: "EMPLOYEE_SIGNED", label: "Employee signed" },
                { value: "SIGNED", label: "Signed" },
                { value: "FINALIZED", label: "Finalized" },
                { value: "REJECTED", label: "Rejected" },
                { value: "EXPIRED", label: "Expired" },
            ],
            emptyLabel: "Any status",
        },
    },
    {
        field: "startFrom",
        label: "Start from",
        section: "Dates",
        placeholder: "dd/mm/yyyy",
        maxLength: 10,
        kind: { kind: "date" },
    },
    {
        field: "startTo",
        label: "Start to",
        section: "Dates",
        placeholder: "dd/mm/yyyy",
        maxLength: 10,
        kind: { kind: "date" },
    },
    {
        field: "endFrom",
        label: "End from",
        section: "Dates",
        placeholder: "dd/mm/yyyy",
        maxLength: 10,
        kind: { kind: "date" },
    },
    {
        field: "endTo",
        label: "End to",
        section: "Dates",
        placeholder: "dd/mm/yyyy",
        maxLength: 10,
        kind: { kind: "date" },
    },
];

export default function AdminContracts() {
    const navigate = useNavigate();
    const [contracts, setContracts] = useState<ContractResponseDTO[]>([]);
    const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const filter = useFilterPanel({ fields: FILTER_FIELDS });

    const loadContracts = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getContracts();
            setContracts(data);

            const userIds = Array.from(new Set(data.map((contract) => contract.userId).filter(Boolean)));
            try {
                const names = await UserServices.getUserDisplayNames(userIds);
                setDisplayNames(names);
            } catch {
                setDisplayNames({});
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load contracts.";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadContracts();
    }, [loadContracts]);

    const nameForContract = useCallback(
        (contract: ContractResponseDTO) => displayNames[contract.userId] ?? contract.userId,
        [displayNames]
    );

    const filteredContracts = useMemo(() => {
        const sorted = [...contracts].sort((a, b) => {
            const aStatus = (a.status ?? "").toUpperCase();
            const bStatus = (b.status ?? "").toUpperCase();
            const statusSort = (STATUS_PRIORITY[aStatus] ?? 99) - (STATUS_PRIORITY[bStatus] ?? 99);
            if (statusSort !== 0) return statusSort;
            return (b.startDate ?? "").localeCompare(a.startDate ?? "");
        });
        return applyFilterRows(sorted, filter.rows, {
            search: (contract, value) =>
                textIncludes(nameForContract(contract), value) ||
                textIncludes(contract.functionName ?? "", value),
            employee: (contract, value) => textIncludes(nameForContract(contract), value),
            function: (contract, value) => textIncludes(contract.functionName ?? "", value),
            statusBucket: (contract, value) => {
                const matcher = STATUS_BUCKET_MATCHERS[value];
                if (!matcher) return true;
                return matcher((contract.status ?? "").toUpperCase());
            },
            status: (contract, value) => (contract.status ?? "").toUpperCase() === value.toUpperCase(),
            startFrom: (contract, value) => dateFromAtLeast(contract.startDate, value),
            startTo: (contract, value) => dateToAtMost(contract.startDate, value),
            endFrom: (contract, value) => dateFromAtLeast(contract.endDate, value),
            endTo: (contract, value) => dateToAtMost(contract.endDate, value),
        });
    }, [contracts, filter.rows, nameForContract]);

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header className="pageHeader">
                            <PageBack to="/management" />
                            <h1 className="pageTitle">Contracts</h1>
                        </header>
                        <div className="adminDashboardCard">
                            <Card
                                title="Contract workspace"
                                right={
                                    <div className="adminUsersToolbar">
                                        <div className="adminUsersCount">
                                            {filteredContracts.length} of {contracts.length} contract
                                            {contracts.length === 1 ? "" : "s"}
                                        </div>
                                        <FilterToggleButton controller={filter} />
                                    </div>
                                }
                            >
                                <FilterPanelBody
                                    controller={filter}
                                    resultMeta={`${filteredContracts.length} of ${contracts.length} contract${
                                        contracts.length === 1 ? "" : "s"
                                    }`}
                                />
                                <div className="listContainer">
                                    <div className="listHeaderGrid gridContractManagement">
                                        <div>Employee</div>
                                        <div>Function</div>
                                        <div>Status</div>
                                        <div>Start</div>
                                        <div>End</div>
                                        <div>Action</div>
                                    </div>
                                    <div className="listScrollArea adminUsersScroll">
                                        {loading ? <div className="listEmpty">Loading contracts...</div> : null}
                                        {error ? <div className="listEmpty errorText">{error}</div> : null}
                                        {!loading && !error && filteredContracts.length === 0 ? (
                                            <div className="listEmpty">No contracts match this filter.</div>
                                        ) : null}

                                        {!loading && !error
                                            ? filteredContracts.map((contract) => (
                                                  <div
                                                      key={contract.contractId}
                                                      className="listRowGrid gridContractManagement clickableRow"
                                                      onClick={() => navigate(`/management/users/${contract.userId}`)}
                                                  >
                                                      <div className="cellMain">{nameForContract(contract)}</div>
                                                      <div className="cellSub">{contract.functionName ?? "-"}</div>
                                                      <div className={contractStatusClass(contract.status)}>
                                                          {formatContractStatus(contract.status)}
                                                      </div>
                                                      <div className="cellSub">{formatDate(contract.startDate)}</div>
                                                      <div className="cellSub">{formatDate(contract.endDate)}</div>
                                                      <button
                                                          type="button"
                                                          className="listLink"
                                                          onClick={(event) => {
                                                              event.stopPropagation();
                                                              navigate(`/management/users/${contract.userId}`);
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
