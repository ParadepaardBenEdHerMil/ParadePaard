import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom"; //

import "../../stylesheets/UserDashboard.css"
import "../../stylesheets/GeneralInfo.css";
import "../../stylesheets/common/Card.css";
import "../../stylesheets/Payslips.css";
import "../../stylesheets/LeaveRequests.css";
import "../../stylesheets/AdminPlanningOverview.css";

import { UserServices, type PayslipResponseDTO, type PlanningEventDTO } from "../../services/user-service/UserServices";
import { mapLeaves } from "../../utils/mapLeaveDtoToUi";
import type { LeaveRequestUI } from "../../utils/mapLeaveDtoToUi";
import LeaveRequestModal from "../requests/LeaveRequestModals.tsx";
import type { LeaveRequestForm } from "../requests/LeaveRequestModals.tsx";
import  Card  from "../common/Card.tsx"
import Modal from "../common/Modal";
import PrimaryNav from "../PrimaryNav";
import { summarizeHours } from "../../utils/hoursSummary";
import { formatDate } from "../../utils/dateFormat";
import {
    applyPlanningFilters,
    flattenPlanningEvents,
    groupPlanningRows,
    summarizePlanningRows,
    type PlanningExplorerFilters,
    type PlanningGroupKey,
} from "../../utils/planningExplorer";

type Timesheet = {
    timesheetId: string;
    dateOfIssue: string;
    function: string;
    hoursWorked: number;
};

const BASE_LEAVE_ALLOWANCE_HOURS = 120;
const MAX_ERROR_TITLE_LENGTH = 80;
const USER_PLANNING_FILTERS: PlanningExplorerFilters = {
    rangeMode: "upcoming",
    startDate: "",
    endDate: "",
    eventId: "",
    employeeId: "",
    status: "ALL",
};

const USER_GROUP_OPTIONS: Array<{ value: PlanningGroupKey; label: string }> = [
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
    { value: "event", label: "Event" },
];

