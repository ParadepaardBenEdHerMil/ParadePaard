import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import { FilterPanelBody, FilterToggleButton } from "../components/common/FilterPanel";
import type { FilterFieldConfig, FilterRow } from "../components/common/FilterPanel.types";
import { useFilterPanel } from "../components/common/useFilterPanel";
import { UserServices, type AuditLogEntryDTO } from "../services/user-service/UserServices";
import type { AuditLogMessagePartDTO, AuditLogQuery } from "../services/user-service/Types";
import { formatDateTime } from "../utils/dateFormat";
import { parseDisplayDate } from "../utils/dateInput";
import "../stylesheets/AdminAuditLog.css";
import "../stylesheets/LeaveRequests.css";

const CATEGORY_OPTIONS = [
    { value: "PEOPLE", label: "People" },
    { value: "ROLES", label: "Roles & access" },
    { value: "COMPANY", label: "Company settings" },
    { value: "APPLICATIONS", label: "Applications" },
    { value: "ONBOARDING", label: "Onboarding" },
    { value: "LEAVE", label: "Leave" },
    { value: "RULES", label: "Rules" },
    { value: "CONTRACTS", label: "Contracts" },
    { value: "CLIENTS", label: "Clients" },
    { value: "PLANNING", label: "Planning" },
    { value: "TRAVEL_CLAIMS", label: "Travel claims" },
    { value: "RATES", label: "Billing rates" },
    { value: "TIMESHEETS", label: "Timesheets" },
    { value: "PAYROLL", label: "Payroll" },
];

function prettifyAuditValue(value: string) {
    return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
}

function sortAuditValues(values: string[]) {
    return [...values].sort((left, right) => prettifyAuditValue(left).localeCompare(prettifyAuditValue(right)));
}

function buildAuditQuery(rows: FilterRow[]): AuditLogQuery {
    const next: AuditLogQuery = {};

    rows.forEach((row) => {
        const value = row.value.trim();
        if (!value) {
            return;
        }

        switch (row.field) {
            case "search":
                next.query = value;
                break;
            case "category":
                next.category = value;
                break;
            case "action":
                next.action = value;
                break;
            case "entityType":
                next.entityType = value;
                break;
            case "occurredFrom": {
                const iso = parseDisplayDate(value);
                if (iso) next.occurredFrom = iso;
                break;
            }
            case "occurredTo": {
                const iso = parseDisplayDate(value);
                if (iso) next.occurredTo = iso;
                break;
            }
            default:
                break;
        }
    });

    return next;
}

function renderMessagePart(part: AuditLogMessagePartDTO, index: number) {
    if (part.type === "LINK" && part.route && part.label) {
        return (
            <Link key={`${part.entityId ?? part.label ?? "part"}-${index}`} className="auditLogLink" to={part.route}>
                {part.label}
            </Link>
        );
    }
    if (part.type === "LINK" && part.label) {
        return (
            <span key={`${part.entityId ?? part.label ?? "part"}-${index}`} className="auditLogLinkLabel">
                {part.label}
            </span>
        );
    }
    return <span key={`text-${index}`}>{part.text ?? ""}</span>;
}

function renderMessage(entry: AuditLogEntryDTO) {
    const parts = entry.messageParts ?? [];
    if (parts.length === 0) {
        return entry.summary;
    }
    return parts.map(renderMessagePart);
}

