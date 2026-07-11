import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import PaginationControls from "../components/common/PaginationControls";
import { FilterPanelBody, FilterToggleButton } from "../components/common/FilterPanel";
import type { FilterFieldConfig, FilterRow } from "../components/common/FilterPanel.types";
import { useFilterPanel } from "../components/common/useFilterPanel";
import { useAuth } from "../context/AuthContext";
import { UserServices, type PayslipResponseDTO } from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";
import { parseDisplayDate } from "../utils/dateInput";
import "../stylesheets/PayslipsPage.css";

type PayslipScope = "mine" | "all";

const DEFAULT_PAGE_SIZE = 50;

const normalizeStatus = (status?: string) => (status ?? "RELEASED").toUpperCase();

const formatStatus = (status?: string) => {
    const value = normalizeStatus(status);
    if (value === "NOT_ACCEPTED") return "Not accepted";
    return value
        .split("_")
        .map((part) => part[0] + part.slice(1).toLowerCase())
        .join(" ");
};

const formatWeek = (weekYear: number, weekNumber: number) => {
    const padded = String(weekNumber ?? "").padStart(2, "0");
    return `${weekYear}-W${padded}`;
};

const parseNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
};

const formatHours = (value?: number | null) => {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) return "-";
    return num.toFixed(2);
};

const formatCurrency = (value?: number | null) => {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) return "-";
    return new Intl.NumberFormat("nl-NL", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
    }).format(num);
};

