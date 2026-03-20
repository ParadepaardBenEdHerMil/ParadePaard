import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Spinner from "../components/Spinner";
import Card from "../components/common/Card";
import { AuthServices } from "../services/auth-service/AuthServices";
import { UserServices } from "../services/user-service/UserServices";
import "../stylesheets/WorkHistory.css";
import { getIsoWeek, sumHours } from "../utils/hoursSummary";
import { formatDate } from "../utils/dateFormat";

type FilterState = {
    search: string;
    userId: string;
    functionName: string;
    dateFrom: string;
    dateTo: string;
    weekYear: string;
    weekNumber: string;
    minHours: string;
    maxHours: string;
    minTravel: string;
    maxTravel: string;
};

const createFilters = (): FilterState => ({
    search: "",
    userId: "all",
    functionName: "all",
    dateFrom: "",
    dateTo: "",
    weekYear: "",
    weekNumber: "",
    minHours: "",
    maxHours: "",
    minTravel: "",
    maxTravel: "",
});

const parseNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
};

const getDatePart = (value: string) => value.split("T")[0].split(" ")[0];

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
}

export default function WorkHistory() {
    const [searchParams] = useSearchParams();
    const personalView = searchParams.get("view") === "personal";
    const [isAdmin, setIsAdmin] = useState(false);
    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [filters, setFilters] = useState<FilterState>(() => createFilters());
    const showAllTimesheets = isAdmin && !personalView;

    const userOptions = useMemo(() => {
        if (!showAllTimesheets) return [];
        const map = new Map<string, string>();
        timesheets.forEach((t) => {
            if (!t.userId) return;
            map.set(t.userId, t.name ?? t.userId);
        });
        return [...map.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [showAllTimesheets, timesheets]);

    const functionOptions = useMemo(() => {
        const values = new Set<string>();
        timesheets.forEach((t) => {
            if (t.function) values.add(t.function);
        });
        return [...values].sort((a, b) => a.localeCompare(b));
    }, [timesheets]);

    const filteredTimesheets = useMemo(() => {
        const term = filters.search.trim().toLowerCase();
        const minHours = parseNumber(filters.minHours);
        const maxHours = parseNumber(filters.maxHours);
        const minTravel = parseNumber(filters.minTravel);
        const maxTravel = parseNumber(filters.maxTravel);
        const weekYear = parseNumber(filters.weekYear);
        const weekNumber = parseNumber(filters.weekNumber);

        const filtered = timesheets.filter((t) => {
            if (showAllTimesheets && filters.userId !== "all" && t.userId !== filters.userId) {
                return false;
            }
            if (filters.functionName !== "all" && t.function !== filters.functionName) {
                return false;
            }

            if (term) {
                const haystack = [t.name ?? "", t.function ?? "", t.userId ?? "", t.dateOfIssue ?? ""]
                    .join(" ")
                    .toLowerCase();
                if (!haystack.includes(term)) return false;
            }

            const datePart = getDatePart(t.dateOfIssue ?? "");
            if (filters.dateFrom && datePart < filters.dateFrom) return false;
            if (filters.dateTo && datePart > filters.dateTo) return false;

            if (weekYear !== null || weekNumber !== null) {
                const week =
                    t.weekNumber != null && t.weekBasedYear != null
                        ? { weekNumber: t.weekNumber, weekBasedYear: t.weekBasedYear }
                        : getIsoWeek(new Date(`${datePart}T00:00:00Z`));
                if (weekYear !== null && week.weekBasedYear !== weekYear) return false;
                if (weekNumber !== null && week.weekNumber !== weekNumber) return false;
            }

            const hours = Number(t.hoursWorked ?? 0);
            const travel = Number(t.travelExpenses ?? 0);

            if (minHours !== null && hours < minHours) return false;
            if (maxHours !== null && hours > maxHours) return false;
            if (minTravel !== null && travel < minTravel) return false;
            if (maxTravel !== null && travel > maxTravel) return false;

            return true;
        });
        return [...filtered].sort((a, b) => (b.dateOfIssue ?? "").localeCompare(a.dateOfIssue ?? ""));
    }, [filters, showAllTimesheets, timesheets]);
    const totalHours = useMemo(() => sumHours(filteredTimesheets), [filteredTimesheets]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                setLoading(true);
                setErrorMsg(null);
                const data = showAllTimesheets
                    ? await UserServices.getTimesheets()
                    : await UserServices.getMyTimesheets();
                if (!cancelled) setTimesheets(data);
            } catch (err: unknown) {
                const message =
                    err instanceof Error ? err.message : "Failed to load work history";
                if (!cancelled) setErrorMsg(message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [showAllTimesheets]);

    useEffect(() => {
        let cancelled = false;

        AuthServices.isAdmin()
            .then((value) => {
                if (!cancelled) setIsAdmin(Boolean(value));
            })
            .catch(() => {
                if (!cancelled) setIsAdmin(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!showAllTimesheets) {
            setFilters((prev) => (prev.userId === "all" ? prev : { ...prev, userId: "all" }));
        }
    }, [showAllTimesheets]);

    const updateFilter = (field: keyof FilterState, value: string) => {
        setFilters((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const resetFilters = () => {
        setFilters(createFilters());
    };

    const columnCount = showAllTimesheets ? 4 : 3;

    return (
        <>
            <Navbar />
            <div className="workHistoryPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header className="workHistoryHeader">
                            <h1 className="workHistoryTitle">Work History</h1>
                        </header>
                        <div className="workHistoryShell">
                    {loading ? (
                        <div className="workHistoryLoading">
                            <Spinner text="Loading work history" />
                        </div>
                    ) : errorMsg ? (
                        <div className="workHistoryError">{errorMsg}</div>
                    ) : (
                        <Card
                            title="Timesheets"
                            className="workHistoryCard"
                        >
                            <div className="workHistoryFilterPanel">
                                <div className="workHistoryFilterGrid">
                                    <label className="workHistoryFilterField">
                                        <span>Search</span>
                                        <input
                                            type="search"
                                            placeholder={
                                                showAllTimesheets
                                                    ? "Name, function, or employee ID"
                                                    : "Function or date"
                                            }
                                            value={filters.search}
                                            onChange={(e) => updateFilter("search", e.target.value)}
                                        />
                                    </label>

                                    {showAllTimesheets ? (
                                        <label className="workHistoryFilterField">
                                            <span>Employee</span>
                                            <select
                                                value={filters.userId}
                                                onChange={(e) => updateFilter("userId", e.target.value)}
                                            >
                                                <option value="all">All employees</option>
                                                {userOptions.map((user) => (
                                                    <option key={user.id} value={user.id}>
                                                        {user.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    ) : null}

                                    <label className="workHistoryFilterField">
                                        <span>Function</span>
                                        <select
                                            value={filters.functionName}
                                            onChange={(e) => updateFilter("functionName", e.target.value)}
                                        >
                                            <option value="all">All functions</option>
                                            {functionOptions.map((value) => (
                                                <option key={value} value={value}>
                                                    {value}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="workHistoryFilterField">
                                        <span>Date from</span>
                                        <input
                                            type="date"
                                            value={filters.dateFrom}
                                            onChange={(e) => updateFilter("dateFrom", e.target.value)}
                                        />
                                    </label>

                                    <label className="workHistoryFilterField">
                                        <span>Date to</span>
                                        <input
                                            type="date"
                                            value={filters.dateTo}
                                            onChange={(e) => updateFilter("dateTo", e.target.value)}
                                        />
                                    </label>

                                    <label className="workHistoryFilterField">
                                        <span>Week year</span>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            value={filters.weekYear}
                                            onChange={(e) => updateFilter("weekYear", e.target.value)}
                                            placeholder="2026"
                                        />
                                    </label>

                                    <label className="workHistoryFilterField">
                                        <span>Week number</span>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            value={filters.weekNumber}
                                            onChange={(e) => updateFilter("weekNumber", e.target.value)}
                                            placeholder="1-53"
                                        />
                                    </label>

                                    <label className="workHistoryFilterField">
                                        <span>Min hours</span>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            value={filters.minHours}
                                            onChange={(e) => updateFilter("minHours", e.target.value)}
                                            placeholder="0"
                                        />
                                    </label>

                                    <label className="workHistoryFilterField">
                                        <span>Max hours</span>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            value={filters.maxHours}
                                            onChange={(e) => updateFilter("maxHours", e.target.value)}
                                            placeholder="60"
                                        />
                                    </label>

                                    <label className="workHistoryFilterField">
                                        <span>Min travel</span>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            value={filters.minTravel}
                                            onChange={(e) => updateFilter("minTravel", e.target.value)}
                                            placeholder="0"
                                        />
                                    </label>

                                    <label className="workHistoryFilterField">
                                        <span>Max travel</span>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            value={filters.maxTravel}
                                            onChange={(e) => updateFilter("maxTravel", e.target.value)}
                                            placeholder="100"
                                        />
                                    </label>
                                </div>
                                <div className="workHistoryFilterActions">
                                    <div className="workHistoryFilterMeta">
                                        {filteredTimesheets.length} shown
                                        {timesheets.length !== filteredTimesheets.length
                                            ? ` of ${timesheets.length}`
                                            : ""}
                                    </div>
                                    <button
                                        type="button"
                                        className="workHistoryButtonSecondary"
                                        onClick={resetFilters}
                                    >
                                        Reset filters
                                    </button>
                                </div>
                            </div>
                            <div className="workHistoryTableWrap">
                                <table className="workHistoryTable">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            {showAllTimesheets ? <th>Employee</th> : null}
                                            <th>Function</th>
                                            <th className="workHistoryHoursCol">Hours Worked</th>
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
                                                <tr key={t.timesheetId}>
                                                    <td>{formatDate(t.dateOfIssue)}</td>
                                                    {showAllTimesheets ? <td>{t.name ?? "-"}</td> : null}
                                                    <td>{t.function}</td>
                                                    <td className="workHistoryHoursCol">{t.hoursWorked.toFixed(1)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div
                                className={`workHistoryTotalBar${
                                    showAllTimesheets ? " workHistoryTotalBar--admin" : ""
                                }`}
                            >
                                <div className="workHistoryTotalLabel">Total</div>
                                <div className="workHistoryTotalValue">{totalHours.toFixed(1)}</div>
                            </div>
                        </Card>
                    )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
