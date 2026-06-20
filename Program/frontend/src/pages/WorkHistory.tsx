import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Spinner from "../components/Spinner";
import Card from "../components/common/Card";
import PaginationControls from "../components/common/PaginationControls";
import { FilterPanelBody, FilterToggleButton } from "../components/common/FilterPanel";
import type { FilterFieldConfig, FilterRow } from "../components/common/FilterPanel.types";
import { useFilterPanel } from "../components/common/useFilterPanel";
import { WorkHistoryColumnPicker } from "../components/work-history/WorkHistoryColumnPicker";
import { useAuth } from "../context/AuthContext";
import { UserServices } from "../services/user-service/UserServices";
import {
    getMyWorkHistoryColumnsPreference,
    updateMyWorkHistoryColumnsPreference,
} from "../services/user-service/WorkHistoryPreferences";
import "../stylesheets/WorkHistory.css";
import { sumHours } from "../utils/hoursSummary";
import { formatDate } from "../utils/dateFormat";
import { PAYROLL_FINANCE_PERMISSIONS, hasAnyPermission } from "../utils/permissionPolicy";
import { applyWorkHistoryFilters, type WorkHistoryFilterRow } from "../utils/workHistoryFilters";
import {
    getDefaultVisibleWorkHistoryColumns,
    getWorkHistoryColumns,
    getWorkHistoryFinanceStatus,
    sanitizeVisibleWorkHistoryColumns,
    type WorkHistoryColumnKey,
} from "../utils/workHistoryColumns";

const DEFAULT_PAGE_SIZE = 50;
type WorkHistoryScope = "mine" | "management";
const currencyFormatter = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
});

export interface Timesheet {
    timesheetId: string;
    userId?: string;
    name?: string;
    dateOfIssue: string;
    weekNumber?: number;
    weekBasedYear?: number;
    function: string;
    hoursWorked: number;
    travelExpenses?: number;
    projectName?: string | null;
    shiftName?: string | null;
    shiftDate?: string | null;
    travelKilometers?: number | null;
    travelRate?: number | null;
    clientBillingRatePerHour?: number | null;
    billingRateSource?: string | null;
    billingRateOverrideReason?: string | null;
    financeReviewNeeded?: boolean | null;
    financeLocked?: boolean | null;
}

export default function WorkHistory() {
    return <WorkHistoryPage scope="mine" />;
}

export function ManagementWorkHistory() {
    return <WorkHistoryPage scope="management" />;
}

