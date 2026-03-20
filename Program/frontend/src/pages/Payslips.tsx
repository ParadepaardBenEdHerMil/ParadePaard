import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import { AuthServices } from "../services/auth-service/AuthServices";
import { UserServices, type PayslipResponseDTO } from "../services/user-service/UserServices";
import { readCachedIsAdmin, readCachedPermissions, writeCachedIsAdmin, writeCachedPermissions } from "../utils/authCache";
import { formatDate } from "../utils/dateFormat";
import "../stylesheets/PayslipsPage.css";

type PayslipScope = "mine" | "all";

type FilterState = {
    search: string;
    status: string;
    dateFrom: string;
    dateTo: string;
    weekYear: string;
    weekNumber: string;
    minHours: string;
    maxHours: string;
    minNet: string;
    maxNet: string;
};

const createFilters = (): FilterState => ({
    search: "",
    status: "ALL",
    dateFrom: "",
    dateTo: "",
    weekYear: "",
    weekNumber: "",
    minHours: "",
    maxHours: "",
    minNet: "",
    maxNet: "",
});

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

const filterPayslips = (payslips: PayslipResponseDTO[], filters: FilterState) => {
    const term = filters.search.trim().toLowerCase();
    const minHours = parseNumber(filters.minHours);
    const maxHours = parseNumber(filters.maxHours);
    const minNet = parseNumber(filters.minNet);
    const maxNet = parseNumber(filters.maxNet);
    const weekYear = parseNumber(filters.weekYear);
    const weekNumber = parseNumber(filters.weekNumber);

    return payslips.filter((payslip) => {
        const status = normalizeStatus(payslip.status);
        if (filters.status === "NOT_ACCEPTED") {
            if (status === "RELEASED" || status === "APPROVED") return false;
        } else if (filters.status !== "ALL" && status !== filters.status) {
            return false;
        }

        if (term) {
            const haystack = [
                payslip.name,
                payslip.functionName,
                payslip.userId,
                payslip.payslipId,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            if (!haystack.includes(term)) return false;
        }

        if (filters.dateFrom && payslip.dateOfIssue < filters.dateFrom) return false;
        if (filters.dateTo && payslip.dateOfIssue > filters.dateTo) return false;

        if (weekYear !== null && payslip.weekBasedYear !== weekYear) return false;
        if (weekNumber !== null && payslip.weekNumber !== weekNumber) return false;

        const hours = Number(payslip.totalHoursWorked ?? 0);
        const net = Number(payslip.totalNetAmount ?? 0);

        if (minHours !== null && hours < minHours) return false;
        if (maxHours !== null && hours > maxHours) return false;
        if (minNet !== null && net < minNet) return false;
        if (maxNet !== null && net > maxNet) return false;

        return true;
    });
};

export default function Payslips() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const personalView = searchParams.get("view") === "personal";
    const cachedPermissions = useMemo(() => readCachedPermissions(), []);
    const cachedIsAdmin = useMemo(() => readCachedIsAdmin(), []);
    const [isAdmin, setIsAdmin] = useState(cachedIsAdmin ?? false);
    const [permissions, setPermissions] = useState<string[]>(cachedPermissions ?? []);
    const [permissionsLoading, setPermissionsLoading] = useState(cachedPermissions === null);
    const [permissionsError, setPermissionsError] = useState<string | null>(null);

    const [activeScope, setActiveScope] = useState<PayslipScope>("mine");
    const [filters, setFilters] = useState<Record<PayslipScope, FilterState>>(() => ({
        mine: createFilters(),
        all: createFilters(),
    }));

    const [myPayslips, setMyPayslips] = useState<PayslipResponseDTO[]>([]);
    const [allPayslips, setAllPayslips] = useState<PayslipResponseDTO[]>([]);
    const [loading, setLoading] = useState({ mine: false, all: false });
    const [errors, setErrors] = useState<{ mine: string | null; all: string | null }>({
        mine: null,
        all: null,
    });
    const [loaded, setLoaded] = useState({ mine: false, all: false });
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [downloadId, setDownloadId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (cachedPermissions === null) {
            setPermissionsLoading(true);
            setPermissionsError(null);
        }

        Promise.all([AuthServices.getPermissions(), AuthServices.isAdmin()])
            .then(([data, adminValue]) => {
                if (cancelled) return;
                const nextPermissions = data ?? [];
                const nextIsAdmin = Boolean(adminValue);
                setPermissions(nextPermissions);
                setIsAdmin(nextIsAdmin);
                writeCachedPermissions(nextPermissions);
                writeCachedIsAdmin(nextIsAdmin);
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : "Failed to load permissions";
                if (!cancelled && cachedPermissions === null) setPermissionsError(message);
            })
            .finally(() => {
                if (!cancelled) setPermissionsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [cachedPermissions]);

    const canViewOwn = permissions.includes("CAN_VIEW_PAYSLIPS");
    const canViewAll = permissions.includes("CAN_VIEW_ALL_PAYSLIPS");

    useEffect(() => {
        if (permissionsLoading) return;
        if (personalView) {
            setActiveScope("mine");
            return;
        }
        if (isAdmin && canViewAll) {
            setActiveScope("all");
            return;
        }
        if (canViewOwn && activeScope !== "mine" && !canViewAll) {
            setActiveScope("mine");
            return;
        }
        if (canViewAll && activeScope !== "all" && !canViewOwn) {
            setActiveScope("all");
        }
    }, [permissionsLoading, personalView, isAdmin, canViewOwn, canViewAll, activeScope]);

    useEffect(() => {
        if (permissionsLoading) return;
        const scopeParam = (searchParams.get("scope") ?? "").toLowerCase();
        const statusParam = searchParams.get("status");
        const normalizedStatus = statusParam ? statusParam.toUpperCase() : null;

        let targetScope: PayslipScope | null = null;
        if (scopeParam === "all" && canViewAll && !personalView) {
            targetScope = "all";
            setActiveScope("all");
        } else if (scopeParam === "mine" && canViewOwn) {
            targetScope = "mine";
            setActiveScope("mine");
        }

        if (normalizedStatus) {
            const statusValue = normalizedStatus === "NOT_ACCEPTED" ? "NOT_ACCEPTED" : normalizedStatus;
            const scopeForFilter = targetScope ?? activeScope;
            setFilters((prev) => ({
                ...prev,
                [scopeForFilter]: {
                    ...prev[scopeForFilter],
                    status: statusValue,
                },
            }));
        }
    }, [activeScope, canViewAll, canViewOwn, permissionsLoading, searchParams]);

    const loadPayslips = useCallback(async (scope: PayslipScope) => {
        setLoading((prev) => ({ ...prev, [scope]: true }));
        setErrors((prev) => ({ ...prev, [scope]: null }));
        try {
            const data =
                scope === "mine"
                    ? await UserServices.getMyPayslips()
                    : await UserServices.getAllPayslips();
            if (scope === "mine") {
                setMyPayslips(data ?? []);
            } else {
                setAllPayslips(data ?? []);
            }
            setLoaded((prev) => ({ ...prev, [scope]: true }));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load payslips";
            setErrors((prev) => ({ ...prev, [scope]: message }));
        } finally {
            setLoading((prev) => ({ ...prev, [scope]: false }));
        }
    }, []);

    useEffect(() => {
        if (activeScope === "mine" && canViewOwn && !loaded.mine) {
            void loadPayslips("mine");
        }
        if (activeScope === "all" && canViewAll && !loaded.all) {
            void loadPayslips("all");
        }
    }, [activeScope, canViewOwn, canViewAll, loaded, loadPayslips]);

    const activePayslips = activeScope === "mine" ? myPayslips : allPayslips;
    const activeFilters = filters[activeScope];

    const statusOptions = useMemo(() => {
        const statuses = new Set(activePayslips.map((p) => normalizeStatus(p.status)));
        statuses.delete("NOT_ACCEPTED");
        return ["ALL", "NOT_ACCEPTED", ...Array.from(statuses).sort()];
    }, [activePayslips]);
    const searchPlaceholder =
        activeScope === "all"
            ? "Name, function, user ID, payslip ID"
            : "Function or date";

    const filteredPayslips = useMemo(() => {
        return filterPayslips(activePayslips, activeFilters).sort((a, b) =>
            b.dateOfIssue.localeCompare(a.dateOfIssue)
        );
    }, [activePayslips, activeFilters]);

    const updateFilter = (field: keyof FilterState, value: string) => {
        setFilters((prev) => ({
            ...prev,
            [activeScope]: {
                ...prev[activeScope],
                [field]: value,
            },
        }));
    };

    const resetFilters = () => {
        setFilters((prev) => ({
            ...prev,
            [activeScope]: createFilters(),
        }));
    };

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

    const headerLabel = activeScope === "mine" ? "My payslips" : "All payslips";
    const canSeeAnyPayslips = canViewOwn || canViewAll;
    const scopeUnavailable =
        (activeScope === "mine" && !canViewOwn) || (activeScope === "all" && !canViewAll);
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
                                    <div className="payslipsFilterPanel">
                                        <div className="payslipsFilterGrid">
                                            <label className="payslipsFilterField">
                                                <span>Search</span>
                                                <input
                                                    type="search"
                                                    value={activeFilters.search}
                                                    onChange={(e) => updateFilter("search", e.target.value)}
                                                    placeholder={searchPlaceholder}
                                                />
                                            </label>

                                            <label className="payslipsFilterField">
                                                <span>Status</span>
                                                <select
                                                    value={activeFilters.status}
                                                    onChange={(e) => updateFilter("status", e.target.value)}
                                                >
                                                    {statusOptions.map((status) => (
                                                        <option key={status} value={status}>
                                                            {status === "ALL" ? "All statuses" : formatStatus(status)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>

                                            <label className="payslipsFilterField">
                                                <span>Date from</span>
                                                <input
                                                    type="date"
                                                    value={activeFilters.dateFrom}
                                                    onChange={(e) => updateFilter("dateFrom", e.target.value)}
                                                />
                                            </label>

                                            <label className="payslipsFilterField">
                                                <span>Date to</span>
                                                <input
                                                    type="date"
                                                    value={activeFilters.dateTo}
                                                    onChange={(e) => updateFilter("dateTo", e.target.value)}
                                                />
                                            </label>

                                            <label className="payslipsFilterField">
                                                <span>Week year</span>
                                                <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    value={activeFilters.weekYear}
                                                    onChange={(e) => updateFilter("weekYear", e.target.value)}
                                                    placeholder="2026"
                                                />
                                            </label>

                                            <label className="payslipsFilterField">
                                                <span>Week number</span>
                                                <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    value={activeFilters.weekNumber}
                                                    onChange={(e) => updateFilter("weekNumber", e.target.value)}
                                                    placeholder="1-53"
                                                />
                                            </label>

                                            <label className="payslipsFilterField">
                                                <span>Min hours</span>
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    value={activeFilters.minHours}
                                                    onChange={(e) => updateFilter("minHours", e.target.value)}
                                                    placeholder="0"
                                                />
                                            </label>

                                            <label className="payslipsFilterField">
                                                <span>Max hours</span>
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    value={activeFilters.maxHours}
                                                    onChange={(e) => updateFilter("maxHours", e.target.value)}
                                                    placeholder="60"
                                                />
                                            </label>

                                            <label className="payslipsFilterField">
                                                <span>Min net pay</span>
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    value={activeFilters.minNet}
                                                    onChange={(e) => updateFilter("minNet", e.target.value)}
                                                    placeholder="0"
                                                />
                                            </label>

                                            <label className="payslipsFilterField">
                                                <span>Max net pay</span>
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    value={activeFilters.maxNet}
                                                    onChange={(e) => updateFilter("maxNet", e.target.value)}
                                                    placeholder="5000"
                                                />
                                            </label>
                                        </div>
                                        <div className="payslipsFilterActions">
                                            <div className="payslipsFilterMeta">
                                                {filteredPayslips.length} shown
                                                {activePayslips.length !== filteredPayslips.length
                                                    ? ` of ${activePayslips.length}`
                                                    : ""}
                                            </div>
                                            <button type="button" className="buttonSecondary" onClick={resetFilters}>
                                                Reset filters
                                            </button>
                                        </div>
                                    </div>

                                    {downloadError ? (
                                        <div className="payslipsError">{downloadError}</div>
                                    ) : null}

                                    {loading[activeScope] ? (
                                        <div className="payslipsNotice">Loading {headerLabel.toLowerCase()}...</div>
                                    ) : errors[activeScope] ? (
                                        <div className="payslipsError">{errors[activeScope]}</div>
                                    ) : (
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
                                                            <div className="payslipsCellMain">
                                                                {formatDate(payslip.dateOfIssue)}
                                                            </div>
                                                            {activeScope === "all" ? (
                                                                <div>
                                                                    <div className="payslipsCellMain">{payslip.name}</div>
                                                                    <div className="payslipsCellSub">{payslip.userId}</div>
                                                                </div>
                                                            ) : null}
                                                            <div className="payslipsCellSub">
                                                                {formatWeek(payslip.weekBasedYear, payslip.weekNumber)}
                                                            </div>
                                                            <div className="payslipsCellSub">{payslip.functionName}</div>
                                                            <div className="payslipsCellSub">
                                                                {formatHours(payslip.totalHoursWorked)}
                                                            </div>
                                                            <div className="payslipsCellSub">
                                                                {formatCurrency(payslip.totalNetAmount)}
                                                            </div>
                                                            <div
                                                                className={`payslipStatus payslipStatus--${normalizeStatus(
                                                                    payslip.status
                                                                )}`}
                                                            >
                                                                {formatStatus(payslip.status)}
                                                            </div>
                                                            <div>
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
                                    )}
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