export default function UserDashboard() {
    const navigate = useNavigate(); //
    
    // me
    const [userId, setUserId] = useState<string | null>(null);
    const [meLoading, setMeLoading] = useState(true);
    const [meError, setMeError] = useState<string | null>(null);

    // my leaves
    const [list, setList] = useState<LeaveRequestUI[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [listError, setListError] = useState<string | null>(null);

    // modal
    const [openCreate, setOpenCreate] = useState(false);

    // general info
    const now = useMemo(() => new Date(), []);
    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [timesheetLoading, setTimesheetLoading] = useState(false);
    const [timesheetError, setTimesheetError] = useState<string | null>(null);

    // payslips (real)
    const [payslips, setPayslips] = useState<PayslipResponseDTO[]>([]);
    const [payslipLoading, setPayslipLoading] = useState(false);
    const [payslipError, setPayslipError] = useState<string | null>(null);

    // report payslip error
    const [reportOpen, setReportOpen] = useState(false);
    const [reportPayslip, setReportPayslip] = useState<PayslipResponseDTO | null>(null);
    const [reportTitle, setReportTitle] = useState("");
    const [reportNote, setReportNote] = useState("");
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);

    // planning
    const [planningEvents, setPlanningEvents] = useState<PlanningEventDTO[]>([]);
    const [planningLoading, setPlanningLoading] = useState(false);
    const [planningError, setPlanningError] = useState<string | null>(null);
    const [planningFilters, setPlanningFilters] = useState<PlanningExplorerFilters>(USER_PLANNING_FILTERS);
    const [planningGroupBy, setPlanningGroupBy] = useState<PlanningGroupKey>("day");

    // fetch me
    useEffect(() => {
        const fetchMe = async () => {
            setMeLoading(true);
            try {
                const me = await UserServices.getMe();
                setUserId(me.userId);
                setMeError(null);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Could not load current user";
                setMeError(msg);
            } finally {
                setMeLoading(false);
            }
        };
        fetchMe();
    }, []);

    // fetch my leaves
    useEffect(() => {
        if (!userId) return;
        const fetchMyLeaves = async () => {
            setListLoading(true);
            try {
                const data = await UserServices.leaveRequests.listMine(userId);
                const ui = mapLeaves(data);
                setList(ui);
                setListError(null);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Could not load your leave requests";
                setListError(msg);
            } finally {
                setListLoading(false);
            }
        };
        fetchMyLeaves();
    }, [userId]);

    // fetch my timesheets (work history)
    useEffect(() => {
        let cancelled = false;

        const fetchTimesheets = async () => {
            try {
                setTimesheetLoading(true);
                setTimesheetError(null);
                const data = await UserServices.getMyTimesheets();
                if (!cancelled) setTimesheets(data);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Could not load your timesheets";
                if (!cancelled) setTimesheetError(msg);
            } finally {
                if (!cancelled) setTimesheetLoading(false);
            }
        };

        void fetchTimesheets();
        return () => {
            cancelled = true;
        };
    }, []);

    // fetch my payslips
    const fetchPayslips = useCallback(
        async (isCancelled?: () => boolean) => {
            const cancelled = isCancelled ? isCancelled() : false;
            if (cancelled) return;
            try {
                setPayslipLoading(true);
                setPayslipError(null);
                const data = await UserServices.getMyPayslips();
                if (!isCancelled?.()) setPayslips(data);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Could not load your payslips";
                if (!isCancelled?.()) setPayslipError(msg);
            } finally {
                if (!isCancelled?.()) setPayslipLoading(false);
            }
        },
        []
    );

    useEffect(() => {
        let cancelled = false;
        if (!meLoading && !meError) void fetchPayslips(() => cancelled);
        return () => {
            cancelled = true;
        };
    }, [meLoading, meError, fetchPayslips]);

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;

        const fetchPlanning = async () => {
            try {
                setPlanningLoading(true);
                setPlanningError(null);
                const company = await UserServices.getMyCompany();
                const data = await UserServices.getPlanningOverview(company.companyId);
                if (!cancelled) setPlanningEvents(data);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Could not load your planning";
                if (!cancelled) setPlanningError(msg);
            } finally {
                if (!cancelled) setPlanningLoading(false);
            }
        };

        void fetchPlanning();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    const money = (n: number | null | undefined) =>
        new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(n ?? 0));

    const downloadPayslipPdf = async (payslipId: string, filename: string) => {
        const blob = await UserServices.getPayslipPdf(payslipId);
        const url = URL.createObjectURL(blob);
        try {
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            a.remove();
        } finally {
            URL.revokeObjectURL(url);
        }
    };

    const openReportModal = (payslip: PayslipResponseDTO) => {
        setReportPayslip(payslip);
        setReportTitle("");
        setReportNote("");
        setReportError(null);
        setReportOpen(true);
    };

    const closeReportModal = (force = false) => {
        if (reportSubmitting && !force) return;
        setReportOpen(false);
        setReportPayslip(null);
        setReportTitle("");
        setReportNote("");
        setReportError(null);
    };

    const handleSubmitReport = async () => {
        if (!reportPayslip) return;
        const title = reportTitle.trim();
        const note = reportNote.trim();
        if (!title) {
            setReportError("Please add a short title for the issue.");
            return;
        }
        const combined = note ? `${title}
${note}` : title;
        try {
            setReportSubmitting(true);
            setReportError(null);
            await UserServices.reportPayslipError(reportPayslip.payslipId, { errorDescription: combined });
            closeReportModal(true);
            await fetchPayslips();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Could not report the payslip error";
            setReportError(msg);
        } finally {
            setReportSubmitting(false);
        }
    };

    // create from modal
    const handleCreateFromModal = async (form: LeaveRequestForm) => {
        if (!userId) return;
        try {
            const created = await UserServices.leaveRequests.create(userId, {
                type: form.type,
                startDate: form.fromDate,
                endDate: form.toDate,
                hours: form.totalHours,
                reason: form.note,
            });
            const [createdUI] = mapLeaves([created]);
            setList((old) => [createdUI, ...old]);
            setOpenCreate(false);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Create failed";
            setListError(msg);
        }
    };

    const hoursSummary = useMemo(() => summarizeHours(timesheets, now), [timesheets, now]);

    const leaveHoursApproved = list
        .filter((r) => r.status === "APPROVED")
        .reduce((sum, r) => sum + (r.hoursRequested ?? 0), 0);

    const leaveHoursPending = list
        .filter((r) => r.status === "PENDING")
        .reduce((sum, r) => sum + (r.hoursRequested ?? 0), 0);

    const leaveHoursAvailableNow = Math.max(0, BASE_LEAVE_ALLOWANCE_HOURS - leaveHoursApproved);

    const myPlanningRows = useMemo(() => {
        if (!userId) return [];
        return applyPlanningFilters(
            flattenPlanningEvents(planningEvents),
            {
                ...planningFilters,
                employeeId: userId,
            }
        );
    }, [planningEvents, planningFilters, userId]);

    const myPlanningGroups = useMemo(
        () => groupPlanningRows(myPlanningRows, planningGroupBy, "none"),
        [myPlanningRows, planningGroupBy]
    );

    const myPlanningSummary = useMemo(
        () => summarizePlanningRows(myPlanningRows),
        [myPlanningRows]
    );

    const renderPlanningGroup = (label: string, rows: ReturnType<typeof flattenPlanningEvents>) => (
        <section key={label} className="planningGroupSection userPlanningGroup">
            <div className="planningGroupHeader">
                <div className="planningGroupTitleBlock">
                    <div className="planningGroupTitle">{label}</div>
                    <div className="planningMetaSecondary">
                        {rows.length} shift{rows.length === 1 ? "" : "s"}
                    </div>
                </div>
            </div>
            <div className="listContainer planningAllocationList">
                <div className="listHeaderGrid userPlanningGrid">
                    <div>Event</div>
                    <div>Day</div>
                    <div>Time</div>
                    <div>Function</div>
                    <div>Status</div>
                </div>
                <div className="listScrollArea planningScrollArea userPlanningScrollArea">
                    {rows.map((row) => (
                        <div key={row.rowId} className="listRowGrid userPlanningGrid">
                            <div className="cellMain">{row.eventName}</div>
                            <div className="cellSub">{formatDate(row.shiftDate)}</div>
                            <div className="cellSub">{row.startTime.slice(11, 16)} - {row.endTime.slice(11, 16)}</div>
                            <div className="cellSub">{row.functionName}</div>
                            <div className={`cellSub ${row.status === "CONFIRMED" ? "cellOk" : row.status === "ASSIGNED" ? "cellWarn" : "cellSub"}`}>
                                {row.status}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );

    return (
        <div className="pageShell">
            <PrimaryNav />
            <div className="pageShellContent">
                <header className="pageHeader">
                    <h1 className="pageTitle">User Dashboard</h1>
                </header>
                <div className="userDashboardCard">
                    <section className="dashboardGrid">
                
                {/* 1. General Information */}
                <Card title="General Information" className="dashboardCardHeight">
                    <div className="generalInfoRows">
                        <div className="generalInfoRow">
                            <div className="generalInfoLabel">Current week</div>
                            <div className="generalInfoValue">
                                Week {hoursSummary.week.weekNumber} ({hoursSummary.week.weekBasedYear})
                            </div>
                        </div>
                        <div className="generalInfoRow">
                            <div className="generalInfoLabel">Hours worked this week</div>
                            <div className="generalInfoValue">
                                {timesheetLoading ? "Loading..." : `${hoursSummary.weekHours.toFixed(1)} h`}
                            </div>
                        </div>
                        <div className="generalInfoRow">
                            <div className="generalInfoLabel">Hours worked this month</div>
                            <div className="generalInfoValue">
                                {timesheetLoading ? "Loading..." : `${hoursSummary.monthHours.toFixed(1)} h`}
                            </div>
                        </div>
                        <div className="generalInfoRow">
                            <div className="generalInfoLabel">Hours worked this year</div>
                            <div className="generalInfoValue">
                                {timesheetLoading ? "Loading..." : `${hoursSummary.yearHours.toFixed(1)} h`}
                            </div>
                        </div>
                        <div className="generalInfoRow">
                            <div className="generalInfoLabel">Total hours worked</div>
                            <div className="generalInfoValue">
                                {timesheetLoading ? "Loading..." : `${hoursSummary.totalHours.toFixed(1)} h`}
                            </div>
                        </div>
                        <div className="generalInfoRow">
                            <div className="generalInfoLabel">Leave hours left</div>
                            <div className="generalInfoValue">{leaveHoursAvailableNow.toFixed(1)} h</div>
                        </div>
                        <div className="generalInfoRow">
                            <div className="generalInfoLabel">Leave hours pending</div>
                            <div className="generalInfoValue">{leaveHoursPending.toFixed(1)} h</div>
                        </div>
                        <div className="generalInfoRow">
                            <div className="generalInfoLabel">Leave hours approved</div>
                            <div className="generalInfoValue">{leaveHoursApproved.toFixed(1)} h</div>
                        </div>
                        {timesheetError ? (
                            <div className="generalInfoRow">
                                <div className="generalInfoLabel">Timesheets</div>
                                <div className="generalInfoValue">{timesheetError}</div>
                            </div>
                        ) : null}
                    </div>
                </Card>

                {/* 2. Payslips */}
                <Card
                    title="Payslips"
                    className="dashboardCardHeight"
                    right={
                        <button className="button" onClick={() => navigate("/payslips")}>
                            View all
                        </button>
                    }
                >
                    <div className="payslipContainer">
                        {/* Static Header */}
                        <div className="payslipHeaderGrid">
                            <div className="phCell">Date</div>
                            <div className="phCell">Week</div>
                            <div className="phCell">Function</div>
                            <div className="phCell">Hours</div>
                            <div className="phCell">Net</div>
                            <div className="phCell">Action</div>
                        </div>
                        {/* Scrollable Body */}
                        <div className="payslipScrollArea">
                            {payslipLoading ? (
                                <div className="payslipRowGrid">
                                    <div className="pdCell">Loading...</div>
                                    <div className="pdCell"></div>
                                    <div className="pdCell"></div>
                                    <div className="pdCell"></div>
                                    <div className="pdCell"></div>
                                    <div className="pdCell"></div>
                                </div>
                            ) : null}

                            {payslipError ? (
                                <div className="payslipRowGrid">
                                    <div className="pdCell">{payslipError}</div>
                                    <div className="pdCell"></div>
                                    <div className="pdCell"></div>
                                    <div className="pdCell"></div>
                                    <div className="pdCell"></div>
                                    <div className="pdCell"></div>
                                </div>
                            ) : null}

                            {!payslipLoading && !payslipError && payslips.length === 0 ? (
                                <div className="payslipRowGrid">
                                    <div className="pdCell">No payslips yet</div>
                                    <div className="pdCell"></div>
                                    <div className="pdCell"></div>
                                    <div className="pdCell"></div>
                                    <div className="pdCell"></div>
                                    <div className="pdCell"></div>
                                </div>
                            ) : null}

                            {!payslipLoading && !payslipError
                                ? payslips.map((p) => (
                                      <div key={p.payslipId} className="payslipRowGrid">
                                          <div className="pdCell">{formatDate(p.dateOfIssue)}</div>
                                          <div className="pdCell">{p.weekNumber}</div>
                                          <div className="pdCell">{p.functionName}</div>
                                          <div className="pdCell">{Number(p.totalHoursWorked ?? 0).toFixed(2)}</div>
                                          <div className="pdCell">{money(p.totalNetAmount)}</div>
                                          <div className="pdCell">
                                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                  <button
                                                      className="linkButton"
                                                      onClick={() =>
                                                          void downloadPayslipPdf(
                                                              p.payslipId,
                                                              `payslip_${p.weekBasedYear}_W${p.weekNumber}.pdf`
                                                          )
                                                      }
                                                  >
                                                      Download
                                                  </button>
                                                  {(p.status ?? "").toUpperCase() === "DISPUTED" ? (
                                                      <span style={{ fontSize: 12, color: "#777" }}>Reported</span>
                                                  ) : (
                                                      <button
                                                          className="linkButton"
                                                          onClick={() => openReportModal(p)}
                                                      >
                                                          Report error
                                                      </button>
                                                  )}
                                              </div>
                                          </div>
                                      </div>
                                  ))
                                : null}
                        </div>
                    </div>
                </Card>

                <Card
                    title="My planning"
                    className="dashboardCardHeight userPlanningCard"
                    right={
                        <div className="planningToolbar">
                            <label className="planningFilterField">
                                <span className="planningFilterLabel">Range</span>
                                <select
                                    className="uiSelect"
                                    value={planningFilters.rangeMode}
                                    onChange={(e) =>
                                        setPlanningFilters((current) => ({
                                            ...current,
                                            rangeMode: e.target.value as PlanningExplorerFilters["rangeMode"],
                                            startDate: "",
                                            endDate: "",
                                        }))
                                    }
                                >
                                    <option value="upcoming">Upcoming</option>
                                    <option value="thisWeek">This week</option>
                                    <option value="thisMonth">This month</option>
                                    <option value="all">All</option>
                                </select>
                            </label>
                            <label className="planningFilterField">
                                <span className="planningFilterLabel">Group by</span>
                                <select
                                    className="uiSelect"
                                    value={planningGroupBy}
                                    onChange={(e) => setPlanningGroupBy(e.target.value as PlanningGroupKey)}
                                >
                                    {USER_GROUP_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    }
                >
                    {planningLoading ? <p className="helperText">Loading planning...</p> : null}
                    {planningError ? <p className="errorText">{planningError}</p> : null}
                    {!planningLoading && !planningError ? (
                        <div className="planningOverviewLayout">
                            <div className="planningSummaryBar">
                                <div className="planningSummaryItem">
                                    <span className="planningMetaLabel">Upcoming shifts</span>
                                    <span className="planningMetaValue">{myPlanningSummary.shiftCount}</span>
                                </div>
                                <div className="planningSummaryItem">
                                    <span className="planningMetaLabel">Assigned</span>
                                    <span className="planningMetaValue">{myPlanningSummary.assignedCount}</span>
                                </div>
                            </div>

                            {myPlanningRows.length === 0 ? (
                                <p className="requestListEmpty">No shifts match this view.</p>
                            ) : (
                                <div className="planningGroupList">
                                    {myPlanningGroups.map((group) => renderPlanningGroup(group.label, group.rows))}
                                </div>
                            )}
                        </div>
                    ) : null}
                </Card>

                {/* 3. My leave requests */}
                <Card
                    title="My leave requests"
                    className="dashboardCardHeight"
                    right={
                        <button
                            className="button"
                            onClick={() => setOpenCreate(true)}
                            disabled={meLoading || !!meError}
                        >
                            New Request
                        </button>
                    }
                >
                    {meLoading ? <p className="helperText">Loading your account...</p> : null}
                    {meError ? <p className="errorText">{meError}</p> : null}
                    {listLoading ? <p className="helperText">Loading...</p> : null}
                    {listError ? <p className="errorText">{listError}</p> : null}

                    {!listLoading && !listError ? (
                        <div className="requestScrollArea">
                            {list.length === 0 ? <p className="requestListEmpty">No leave requests yet</p> : null}

                            <ul className="requestList">
                                {list.map((r) => (
                                    <li key={r.id} className="requestListRow">
                                        <div className="requestMainLine">
                                            <span className="reqDateRange">{r.fromDate} to {r.toDate}</span>
                                            <span className="reqTotalHours">{r.hoursRequested}h</span>
                                            <span className={`statusText status${r.status.charAt(0) + r.status.slice(1).toLowerCase()}`}>
                                                {r.status}
                                            </span>
                                        </div>
                                        {r.note && (
                                            <div className="requestNoteLine">
                                                Note: {r.note}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </Card>

                    </section>

                    <LeaveRequestModal
                        open={openCreate}
                        onClose={() => setOpenCreate(false)}
                        availableHours={leaveHoursAvailableNow}
                        onSubmit={handleCreateFromModal}
                    />

                    <Modal
                        open={reportOpen}
                        onClose={closeReportModal}
                        title="Report payslip error"
                    >
                        <div className="section_block">
                            <p className="section_text">
                                Describe what looks wrong so payroll can review it.
                            </p>
                        </div>
                        <div className="section_block">
                            <label htmlFor="payslip-error-title" className="section_title">
                                Error title
                            </label>
                            <input
                                id="payslip-error-title"
                                className="modal_input"
                                type="text"
                                maxLength={MAX_ERROR_TITLE_LENGTH}
                                placeholder="Short summary (e.g., Missing travel costs)"
                                value={reportTitle}
                                onChange={(e) => setReportTitle(e.target.value)}
                                disabled={reportSubmitting}
                            />
                        </div>
                        <div className="section_block">
                            <label htmlFor="payslip-error-note" className="section_title">
                                Error note
                            </label>
                            <textarea
                                id="payslip-error-note"
                                className="modal_input"
                                rows={4}
                                placeholder="Add any extra details that help payroll fix it."
                                value={reportNote}
                                onChange={(e) => setReportNote(e.target.value)}
                                disabled={reportSubmitting}
                            />
                            {reportError ? <p className="text_bad">{reportError}</p> : null}
                        </div>
                        <div className="actions_row">
                            <button className="btn" onClick={() => void handleSubmitReport()} disabled={reportSubmitting}>
                                {reportSubmitting ? "Submitting..." : "Submit report"}
                            </button>
                        </div>
                    </Modal>
                </div>
            </div>
        </div>
    );
}