function WorkHistoryPage({ scope }: { scope: WorkHistoryScope }) {
    const navigate = useNavigate();
    const { permissions } = useAuth();
    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [totalTimesheets, setTotalTimesheets] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const isManagementScope = scope === "management";
    const canManageTimesheets = permissions.includes("CAN_MANAGE_TIMESHEETS");
    const canViewFinanceColumns = hasAnyPermission(permissions, PAYROLL_FINANCE_PERMISSIONS);
    const showAllTimesheets = isManagementScope;
    const availableColumns = useMemo(
        () => getWorkHistoryColumns({ showAllTimesheets, canViewFinanceColumns }),
        [canViewFinanceColumns, showAllTimesheets]
    );
    const [visibleColumns, setVisibleColumns] = useState<WorkHistoryColumnKey[]>(() =>
        getDefaultVisibleWorkHistoryColumns({ showAllTimesheets: false, canViewFinanceColumns: false })
    );
    const getEmployeeName = useCallback((timesheet: Timesheet) => {
        if (!timesheet.userId) {
            return timesheet.name ?? "-";
        }
        return displayNames[timesheet.userId] ?? timesheet.name ?? timesheet.userId;
    }, [displayNames]);

    const userOptions = useMemo(() => {
        if (!showAllTimesheets) return [];
        const map = new Map<string, string>();
        timesheets.forEach((t) => {
            if (!t.userId) return;
            map.set(t.userId, getEmployeeName(t));
        });
        return [...map.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [getEmployeeName, showAllTimesheets, timesheets]);

    const functionOptions = useMemo(() => {
        const values = new Set<string>();
        timesheets.forEach((t) => {
            if (t.function) values.add(t.function);
        });
        return [...values].sort((a, b) => a.localeCompare(b));
    }, [timesheets]);

    const filterFields = useMemo<FilterFieldConfig[]>(() => {
        const fields: FilterFieldConfig[] = [
            {
                field: "search",
                label: "Search",
                section: "Identity",
                placeholder: "Type to filter",
                kind: { kind: "search" },
            },
        ];
        if (showAllTimesheets) {
            fields.push({
                field: "employee",
                label: "Employee",
                section: "Identity",
                kind: {
                    kind: "select",
                    options: userOptions.map((user) => ({ value: user.name, label: user.name })),
                    emptyLabel: "Any employee",
                },
            });
        }
        fields.push(
            {
                field: "function",
                label: "Function",
                section: "Identity",
                kind: {
                    kind: "select",
                    options: functionOptions.map((value) => ({ value, label: value })),
                    emptyLabel: "Any function",
                },
            },
            {
                field: "project",
                label: "Project",
                section: "Identity",
                kind: { kind: "text" },
            },
            {
                field: "shift",
                label: "Shift",
                section: "Identity",
                kind: { kind: "text" },
            },
            {
                field: "dateFrom",
                label: "Date from",
                section: "Dates",
                placeholder: "dd/mm/yyyy",
                maxLength: 10,
                kind: { kind: "date" },
            },
            {
                field: "dateTo",
                label: "Date to",
                section: "Dates",
                placeholder: "dd/mm/yyyy",
                maxLength: 10,
                kind: { kind: "date" },
            },
            {
                field: "weekYear",
                label: "Week year",
                section: "Dates",
                placeholder: "2026",
                kind: { kind: "number" },
            },
            {
                field: "weekNumber",
                label: "Week number",
                section: "Dates",
                placeholder: "1-53",
                kind: { kind: "number" },
            },
            {
                field: "minHours",
                label: "Min hours",
                section: "Hours",
                placeholder: "Hours",
                kind: { kind: "decimal" },
            },
            {
                field: "maxHours",
                label: "Max hours",
                section: "Hours",
                placeholder: "Hours",
                kind: { kind: "decimal" },
            },
            {
                field: "minTravel",
                label: "Min travel",
                section: "Travel",
                placeholder: "Travel amount",
                kind: { kind: "decimal" },
            },
            {
                field: "maxTravel",
                label: "Max travel",
                section: "Travel",
                placeholder: "Travel amount",
                kind: { kind: "decimal" },
            }
        );
        if (canViewFinanceColumns) {
            fields.push({
                field: "financeReadiness",
                label: "Finance readiness",
                section: "Finance",
                placeholder: "Billing rate set",
                kind: { kind: "text" },
            });
        }
        return fields;
    }, [canViewFinanceColumns, functionOptions, showAllTimesheets, userOptions]);

    const filter = useFilterPanel({ fields: filterFields });

    const filteredTimesheets = useMemo(() => {
        const workHistoryRows: WorkHistoryFilterRow[] = filter.rows.map((row: FilterRow) => ({
            id: row.id,
            field: row.field as WorkHistoryFilterRow["field"],
            value: row.value,
        }));
        const filtered = applyWorkHistoryFilters(timesheets, workHistoryRows, {
            getEmployeeName,
            includeEmployeeFilters: showAllTimesheets,
        });
        return [...filtered].sort((a, b) => (b.dateOfIssue ?? "").localeCompare(a.dateOfIssue ?? ""));
    }, [filter.rows, getEmployeeName, showAllTimesheets, timesheets]);

    const totalHours = useMemo(() => sumHours(filteredTimesheets), [filteredTimesheets]);

    useEffect(() => {
        let cancelled = false;

        const load = async (targetPage = page, targetPageSize = pageSize) => {
            try {
                setLoading(true);
                setErrorMsg(null);
                const data = showAllTimesheets
                    ? await UserServices.getTimesheetsPage(targetPage, targetPageSize)
                    : await UserServices.getMyTimesheetsPage(targetPage, targetPageSize);
                if (!cancelled) {
                    setTimesheets(data.items);
                    setPage(data.page);
                    setTotalTimesheets(data.totalElements);
                    setTotalPages(data.totalPages);
                }
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Failed to load work history";
                if (!cancelled) setErrorMsg(message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [page, pageSize, showAllTimesheets]);

    useEffect(() => {
        const defaultKeys = getDefaultVisibleWorkHistoryColumns({ showAllTimesheets, canViewFinanceColumns });
        setVisibleColumns((current) => {
            return sanitizeVisibleWorkHistoryColumns(current, availableColumns, defaultKeys);
        });
    }, [availableColumns, canViewFinanceColumns, showAllTimesheets]);

    useEffect(() => {
        if (!isManagementScope) return;

        let cancelled = false;
        const defaultKeys = getDefaultVisibleWorkHistoryColumns({ showAllTimesheets, canViewFinanceColumns });

        getMyWorkHistoryColumnsPreference()
            .then((preference) => {
                if (cancelled) return;
                setVisibleColumns(
                    sanitizeVisibleWorkHistoryColumns(
                        preference.columns as WorkHistoryColumnKey[],
                        availableColumns,
                        defaultKeys
                    )
                );
            })
            .catch(() => {
                if (!cancelled) {
                    setVisibleColumns(defaultKeys);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [availableColumns, canViewFinanceColumns, isManagementScope, showAllTimesheets]);

    useEffect(() => {
        let cancelled = false;
        const userIds = timesheets
            .map((timesheet) => timesheet.userId)
            .filter((value): value is string => Boolean(value));

        if (userIds.length === 0) {
            setDisplayNames({});
            return;
        }

        UserServices.getUserDisplayNames(userIds)
            .then((data) => {
                if (!cancelled) {
                    setDisplayNames(data);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setDisplayNames({});
                }
            });

        return () => {
            cancelled = true;
        };
    }, [timesheets]);

    const openShiftDetail = (timesheetId: string) => {
        navigate(isManagementScope ? `/management/work-history/${timesheetId}` : `/work-history/${timesheetId}`);
    };

    const toggleColumn = (columnKey: WorkHistoryColumnKey) => {
        setVisibleColumns((current) => {
            const next = current.includes(columnKey)
                ? current.filter((key) => key !== columnKey)
                : [...current, columnKey];
            const defaultKeys = getDefaultVisibleWorkHistoryColumns({ showAllTimesheets, canViewFinanceColumns });
            const cleaned = sanitizeVisibleWorkHistoryColumns(next, availableColumns, defaultKeys);
            if (isManagementScope) {
                void updateMyWorkHistoryColumnsPreference(cleaned);
            }
            return cleaned;
        });
    };

    const renderCell = (timesheet: Timesheet, columnKey: WorkHistoryColumnKey) => {
        switch (columnKey) {
            case "date":
                return formatDate(timesheet.dateOfIssue);
            case "employee":
                return getEmployeeName(timesheet);
            case "shift":
                return (
                    <>
                        <div className="workHistoryCellMain workHistoryCellMain--link">
                            {timesheet.shiftName ?? timesheet.function}
                        </div>
                        <div className="workHistoryCellSub">{timesheet.projectName ?? timesheet.function}</div>
                    </>
                );
            case "hours":
                return Number(timesheet.hoursWorked ?? 0).toFixed(1);
            case "travel":
                return Number(timesheet.travelExpenses ?? 0).toFixed(2);
            case "financeReadiness":
                return <span className="workHistoryStatusPill">{getWorkHistoryFinanceStatus(timesheet)}</span>;
            case "billingRateSource":
                return timesheet.billingRateSource ?? "Not set";
            case "clientBillingRatePerHour":
                return timesheet.clientBillingRatePerHour == null
                    ? "Missing"
                    : currencyFormatter.format(timesheet.clientBillingRatePerHour);
            case "billingOverrideReason":
                return timesheet.billingRateOverrideReason?.trim() || "No override";
            case "financeLockStatus":
                return timesheet.financeLocked ? "Locked after payroll approval" : "Open for finance review";
            default:
                return "";
        }
    };

    const columnCount = Math.max(visibleColumns.length, 1);

    return (
        <>
            <Navbar />
            <div className="workHistoryPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header
                            className="workHistoryHeader"
                            style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
                        >
                            <h1 className="workHistoryTitle">{isManagementScope ? "Work History" : "My Work History"}</h1>
                            {isManagementScope && canManageTimesheets ? (
                                <Link className="button" to="/management/travel-claims">
                                    Open travel claims
                                </Link>
                            ) : null}
                        </header>
                        <div className="workHistoryShell">
                            {loading ? (
                                <div className="workHistoryLoading">
                                    <Spinner text="Loading work history" />
                                </div>
                            ) : errorMsg ? (
                                <div className="workHistoryError">{errorMsg}</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1, minHeight: 0 }}>
                                    <Card
                                        title={isManagementScope ? "Timesheets" : "My timesheets"}
                                        className="workHistoryCard"
                                        right={<FilterToggleButton controller={filter} />}
                                    >
                                        <FilterPanelBody
                                            controller={filter}
                                            resultMeta={`${filteredTimesheets.length}${
                                                timesheets.length !== filteredTimesheets.length
                                                    ? ` of ${timesheets.length}`
                                                    : ""
                                            } on this page | ${totalTimesheets} total`}
                                            extraContent={
                                                isManagementScope ? (
                                                    <WorkHistoryColumnPicker
                                                        availableColumns={availableColumns}
                                                        visibleColumns={visibleColumns}
                                                        onToggleColumn={toggleColumn}
                                                    />
                                                ) : null
                                            }
                                        />
                                        <div className="workHistoryTableWrap">
                                            <table className="workHistoryTable">
                                                <thead>
                                                    <tr>
                                                        {visibleColumns.map((columnKey) => {
                                                            const column = availableColumns.find((item) => item.key === columnKey);
                                                            return column ? (
                                                                <th
                                                                    key={column.key}
                                                                    className={
                                                                        column.key === "hours" ||
                                                                        column.key === "travel" ||
                                                                        column.key === "clientBillingRatePerHour"
                                                                            ? "workHistoryHoursCol"
                                                                            : undefined
                                                                    }
                                                                >
                                                                    {column.label}
                                                                </th>
                                                            ) : null;
                                                        })}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredTimesheets.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={columnCount} className="workHistoryEmpty">
                                                                No timesheets match these filters.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        filteredTimesheets.map((t) => (
                                                            <tr
                                                                key={t.timesheetId}
                                                                className="workHistoryRowInteractive"
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={() => openShiftDetail(t.timesheetId)}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === "Enter" || event.key === " ") {
                                                                        event.preventDefault();
                                                                        openShiftDetail(t.timesheetId);
                                                                    }
                                                                }}
                                                            >
                                                                {visibleColumns.map((columnKey) => (
                                                                    <td
                                                                        key={columnKey}
                                                                        className={
                                                                            columnKey === "hours" ||
                                                                            columnKey === "travel" ||
                                                                            columnKey === "clientBillingRatePerHour"
                                                                                ? "workHistoryHoursCol"
                                                                                : undefined
                                                                        }
                                                                    >
                                                                        {renderCell(t, columnKey)}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        <PaginationControls
                                            page={page}
                                            totalPages={totalPages}
                                            pageSize={pageSize}
                                            loading={loading}
                                            onPageChange={(nextPage) => setPage(Math.max(0, nextPage))}
                                            onPageSizeChange={(nextPageSize) => {
                                                setPageSize(nextPageSize);
                                                setPage(0);
                                            }}
                                        />
                                        <div
                                            className={`workHistoryTotalBar${
                                                showAllTimesheets ? " workHistoryTotalBar--admin" : ""
                                            }`}
                                        >
                                            <div className="workHistoryTotalLabel">Total</div>
                                            <div className="workHistoryTotalValue">{totalHours.toFixed(1)}</div>
                                        </div>
                                    </Card>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