export default function AdminAuditLog() {
    const [entries, setEntries] = useState<AuditLogEntryDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const [hasNext, setHasNext] = useState(false);
    const [hasPrevious, setHasPrevious] = useState(false);

    const actionOptions = useMemo(
        () => sortAuditValues(Array.from(new Set(entries.map((entry) => entry.action).filter(Boolean)))),
        [entries]
    );
    const entityTypeOptions = useMemo(
        () => sortAuditValues(Array.from(new Set(entries.map((entry) => entry.entityType).filter(Boolean)))),
        [entries]
    );

    const filterFields = useMemo<FilterFieldConfig[]>(
        () => [
            {
                field: "search",
                label: "Search",
                section: "Activity",
                placeholder: "Search people, shifts, projects, or actions",
                kind: { kind: "search" },
            },
            {
                field: "category",
                label: "Category",
                section: "Activity",
                kind: { kind: "select", options: CATEGORY_OPTIONS, emptyLabel: "All categories" },
            },
            {
                field: "action",
                label: "Action",
                section: "Activity",
                kind: {
                    kind: "select",
                    options: actionOptions.map((value) => ({ value, label: prettifyAuditValue(value) })),
                    emptyLabel: "All actions",
                },
            },
            {
                field: "entityType",
                label: "Entity type",
                section: "Activity",
                kind: {
                    kind: "select",
                    options: entityTypeOptions.map((value) => ({ value, label: prettifyAuditValue(value) })),
                    emptyLabel: "All entity types",
                },
            },
            {
                field: "occurredFrom",
                label: "Occurred from",
                section: "Date range",
                placeholder: "dd/mm/yyyy",
                maxLength: 10,
                kind: { kind: "date" },
            },
            {
                field: "occurredTo",
                label: "Occurred to",
                section: "Date range",
                placeholder: "dd/mm/yyyy",
                maxLength: 10,
                kind: { kind: "date" },
            },
        ],
        [actionOptions, entityTypeOptions]
    );

    const filter = useFilterPanel({ fields: filterFields });

    const query = useMemo(() => buildAuditQuery(filter.rows), [filter.rows]);
    const [appliedQuery, setAppliedQuery] = useState<AuditLogQuery>(query);

    // The audit log is filtered server-side, so debounce filter edits into the applied
    // query (rather than a request per keystroke) while keeping the users-page live feel.
    useEffect(() => {
        const handle = setTimeout(() => {
            setAppliedQuery(query);
            setPage(0);
        }, 300);
        return () => clearTimeout(handle);
    }, [query]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await UserServices.getAuditLog({
                    ...appliedQuery,
                    page,
                    size: 50,
                });
                if (cancelled) return;
                setEntries(response.items);
                setTotal(response.totalElements);
                setHasNext(response.hasNext);
                setHasPrevious(response.hasPrevious);
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load audit log");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [appliedQuery, page]);

    return (
        <>
            <Navbar />
            <div className="auditLogPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header className="auditLogHeader">
                            <div>
                                <PageBack to="/management" />
                                <h1 className="auditLogTitle">Audit Log</h1>
                                <p className="auditLogSubtitle">
                                    Review rule changes, approvals, assignments, and other major admin actions.
                                </p>
                            </div>
                        </header>

                        <div className="auditLogShell">
                            <Card
                                title="Activity"
                                right={
                                    <div className="auditLogToolbar">
                                        <span className="auditLogCount">{total} entries</span>
                                        <FilterToggleButton controller={filter} />
                                    </div>
                                }
                                className="auditLogCard"
                            >
                                <FilterPanelBody
                                    controller={filter}
                                    resultMeta={`${entries.length} shown on this page | ${total} total entries`}
                                />

                                {error ? <div className="auditLogError">{error}</div> : null}
                                {loading ? <div className="auditLogEmpty">Loading audit log...</div> : null}
                                {!loading && !error && entries.length === 0 ? (
                                    <p className="requestListEmpty auditLogListEmpty">No matching activity found.</p>
                                ) : null}

                                {!loading && !error && entries.length > 0 ? (
                                    <>
                                        <div className="auditLogList">
                                            {entries.map((entry) => (
                                                <article key={entry.entryId} className="auditLogRow">
                                                    <div className="auditLogMetaRow">
                                                        <span className="auditLogTime">{formatDateTime(entry.occurredAt)}</span>
                                                        <span className="auditLogCategory">{prettifyAuditValue(entry.category)}</span>
                                                    </div>
                                                    <div className="auditLogSummary">{renderMessage(entry)}</div>
                                                </article>
                                            ))}
                                        </div>
                                        <div className="auditLogPagination">
                                            <button
                                                className="button buttonSecondary"
                                                type="button"
                                                disabled={!hasPrevious || loading}
                                                onClick={() => setPage((current) => Math.max(current - 1, 0))}
                                            >
                                                Previous
                                            </button>
                                            <span>Page {page + 1}</span>
                                            <button
                                                className="button buttonSecondary"
                                                type="button"
                                                disabled={!hasNext || loading}
                                                onClick={() => setPage((current) => current + 1)}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </>
                                ) : null}
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
