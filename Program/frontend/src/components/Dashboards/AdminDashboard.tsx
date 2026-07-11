import { type JSX, useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import {
    type AnyRequest,
    type LeaveRequest,
    type PayslipUpdateRequest,
    type NewMemberRequest,
    AdminLeaveRequestModal,
    PayslipUpdateRequestModal,
    NewMemberRequestModal,
} from "../requests/RequestModals";

import {
    UserServices,
    type PayslipResponseDTO,
    type TimesheetRow,
    type UserResponseDTO,
    type ContractResponseDTO,
} from "../../services/user-service/UserServices";
import { mapLeaves, type LeaveRequestDTO } from "../../utils/mapLeaveDtoToUi";
import Card from "../common/Card";
import {
    buildTimeframeOptions,
    filterTimesheetsByTimeframe,
    getIsoWeek,
    sumHours,
    sumHoursByUserForTimeframe,
    summarizeHours,
    type Timeframe,
} from "../../utils/hoursSummary";
import { formatDate, formatDateObject, formatMaybeDateTime } from "../../utils/dateFormat";
import PrimaryNav from "../PrimaryNav";

// Updated CSS imports
import "../../stylesheets/AdminDashboard.css";
import "../../stylesheets/AdminLists.css";

function formatUserName(user: UserResponseDTO): string {
    const parts = [user.firstNames, user.middleNamePrefix, user.lastName]
        .map((part) => (part ?? "").trim())
        .filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    const preferred = (user.preferredName ?? "").trim();
    return preferred || user.email;
}

function extractErrorTitle(value?: string | null): string {
    if (!value) return "";
    const parts = value.split(/\r?\n/).map((part) => part.trim()).filter(Boolean);
    return parts[0] ?? "";
}

export default function AdminDashboard(): JSX.Element {
    const navigate = useNavigate();
    const [items, setItems] = useState<AnyRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [reviewPayslips, setReviewPayslips] = useState<PayslipResponseDTO[]>([]);
    const [reviewLoading, setReviewLoading] = useState(true);
    const [reviewErr, setReviewErr] = useState<string | null>(null);
    const [timesheets, setTimesheets] = useState<TimesheetRow[]>([]);
    const [timesheetLoading, setTimesheetLoading] = useState(true);
    const [timesheetErr, setTimesheetErr] = useState<string | null>(null);
    const [contracts, setContracts] = useState<ContractResponseDTO[]>([]);
    const [contractsLoading, setContractsLoading] = useState(true);
    const [contractsErr, setContractsErr] = useState<string | null>(null);
    const [users, setUsers] = useState<UserResponseDTO[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [usersErr, setUsersErr] = useState<string | null>(null);
    const timeframeOptions = useMemo(() => buildTimeframeOptions(timesheets), [timesheets]);
    const [timeframe, setTimeframe] = useState<Timeframe>({ kind: "all" });
    const [timeframeInitialized, setTimeframeInitialized] = useState(false);
    const yearOptions = useMemo(() => {
        const nowYear = new Date().getFullYear();
        const years = new Set<number>(timeframeOptions.years);
        years.add(nowYear);
        for (let i = 1; i <= 5; i++) years.add(nowYear - i);
        return [...years].sort((a, b) => b - a);
    }, [timeframeOptions.years]);
    const [hoursView, setHoursView] = useState<"summary" | "history">("summary");
    const [open, setOpen] = useState<AnyRequest | null>(null);
    const [acting, setActing] = useState(false);
    const [version, setVersion] = useState(0);
    const now = useMemo(() => new Date(), []);

    const reload = useCallback(async () => {
        try {
            setLoading(true);
            setErr(null);
            setReviewLoading(true);
            setReviewErr(null);
            setTimesheetLoading(true);
            setTimesheetErr(null);
            setUsersLoading(true);
            setUsersErr(null);
            setContractsLoading(true);
            setContractsErr(null);

            const [leaveRes, reviewRes, timesheetRes, usersRes, contractsRes] = await Promise.allSettled([
                UserServices.leaveRequests.list("PENDING"),
                UserServices.getPayslipsForReview(),
                UserServices.getTimesheets(),
                UserServices.getUsers(),
                UserServices.getContracts(),
            ]);

            const usersData = usersRes.status === "fulfilled" ? usersRes.value : null;
            const usersByIdLocal = usersData
                ? new Map(usersData.map((u) => [u.userId, u]))
                : null;

            if (leaveRes.status === "fulfilled") {
                const mapped = mapLeaves(leaveRes.value as LeaveRequestDTO[]).map((req) => {
                    if (usersByIdLocal && req.userId) {
                        const user = usersByIdLocal.get(req.userId);
                        if (user) {
                            return { ...req, by: formatUserName(user) };
                        }
                    }
                    return req;
                }) as unknown as AnyRequest[];
                setItems(mapped);
            } else {
                setErr((leaveRes.reason as any)?.message || "Failed to load requests");
            }

            if (reviewRes.status === "fulfilled") {
                setReviewPayslips(reviewRes.value);
            } else {
                setReviewErr((reviewRes.reason as any)?.message || "Failed to load payslips for review");
            }

            if (timesheetRes.status === "fulfilled") {
                setTimesheets(timesheetRes.value);
            } else {
                setTimesheetErr((timesheetRes.reason as any)?.message || "Failed to load timesheets");
            }

            if (usersRes.status === "fulfilled") {
                setUsers(usersRes.value);
            } else {
                setUsersErr((usersRes.reason as any)?.message || "Failed to load users");
            }

            if (contractsRes.status === "fulfilled") {
                setContracts(contractsRes.value);
            } else {
                setContractsErr((contractsRes.reason as any)?.message || "Failed to load contracts");
            }
        } catch (e: any) {
            setErr(e?.message || "Failed to load requests");
        } finally {
            setLoading(false);
            setReviewLoading(false);
            setTimesheetLoading(false);
            setUsersLoading(false);
            setContractsLoading(false);
        }
    }, []);

    useEffect(() => {
        void reload();
    }, [version, reload]);

    const handleApprove = async (id: string) => {
        try {
            setActing(true);
            await UserServices.leaveRequests.approve(id);
            setOpen(null);
            setVersion((v) => v + 1);
        } catch (e: any) {
            alert(e?.message || "Approve failed");
        } finally {
            setActing(false);
        }
    };

    const handleReject = async (id: string, reason?: string) => {
        try {
            setActing(true);
            await UserServices.leaveRequests.reject(id, reason);
            setOpen(null);
            setVersion((v) => v + 1);
        } catch (e: any) {
            alert(e?.message || "Reject failed");
        } finally {
            setActing(false);
        }
    };

    useEffect(() => {
        if (timeframeInitialized) return;
        if (timesheets.length === 0) return;
        if (timeframeOptions.weeks.length > 0) {
            const latest = timeframeOptions.weeks[0];
            setTimeframe({ kind: "week", ...latest });
            setTimeframeInitialized(true);
        } else if (timeframeOptions.months.length > 0) {
            const latest = timeframeOptions.months[0];
            setTimeframe({ kind: "month", ...latest });
            setTimeframeInitialized(true);
        } else if (timeframeOptions.years.length > 0) {
            setTimeframe({ kind: "year", year: timeframeOptions.years[0] });
            setTimeframeInitialized(true);
        }
    }, [timeframeInitialized, timeframeOptions.months, timeframeOptions.weeks, timeframeOptions.years, timesheets.length]);

    const filteredTimesheets = useMemo(() => {
        const filtered = filterTimesheetsByTimeframe(timesheets, timeframe);
        return [...filtered].sort((a, b) => (b.dateOfIssue ?? "").localeCompare(a.dateOfIssue ?? ""));
    }, [timesheets, timeframe]);
    const totalHours = useMemo(() => sumHours(filteredTimesheets), [filteredTimesheets]);
    const perUser = useMemo(() => sumHoursByUserForTimeframe(timesheets, timeframe), [timesheets, timeframe]);
    const hoursSummary = useMemo(() => summarizeHours(timesheets, now), [timesheets, now]);
    const activeUsers = useMemo(
        () => users.filter((u) => u.status === "ACTIVE").length,
        [users]
    );
    const pendingSetupUsers = useMemo(
        () => users.filter((u) => u.status === "PENDING_SETUP").length,
        [users]
    );

    const formatCount = (value: number) => value.toLocaleString("nl-NL");
    const usersTotalValue = usersLoading ? "Loading..." : usersErr ? "-" : formatCount(users.length);
    const usersStatusValue = usersLoading
        ? "Loading..."
        : usersErr
            ? "-"
            : `${formatCount(activeUsers)} / ${formatCount(pendingSetupUsers)}`;
    const pendingRequestsValue = loading ? "Loading..." : err ? "-" : formatCount(items.length);
    const pendingReviewValue = reviewLoading ? "Loading..." : reviewErr ? "-" : formatCount(reviewPayslips.length);
    const hoursWeekValue = timesheetLoading ? "Loading..." : timesheetErr ? "-" : `${hoursSummary.weekHours.toFixed(1)} h`;
    const hoursMonthValue = timesheetLoading ? "Loading..." : timesheetErr ? "-" : `${hoursSummary.monthHours.toFixed(1)} h`;
    const hoursYearValue = timesheetLoading ? "Loading..." : timesheetErr ? "-" : `${hoursSummary.yearHours.toFixed(1)} h`;

    const displayNameForUser = useCallback((user?: UserResponseDTO | null) => {
        if (!user) return "-";
        return formatUserName(user);
    }, []);

    const usersById = useMemo(() => {
        const map = new Map<string, UserResponseDTO>();
        users.forEach((u) => {
            map.set(u.userId, u);
        });
        return map;
    }, [users]);

    const payslipIssues = useMemo(() => {
        return reviewPayslips
            .filter((p) => {
                const status = (p.status ?? "").toUpperCase();
                const hasError = Boolean((p.errorDescription ?? "").trim());
                return status === "DISPUTED" || status === "NEEDS_ATTENTION" || hasError;
            })
            .map((p) => {
                const status = (p.status ?? "").toUpperCase();
                const description = (p.errorDescription ?? "").trim();
                const title = extractErrorTitle(description);
                const issue = title
                    ? title
                    : status === "DISPUTED"
                        ? "Reported by user"
                        : status === "NEEDS_ATTENTION"
                            ? "Needs attention"
                            : "Needs review";
                const issueClass = status === "DISPUTED" ? "cellBad" : status === "NEEDS_ATTENTION" ? "cellWarn" : "cellSub";
                const timeRaw = p.availableToUserAt ?? p.generatedAt ?? p.dateOfIssue ?? "";
                const time = timeRaw ? formatMaybeDateTime(timeRaw) : "-";
                return {
                    ...p,
                    issue,
                    issueClass,
                    time,
                    timeRaw,
                };
            })
            .sort((a, b) => (b.timeRaw ?? "").localeCompare(a.timeRaw ?? ""));
    }, [reviewPayslips]);

    const today = useMemo(() => new Date(), []);
    const startOfTodayUtc = useMemo(
        () => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())),
        [today]
    );
    const endOfWindowUtc = useMemo(() => {
        const next = new Date(startOfTodayUtc.getTime());
        next.setUTCMonth(next.getUTCMonth() + 1);
        return next;
    }, [startOfTodayUtc]);

    const parseDateUtc = (dateValue?: string | null) => {
        if (!dateValue) return null;
        const date = new Date(`${dateValue}T00:00:00Z`);
        return Number.isNaN(date.getTime()) ? null : date;
    };

    const upcomingContracts = useMemo(() => {
        const rows = contracts
            .map((contract) => {
                const endDate = parseDateUtc(contract.endDate ?? undefined);
                return { contract, endDate };
            })
            .filter((row) => row.endDate)
            .filter((row) => {
                const date = row.endDate as Date;
                return date >= startOfTodayUtc && date <= endOfWindowUtc;
            })
            .sort((a, b) => (a.endDate as Date).getTime() - (b.endDate as Date).getTime())
            .map((row) => {
                const endDate = row.endDate as Date;
                const diffDays = Math.ceil((endDate.getTime() - startOfTodayUtc.getTime()) / 86400000);
                const user = usersById.get(row.contract.userId);
                return {
                    contractId: row.contract.contractId,
                    userId: row.contract.userId,
                    name: displayNameForUser(user),
                    endDate,
                    daysLeft: diffDays,
                };
            });
        return rows;
    }, [contracts, displayNameForUser, endOfWindowUtc, startOfTodayUtc, usersById]);

    return (
        <div className="adminDashboardPage">
            <div className="pageShell">
                <PrimaryNav />
                <div className="pageShellContent">
                    <header className="pageHeader">
                        <h1 className="pageTitle">Management Dashboard</h1>
                    </header>
                    <div className="adminDashboardCard">
                        <main className="adminDashboardGrid">
                    
                    {/* 1. General Info */}
                    <Card
                        title="General Info"
                        className="dashboardCardHeight"
                        right={
                            <button className="button" onClick={() => navigate("/management/planning")}>
                                Open planning overview
                            </button>
                        }
                    >
                        <div className="statRows">
                            <div className="statRow">
                                <div className="statLabel">Current week</div>
                                <div className="statValue">
                                    Week {hoursSummary.week.weekNumber} ({hoursSummary.week.weekBasedYear})
                                </div>
                            </div>
                            <div className="statRow">
                                <div className="statLabel">Team hours this week</div>
                                <div className="statValue">{hoursWeekValue}</div>
                            </div>
                            <div className="statRow">
                                <div className="statLabel">Team hours this month</div>
                                <div className="statValue">{hoursMonthValue}</div>
                            </div>
                            <div className="statRow">
                                <div className="statLabel">Team hours this year</div>
                                <div className="statValue">{hoursYearValue}</div>
                            </div>
                            <div className="statRow">
                                <div className="statLabel">Total users</div>
                                <div className="statValue">{usersTotalValue}</div>
                            </div>
                            <div className="statRow">
                                <div className="statLabel">Active / pending setup</div>
                                <div className="statValue">{usersStatusValue}</div>
                            </div>
                            <div className="statRow">
                                <div className="statLabel">Pending leave requests</div>
                                <div className="statValue">{pendingRequestsValue}</div>
                            </div>
                            <div className="statRow">
                                <div className="statLabel">Payslips pending review</div>
                                <div className="statValue">{pendingReviewValue}</div>
                            </div>
                        </div>
                    </Card>

                    {/* 2. Hours worked */}
                    <Card
                        title="Hours Worked"
                        className="dashboardCardHeight"
                        right={
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                <select
                                    className="uiSelect"
                                    value={hoursView}
                                    onChange={(e) => setHoursView(e.target.value as "summary" | "history")}
                                    aria-label="Select hours view"
                                >
                                    <option value="summary">Per user</option>
                                    <option value="history">Timesheets</option>
                                </select>

                                <select
                                    className="uiSelect"
                                    value={timeframe.kind}
                                    onChange={(e) => {
                                        const kind = e.target.value as Timeframe["kind"];
                                        if (kind === "all") setTimeframe({ kind });
                                        if (kind === "week") {
                                            const latest = timeframeOptions.weeks[0];
                                            const fallback = getIsoWeek(new Date());
                                            setTimeframe(latest ? { kind, ...latest } : { kind, ...fallback });
                                        }
                                        if (kind === "month") {
                                            const latest = timeframeOptions.months[0];
                                            const now = new Date();
                                            setTimeframe(
                                                latest ? { kind, ...latest } : { kind, year: now.getFullYear(), month: now.getMonth() + 1 }
                                            );
                                        }
                                        if (kind === "year") {
                                            const latest = timeframeOptions.years[0];
                                            const nowYear = new Date().getFullYear();
                                            setTimeframe(typeof latest === "number" ? { kind, year: latest } : { kind, year: nowYear });
                                        }
                                    }}
                                    disabled={timesheetLoading || timesheets.length === 0}
                                    aria-label="Select timeframe type"
                                >
                                    <option value="week">Week</option>
                                    <option value="month">Month</option>
                                    <option value="year">Year</option>
                                    <option value="all">All</option>
                                </select>

                                {timeframe.kind === "week" ? (
                                    <>
                                        <select
                                            className="uiSelect"
                                            value={String(timeframe.weekBasedYear)}
                                            onChange={(e) =>
                                                setTimeframe({
                                                    kind: "week",
                                                    weekBasedYear: Number(e.target.value),
                                                    weekNumber: timeframe.weekNumber,
                                                })
                                            }
                                            disabled={timesheetLoading}
                                            aria-label="Select week-based year"
                                        >
                                            {yearOptions.map((y) => (
                                                <option key={y} value={String(y)}>
                                                    {y}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            className="uiSelect"
                                            value={String(timeframe.weekNumber)}
                                            onChange={(e) =>
                                                setTimeframe({
                                                    kind: "week",
                                                    weekBasedYear: timeframe.weekBasedYear,
                                                    weekNumber: Number(e.target.value),
                                                })
                                            }
                                            disabled={timesheetLoading}
                                            aria-label="Select week number"
                                        >
                                            {Array.from({ length: 53 }, (_, i) => i + 1).map((w) => (
                                                <option key={w} value={String(w)}>
                                                    Week {w}
                                                </option>
                                            ))}
                                        </select>
                                    </>
                                ) : null}

                                {timeframe.kind === "month" ? (
                                    <>
                                        <select
                                            className="uiSelect"
                                            value={String(timeframe.year)}
                                            onChange={(e) =>
                                                setTimeframe({ kind: "month", year: Number(e.target.value), month: timeframe.month })
                                            }
                                            disabled={timesheetLoading}
                                            aria-label="Select year"
                                        >
                                            {yearOptions.map((y) => (
                                                <option key={y} value={String(y)}>
                                                    {y}
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            className="uiSelect"
                                            value={String(timeframe.month)}
                                            onChange={(e) =>
                                                setTimeframe({ kind: "month", year: timeframe.year, month: Number(e.target.value) })
                                            }
                                            disabled={timesheetLoading}
                                            aria-label="Select month"
                                        >
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                                <option key={m} value={String(m)}>
                                                    Month {String(m).padStart(2, "0")}
                                                </option>
                                            ))}
                                        </select>
                                    </>
                                ) : null}

                                {timeframe.kind === "year" ? (
                                    <select
                                        className="uiSelect"
                                        value={String(timeframe.year)}
                                        onChange={(e) => setTimeframe({ kind: "year", year: Number(e.target.value) })}
                                        disabled={timesheetLoading}
                                        aria-label="Select year"
                                    >
                                        {yearOptions.map((y) => (
                                            <option key={y} value={String(y)}>
                                                Year {y}
                                            </option>
                                        ))}
                                    </select>
                                ) : null}
                            </div>
                        }
                    >
                        <div className="listContainer">
                            {hoursView === "summary" ? (
                                <>
                                    <div className="listHeaderGrid gridUserHours">
                                        <div>Name</div>
                                        <div className="cellDate">Hours</div>
                                    </div>
                                    <div className="listScrollArea" style={{ maxHeight: 320 }}>
                                        {timesheetLoading ? <div className="listEmpty">Loading...</div> : null}
                                        {timesheetErr ? <div className="listEmpty errorText">{timesheetErr}</div> : null}
                                        {!timesheetLoading && !timesheetErr && perUser.users.length === 0 ? (
                                            <div className="listEmpty">No timesheets found</div>
                                        ) : null}

                                        {!timesheetLoading && !timesheetErr
                                            ? perUser.users.map((u) => (
                                                  <div key={u.userId} className="listRowGrid gridUserHours">
                                                      <button
                                                          type="button"
                                                          className="listLink"
                                                          onClick={() => navigate(`/management/users/${u.userId}`)}
                                                      >
                                                          {u.name}
                                                      </button>
                                                      <div className="cellDate">{u.totalHours.toFixed(1)} h</div>
                                                  </div>
                                              ))
                                            : null}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="listHeaderGrid gridTimesheetHistory">
                                        <div>Date</div>
                                        <div>Name</div>
                                        <div>Function</div>
                                        <div className="cellDate">Hours</div>
                                    </div>
                                    <div className="listScrollArea" style={{ maxHeight: 320 }}>
                                        {timesheetLoading ? <div className="listEmpty">Loading...</div> : null}
                                        {timesheetErr ? <div className="listEmpty errorText">{timesheetErr}</div> : null}
                                        {!timesheetLoading && !timesheetErr && filteredTimesheets.length === 0 ? (
                                            <div className="listEmpty">No timesheets found</div>
                                        ) : null}

                                        {!timesheetLoading && !timesheetErr
                                            ? filteredTimesheets.map((t) => (
                                                  <div key={t.timesheetId} className="listRowGrid gridTimesheetHistory">
                                                      <div className="cellSub" data-label="Date">{formatDate(t.dateOfIssue)}</div>
                                                      <button
                                                          type="button"
                                                          className="listLink"
                                                          onClick={() => navigate(`/management/users/${t.userId}`)}
                                                      >
                                                          {t.name}
                                                      </button>
                                                      <div className="cellSub" data-label="Function">{t.function}</div>
                                                      <div className="cellDate" data-label="Hours">{Number(t.hoursWorked ?? 0).toFixed(1)} h</div>
                                                  </div>
                                              ))
                                            : null}
                                    </div>
                                </>
                            )}

                            <div className="cardFooter">
                                <div style={{ marginRight: "auto", fontSize: 12, color: "#666" }}>
                                    Total: {totalHours.toFixed(1)} h
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* 2. Requests (Main Action List) */}
                    <Card title="Pending Requests" className="dashboardCardHeight">
                        <div className="listContainer">
                            {/* Fixed Header */}
                            <div className="listHeaderGrid gridRequests">
                                <div>Name</div>
                                <div>Type</div>
                                <div>Date</div>
                            </div>
                            
                            {/* Scrollable Body */}
                            <div className="listScrollArea">
                                {loading && <div className="listEmpty">Loading...</div>}
                                {err && <div className="listEmpty errorText">{err}</div>}
                                {!loading && !err && items.length === 0 && (
                                    <div className="listEmpty">No pending requests</div>
                                )}
                                
                                {items.map((req) => (
                                    <div 
                                        key={req.id} 
                                        className="listRowGrid gridRequests clickableRow"
                                        onClick={() => setOpen(req)}
                                    >
                                        {req.userId ? (
                                            <button
                                                type="button"
                                                className="listLink"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    navigate(`/management/users/${req.userId}`);
                                                }}
                                            >
                                                {(req as LeaveRequest).by}
                                            </button>
                                        ) : (
                                            <div className="cellMain">{(req as LeaveRequest).by}</div>
                                        )}
                                        <div className="cellSub" data-label="Type">
                                            {req.type === "PayslipUpdate" ? "Payslip Fix" :
                                             req.type === "NewMember" ? "New Member" : "Leave"}
                                        </div>
                                        <div className="cellDate" data-label="Date">{formatMaybeDateTime((req as LeaveRequest).createdAt)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>

                    {/* 3. Payslip Errors */}
                    <Card
                        title="Payslip Errors"
                        className="dashboardCardHeight"
                        right={
                            <button
                                className="button"
                                onClick={() => navigate("/payslips?scope=all&status=NOT_ACCEPTED")}
                            >
                                Review payslip issues
                            </button>
                        }
                    >
                        <div className="listContainer">
                            <div className="listHeaderGrid gridErrors">
                                <div>Name</div>
                                <div>Issue</div>
                                <div>Date</div>
                            </div>
                            <div className="listScrollArea">
                                {reviewLoading ? <div className="listEmpty">Loading...</div> : null}
                                {reviewErr ? <div className="listEmpty errorText">{reviewErr}</div> : null}
                                {!reviewLoading && !reviewErr && payslipIssues.length === 0 ? (
                                    <div className="listEmpty">No payslip errors</div>
                                ) : null}

                                {!reviewLoading && !reviewErr
                                    ? payslipIssues.slice(0, 6).map((p) => (
                                          <div
                                              key={p.payslipId}
                                              className="listRowGrid gridErrors clickableRow"
                                              onClick={() => navigate(`/management/payslips/${p.payslipId}`)}
                                          >
                                              <button
                                                  type="button"
                                                  className="listLink"
                                                  onClick={(event) => {
                                                      event.stopPropagation();
                                                      navigate(`/management/users/${p.userId}`);
                                                  }}
                                              >
                                                  {p.name}
                                              </button>
                                              <div className={p.issueClass} data-label="Issue">{p.issue}</div>
                                              <div className="cellDate" data-label="Date">{p.time}</div>
                                          </div>
                                      ))
                                    : null}
                            </div>
                        </div>
                    </Card>

                    {/* 4. Contract Endings */}
                    <Card title="Contract End" className="dashboardCardHeight">
                        <div className="listContainer">
                            <div className="listHeaderGrid gridContracts">
                                <div>Name</div>
                                <div>End Date</div>
                                <div>Left</div>
                            </div>
                            <div className="listScrollArea">
                                {contractsLoading ? <div className="listEmpty">Loading...</div> : null}
                                {contractsErr ? <div className="listEmpty errorText">{contractsErr}</div> : null}
                                {!contractsLoading && !contractsErr && upcomingContracts.length === 0 ? (
                                    <div className="listEmpty">No contracts ending in the next month</div>
                                ) : null}

                                {!contractsLoading && !contractsErr
                                    ? upcomingContracts.map((row) => (
                                          <div key={row.contractId} className="listRowGrid gridContracts">
                                              <button
                                                  type="button"
                                                  className="listLink"
                                                  onClick={() => navigate(`/management/users/${row.userId}`)}
                                              >
                                                  {row.name}
                                              </button>
                                              <div className="cellSub" data-label="End date">{formatDateObject(row.endDate)}</div>
                                              <div className={row.daysLeft <= 3 ? "cellWarn" : "cellSub"} data-label="Left">
                                                  {row.daysLeft <= 0 ? "Today" : `${row.daysLeft} days`}
                                              </div>
                                          </div>
                                      ))
                                    : null}
                            </div>
                        </div>
                    </Card>

                    {/* 6. Payslip Review */}
                    <Card
                        title="Payslip Review"
                        className="dashboardCardHeight"
                        right={
                            <button className="button" onClick={() => navigate("/management/payslip-review")}>
                                View all payslips
                            </button>
                        }
                    >
                         <div className="listContainer">
                            <div className="listHeaderGrid gridPayouts">
                                <div>Name</div>
                                <div>Payout</div>
                                <div>Status</div>
                            </div>
                            <div className="listScrollArea">
                                {reviewLoading ? <div className="listEmpty">Loading...</div> : null}
                                {reviewErr ? <div className="listEmpty errorText">{reviewErr}</div> : null}
                                {!reviewLoading && !reviewErr && reviewPayslips.length === 0 ? (
                                    <div className="listEmpty">No payslips pending review</div>
                                ) : null}

                                {!reviewLoading && !reviewErr
                                    ? [...reviewPayslips]
                                          .sort((a, b) => (a.availableToUserAt ?? "").localeCompare(b.availableToUserAt ?? ""))
                                          .slice(0, 6)
                                          .map((p) => (
                                              <div
                                                  key={p.payslipId}
                                                  className="listRowGrid gridPayouts clickableRow"
                                                  onClick={() => navigate("/management/payslip-review")}
                                              >
                                                  <button
                                                      type="button"
                                                      className="listLink"
                                                      onClick={(event) => {
                                                          event.stopPropagation();
                                                          navigate(`/management/users/${p.userId}`);
                                                      }}
                                                  >
                                                      {p.name}
                                                  </button>
                                                  <div className="cellSub" data-label="Payout">{formatDate(p.availableToUserAt)}</div>
                                                  <div className="cellWarn" data-label="Status">Pending</div>
                                              </div>
                                          ))
                                    : null}
                            </div>
                        </div>
                    </Card>

                        </main>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {open?.type === "Leave" && (
                <AdminLeaveRequestModal
                    open={true}
                    onClose={() => setOpen(null)}
                    data={open as LeaveRequest}
                    onApprove={handleApprove}
                    onReject={handleReject}
                />
            )}
            {open?.type === "PayslipUpdate" && (
                <PayslipUpdateRequestModal
                    open={true}
                    onClose={() => setOpen(null)}
                    data={open as PayslipUpdateRequest}
                    onMarkFixed={() => alert("Marked fixed")}
                    onAskInfo={() => alert("Asked for more info")}
                />
            )}
            {open?.type === "NewMember" && (
                <NewMemberRequestModal
                    open={true}
                    onClose={() => setOpen(null)}
                    data={open as NewMemberRequest}
                    onApprove={() => alert("Approved")}
                    onReject={() => alert("Rejected")}
                />
            )}
            {acting && <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.2)', zIndex:2000}} />}
        </div>
    );
}