const filterPayslipsWithRows = (
    payslips: PayslipResponseDTO[],
    rows: readonly FilterRow[]
): PayslipResponseDTO[] => {
    const activeRows = rows.filter((row) => row.value.trim().length > 0);
    if (activeRows.length === 0) return [...payslips];

    return payslips.filter((payslip) => {
        const status = normalizeStatus(payslip.status);
        const hours = Number(payslip.totalHoursWorked ?? 0);
        const net = Number(payslip.totalNetAmount ?? 0);

        return activeRows.every((row) => {
            const value = row.value.trim();
            switch (row.field) {
                case "search": {
                    const haystack = [
                        payslip.name,
                        payslip.functionName,
                        payslip.userId,
                        payslip.payslipId,
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();
                    return haystack.includes(value.toLowerCase());
                }
                case "status":
                    if (value === "NOT_ACCEPTED") {
                        return status !== "RELEASED" && status !== "APPROVED";
                    }
                    return status === value.toUpperCase();
                case "dateFrom": {
                    const from = parseDisplayDate(value);
                    return !from || payslip.dateOfIssue >= from;
                }
                case "dateTo": {
                    const to = parseDisplayDate(value);
                    return !to || payslip.dateOfIssue <= to;
                }
                case "weekYear": {
                    const target = parseNumber(value);
                    return target === null || payslip.weekBasedYear === target;
                }
                case "weekNumber": {
                    const target = parseNumber(value);
                    return target === null || payslip.weekNumber === target;
                }
                case "minHours": {
                    const target = parseNumber(value);
                    return target === null || hours >= target;
                }
                case "maxHours": {
                    const target = parseNumber(value);
                    return target === null || hours <= target;
                }
                case "minNet": {
                    const target = parseNumber(value);
                    return target === null || net >= target;
                }
                case "maxNet": {
                    const target = parseNumber(value);
                    return target === null || net <= target;
                }
                default:
                    return true;
            }
        });
    });
};

const buildFilterFields = (
    activeScope: PayslipScope,
    statusValues: ReadonlyArray<string>,
    searchPlaceholder: string
): FilterFieldConfig[] => [
    {
        field: "search",
        label: activeScope === "all" ? "Search (name, function, ID)" : "Search",
        section: "Identity",
        placeholder: searchPlaceholder,
        kind: { kind: "search" },
    },
    {
        field: "status",
        label: "Status",
        section: "Status",
        kind: {
            kind: "select",
            options: statusValues
                .filter((status) => status !== "ALL")
                .map((status) => ({
                    value: status,
                    label: status === "NOT_ACCEPTED" ? "Not accepted" : formatStatus(status),
                })),
            emptyLabel: "All statuses",
        },
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
        placeholder: "0",
        kind: { kind: "decimal" },
    },
    {
        field: "maxHours",
        label: "Max hours",
        section: "Hours",
        placeholder: "60",
        kind: { kind: "decimal" },
    },
    {
        field: "minNet",
        label: "Min net pay",
        section: "Pay",
        placeholder: "0",
        kind: { kind: "decimal" },
    },
    {
        field: "maxNet",
        label: "Max net pay",
        section: "Pay",
        placeholder: "5000",
        kind: { kind: "decimal" },
    },
];

export default function Payslips() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { permissions, permissionsLoading, permissionsError } = useAuth();

    const [activeScope, setActiveScope] = useState<PayslipScope>("mine");

    const [myPayslips, setMyPayslips] = useState<PayslipResponseDTO[]>([]);
    const [allPayslips, setAllPayslips] = useState<PayslipResponseDTO[]>([]);
    const [loading, setLoading] = useState({ mine: false, all: false });
    const [errors, setErrors] = useState<{ mine: string | null; all: string | null }>({
        mine: null,
        all: null,
    });
    const [loaded, setLoaded] = useState({ mine: false, all: false });
    const [pages, setPages] = useState<Record<PayslipScope, number>>({ mine: 0, all: 0 });
    const [pageSizes, setPageSizes] = useState<Record<PayslipScope, number>>({ mine: DEFAULT_PAGE_SIZE, all: DEFAULT_PAGE_SIZE });
    const [totals, setTotals] = useState<Record<PayslipScope, number>>({ mine: 0, all: 0 });
    const [totalPagesByScope, setTotalPagesByScope] = useState<Record<PayslipScope, number>>({ mine: 0, all: 0 });
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [downloadId, setDownloadId] = useState<string | null>(null);

    const canViewOwn =
        permissions.includes("CAN_VIEW_PAYSLIPS") || permissions.includes("CAN_VIEW_ALL_PAYSLIPS");
    const canViewAll = permissions.includes("CAN_VIEW_ALL_PAYSLIPS");
    const canManagePayslips = permissions.includes("CAN_MANAGE_PAYSLIPS");

    const activePayslips = activeScope === "mine" ? myPayslips : allPayslips;

    const statusOptions = useMemo(() => {
        const statuses = new Set(activePayslips.map((p) => normalizeStatus(p.status)));
        statuses.delete("NOT_ACCEPTED");
        return ["ALL", "NOT_ACCEPTED", ...Array.from(statuses).sort()];
    }, [activePayslips]);

    const searchPlaceholder =
        activeScope === "all" ? "Name, function, user ID, payslip ID" : "Function or date";

    const filterFields = useMemo<FilterFieldConfig[]>(
        () => buildFilterFields(activeScope, statusOptions, searchPlaceholder),
        [activeScope, searchPlaceholder, statusOptions]
    );

    const mineFilter = useFilterPanel({ fields: filterFields });
    const allFilter = useFilterPanel({ fields: filterFields });
    const activeFilter = activeScope === "mine" ? mineFilter : allFilter;

    useEffect(() => {
        if (permissionsLoading) return;
        if (activeScope === "mine" && !canViewOwn && canViewAll) {
            setActiveScope("all");
            return;
        }
        if (activeScope === "all" && !canViewAll && canViewOwn) {
            setActiveScope("mine");
            return;
        }
        if (!canViewOwn && canViewAll && activeScope !== "all") {
            setActiveScope("all");
            return;
        }
        if (!canViewAll && canViewOwn && activeScope !== "mine") {
            setActiveScope("mine");
        }
    }, [permissionsLoading, canViewOwn, canViewAll, activeScope]);

    useEffect(() => {
        if (permissionsLoading) return;
        const scopeParam = (searchParams.get("scope") ?? "").toLowerCase();
        const statusParam = searchParams.get("status");
        const normalizedStatus = statusParam ? statusParam.toUpperCase() : null;

        let targetScope: PayslipScope | null = null;
        if (scopeParam === "all" && canViewAll) {
            targetScope = "all";
            setActiveScope("all");
        } else if (scopeParam === "mine" && canViewOwn) {
            targetScope = "mine";
            setActiveScope("mine");
        }

        if (normalizedStatus) {
            const statusValue = normalizedStatus === "NOT_ACCEPTED" ? "NOT_ACCEPTED" : normalizedStatus;
            const scopeForFilter = targetScope ?? activeScope;
            const targetFilter = scopeForFilter === "mine" ? mineFilter : allFilter;
            targetFilter.updateRow(targetFilter.rows[0].id, {
                field: "status",
                value: statusValue,
            });
            targetFilter.setOpen(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canViewAll, canViewOwn, permissionsLoading, searchParams]);

    const loadPayslips = useCallback(async (
        scope: PayslipScope,
        targetPage = pages[scope],
        targetPageSize = pageSizes[scope]
    ) => {
        setLoading((prev) => ({ ...prev, [scope]: true }));
        setErrors((prev) => ({ ...prev, [scope]: null }));
        try {
            const data =
                scope === "mine"
                    ? await UserServices.getMyPayslipsPage(targetPage, targetPageSize)
                    : await UserServices.getAllPayslipsPage(targetPage, targetPageSize);
            if (scope === "mine") {
                setMyPayslips(data.items ?? []);
            } else {
                setAllPayslips(data.items ?? []);
            }
            setPages((prev) => ({ ...prev, [scope]: data.page }));
            setTotals((prev) => ({ ...prev, [scope]: data.totalElements }));
            setTotalPagesByScope((prev) => ({ ...prev, [scope]: data.totalPages }));
            setLoaded((prev) => ({ ...prev, [scope]: true }));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load payslips";
            setErrors((prev) => ({ ...prev, [scope]: message }));
        } finally {
            setLoading((prev) => ({ ...prev, [scope]: false }));
        }
    }, [pageSizes, pages]);

    useEffect(() => {
        if (activeScope === "mine" && canViewOwn && !loaded.mine) {
            void loadPayslips("mine");
        }
        if (activeScope === "all" && canViewAll && !loaded.all) {
            void loadPayslips("all");
        }
    }, [activeScope, canViewOwn, canViewAll, loaded, loadPayslips]);

    const filteredPayslips = useMemo(() => {
        return filterPayslipsWithRows(activePayslips, activeFilter.rows).sort((a, b) =>
            b.dateOfIssue.localeCompare(a.dateOfIssue)
        );
    }, [activePayslips, activeFilter.rows]);

    const downloadPayslipPdf = async (payslip: PayslipResponseDTO) => {
        try {
            setDownloadError(null);
            setDownloadId(payslip.payslipId);
            const blob = await UserServices.getPayslipPdf(payslip.payslipId);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `payslip_${payslip.dateOfIssue || payslip.payslipId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to download payslip";
            setDownloadError(message);
        } finally {
            setDownloadId(null);
        }
    };

    const jaaropgaafYears = useMemo(() => {
        const years = new Set<number>();
        myPayslips.forEach((p) => {
            if (typeof p.weekBasedYear === "number" && p.weekBasedYear > 0) years.add(p.weekBasedYear);
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [myPayslips]);

    const [jaaropgaafYear, setJaaropgaafYear] = useState<string | null>(null);
    const downloadJaaropgaaf = async (year: number) => {
        try {
            setDownloadError(null);
            setJaaropgaafYear(String(year));
            const blob = await UserServices.getMyJaaropgaafPdf(year);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `jaaropgaaf_${year}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err: unknown) {
            setDownloadError(err instanceof Error ? err.message : "Failed to download jaaropgaaf");
        } finally {
            setJaaropgaafYear(null);
        }
    };

    const verzamelloonstaatYears = useMemo(() => {
        const years = new Set<number>();
        allPayslips.forEach((p) => {
            if (typeof p.weekBasedYear === "number" && p.weekBasedYear > 0) years.add(p.weekBasedYear);
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [allPayslips]);

    const downloadVerzamelloonstaat = async (year: number) => {
        try {
            setDownloadError(null);
            setJaaropgaafYear("vzl-" + year);
            const blob = await UserServices.getVerzamelloonstaatPdf(year);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `verzamelloonstaat_${year}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err: unknown) {
            setDownloadError(err instanceof Error ? err.message : "Failed to download verzamelloonstaat");
        } finally {
            setJaaropgaafYear(null);
        }
    };

    const [finalizeMsg, setFinalizeMsg] = useState<string | null>(null);
    const finalizeJaaropgaven = async (year: number) => {
        if (!window.confirm(`Finalise and lock all jaaropgaven for ${year}? Employees will receive the locked version.`)) {
            return;
        }
        try {
            setDownloadError(null);
            setFinalizeMsg(null);
            setJaaropgaafYear("fin-" + year);
            const result = await UserServices.finalizeJaaropgaven(year);
            setFinalizeMsg(`Finalised ${result.finalized} jaaropgaven for ${year}.`);
        } catch (err: unknown) {
            setDownloadError(err instanceof Error ? err.message : "Failed to finalise jaaropgaven");
        } finally {
            setJaaropgaafYear(null);
        }
    };

    const headerLabel = activeScope === "mine" ? "My payslips" : "All payslips";
    const canSeeAnyPayslips = canViewOwn || canViewAll;
    const scopeUnavailable =
        (activeScope === "mine" && !canViewOwn) || (activeScope === "all" && !canViewAll);
    const canSwitchScope = canViewOwn && canViewAll;
    const openPayslip = (payslipId: string) => {
        navigate(`/payslips/${payslipId}`);
    };

    return (
        <>
            <Navbar />
            <div className="payslipsPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <div className="pageHeader">
                            {activeScope === "all" ? (
                                <PageBack to="/management" />
                            ) : null}
                            <h1 className="pageTitle">Payslips</h1>
                        </div>
                        <div className="payslipsCard">
                            {permissionsLoading ? (
                                <div className="payslipsNotice">Loading permissions...</div>
                            ) : null}
                            {permissionsError ? (
                                <div className="payslipsError">{permissionsError}</div>
                            ) : null}

                            {!scopeUnavailable && canSeeAnyPayslips ? (
                                <>
                                    <div className="payslipsHeaderRow">
                                        {canSwitchScope ? (
                                            <div className="payslipsTabs" role="tablist" aria-label="Payslip scope">
                                                <button
                                                    type="button"
                                                    className={`payslipsTab${
                                                        activeScope === "mine" ? " payslipsTab--active" : ""
                                                    }`}
                                                    onClick={() => setActiveScope("mine")}
                                                    role="tab"
                                                    aria-selected={activeScope === "mine"}
                                                >
                                                    My payslips
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`payslipsTab${
                                                        activeScope === "all" ? " payslipsTab--active" : ""
                                                    }`}
                                                    onClick={() => setActiveScope("all")}
                                                    role="tab"
                                                    aria-selected={activeScope === "all"}
                                                >
                                                    All payslips
                                                </button>
                                                <div className="payslipsTabMeta">
                                                    {activeScope === "mine"
                                                        ? "Showing payslips assigned to your account."
                                                        : "Showing every company payslip you can access."}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="payslipsTabMeta">
                                                {activeScope === "mine"
                                                    ? "Showing payslips assigned to your account."
                                                    : "Showing every company payslip you can access."}
                                            </div>
                                        )}
                                        <FilterToggleButton controller={activeFilter} />
                                    </div>

                                    {activeScope === "mine" && jaaropgaafYears.length > 0 ? (
                                        <div className="payslipsJaaropgaaf">
                                            <span className="payslipsJaaropgaafLabel">Jaaropgaaf (annual statement):</span>
                                            {jaaropgaafYears.map((year) => (
                                                <button
                                                    key={year}
                                                    type="button"
                                                    className="payslipsJaaropgaafButton"
                                                    disabled={jaaropgaafYear === String(year)}
                                                    onClick={() => { void downloadJaaropgaaf(year); }}
                                                >
                                                    {jaaropgaafYear === String(year) ? `Preparing ${year}...` : `Download ${year}`}
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}

                                    {activeScope === "all" && verzamelloonstaatYears.length > 0 ? (
                                        <div className="payslipsJaaropgaaf">
                                            <span className="payslipsJaaropgaafLabel">Verzamelloonstaat (company-wide):</span>
                                            {verzamelloonstaatYears.map((year) => (
                                                <button
                                                    key={year}
                                                    type="button"
                                                    className="payslipsJaaropgaafButton"
                                                    disabled={jaaropgaafYear === "vzl-" + year}
                                                    onClick={() => { void downloadVerzamelloonstaat(year); }}
                                                >
                                                    {jaaropgaafYear === "vzl-" + year ? `Preparing ${year}...` : `Download ${year}`}
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}

                                    {activeScope === "all" && canManagePayslips && verzamelloonstaatYears.length > 0 ? (
                                        <div className="payslipsJaaropgaaf">
                                            <span className="payslipsJaaropgaafLabel">Finalise jaaropgaven (locks the year):</span>
                                            {verzamelloonstaatYears.map((year) => (
                                                <button
                                                    key={year}
                                                    type="button"
                                                    className="payslipsJaaropgaafButton"
                                                    disabled={jaaropgaafYear === "fin-" + year}
                                                    onClick={() => { void finalizeJaaropgaven(year); }}
                                                >
                                                    {jaaropgaafYear === "fin-" + year ? `Finalising ${year}...` : `Finalise ${year}`}
                                                </button>
                                            ))}
                                            {finalizeMsg ? <span className="payslipsJaaropgaafLabel">{finalizeMsg}</span> : null}
                                        </div>
                                    ) : null}

                                    {downloadError ? (
                                        <div className="payslipsError">{downloadError}</div>
                                    ) : null}

                                    {loading[activeScope] ? (
                                        <div className="payslipsNotice">Loading {headerLabel.toLowerCase()}...</div>
                                    ) : errors[activeScope] ? (
                                        <div className="payslipsError">{errors[activeScope]}</div>
                                    ) : (
                                        <>
                                            <div className="payslipsListCard">
                                                <FilterPanelBody
                                                    controller={activeFilter}
                                                    resultMeta={`${filteredPayslips.length}${
                                                        activePayslips.length !== filteredPayslips.length
                                                            ? ` of ${activePayslips.length}`
                                                            : ""
                                                    } on this page | ${totals[activeScope]} total`}
                                                />
                                                <div className="payslipsListWrap">
                                                    <div
                                                        className={`payslipsListHeader payslipsGrid ${
                                                            activeScope === "all"
                                                                ? "payslipsGrid--all"
                                                                : "payslipsGrid--mine"
                                                        }`}
                                                    >
                                                        <div>Date</div>
                                                        {activeScope === "all" ? <div>User</div> : null}
                                                        <div>Week</div>
                                                        <div>Function</div>
                                                        <div>Hours</div>
                                                        <div>Net</div>
                                                        <div>Status</div>
                                                        <div>Action</div>
                                                    </div>
                                                    <div className="payslipsListBody">
                                                        {filteredPayslips.length === 0 ? (
                                                            <div
                                                                className={`payslipsListRow payslipsListRow--empty payslipsGrid ${
                                                                    activeScope === "all"
                                                                        ? "payslipsGrid--all"
                                                                        : "payslipsGrid--mine"
                                                                }`}
                                                            >
                                                                <div className="payslipsEmptyCell">
                                                                    No payslips match these filters.
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            filteredPayslips.map((payslip) => (
                                                                <div
                                                                    key={payslip.payslipId}
                                                                    className={`payslipsListRow payslipsGrid ${
                                                                        activeScope === "all"
                                                                            ? "payslipsGrid--all"
                                                                            : "payslipsGrid--mine"
                                                                    }`}
                                                                    role="button"
                                                                    tabIndex={0}
                                                                    onClick={() => openPayslip(payslip.payslipId)}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === "Enter" || event.key === " ") {
                                                                            event.preventDefault();
                                                                            openPayslip(payslip.payslipId);
                                                                        }
                                                                    }}
                                                                >
                                                                    <div className="payslipsCellMain" data-label="Date">
                                                                        {formatDate(payslip.dateOfIssue)}
                                                                    </div>
                                                                    {activeScope === "all" ? (
                                                                        <div>
                                                                            <div className="payslipsCellMain">{payslip.name}</div>
                                                                            <div className="payslipsCellSub">{payslip.userId}</div>
                                                                        </div>
                                                                    ) : null}
                                                                    <div className="payslipsCellSub" data-label="Week">
                                                                        {formatWeek(payslip.weekBasedYear, payslip.weekNumber)}
                                                                    </div>
                                                                    <div className="payslipsCellSub" data-label="Function">{payslip.functionName}</div>
                                                                    <div className="payslipsCellSub" data-label="Hours">
                                                                        {formatHours(payslip.totalHoursWorked)}
                                                                    </div>
                                                                    <div className="payslipsCellSub" data-label="Net">
                                                                        {formatCurrency(payslip.totalNetAmount)}
                                                                    </div>
                                                                    <div
                                                                        className={`payslipStatus payslipStatus--${normalizeStatus(
                                                                            payslip.status
                                                                        )}`}
                                                                        data-label="Status"
                                                                    >
                                                                        {formatStatus(payslip.status)}
                                                                    </div>
                                                                    <div data-label="">
                                                                        <button
                                                                            type="button"
                                                                            className="linkButton"
                                                                            disabled={downloadId === payslip.payslipId}
                                                                            onClick={(event) => {
                                                                                event.stopPropagation();
                                                                                void downloadPayslipPdf(payslip);
                                                                            }}
                                                                        >
                                                                            {downloadId === payslip.payslipId
                                                                                ? "Downloading..."
                                                                                : "Download PDF"}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                                <PaginationControls
                                                    page={pages[activeScope]}
                                                    totalPages={totalPagesByScope[activeScope]}
                                                    pageSize={pageSizes[activeScope]}
                                                    loading={loading[activeScope]}
                                                    onPageChange={(nextPage) => void loadPayslips(activeScope, nextPage)}
                                                    onPageSizeChange={(nextPageSize) => {
                                                        setPageSizes((prev) => ({ ...prev, [activeScope]: nextPageSize }));
                                                        setPages((prev) => ({ ...prev, [activeScope]: 0 }));
                                                        void loadPayslips(activeScope, 0, nextPageSize);
                                                    }}
                                                />
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : (
                                <div className="payslipsNotice">
                                    {canSeeAnyPayslips
                                        ? "This payslip view is not available for your account."
                                        : "You do not have permission to view payslips."}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
