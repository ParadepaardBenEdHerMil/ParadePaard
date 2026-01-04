import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom"; //

import "../../stylesheets/UserDashboard.css"
import "../../stylesheets/GeneralInfo.css";
import "../../stylesheets/common/Card.css";
import "../../stylesheets/Payslips.css";
import "../../stylesheets/LeaveRequests.css";
import "../../stylesheets/Shortcuts.css";

import { UserServices } from "../../services/user-service/UserServices";
import { mapLeaves } from "../../utils/mapLeaveDtoToUi";
import type { LeaveRequestUI } from "../../utils/mapLeaveDtoToUi";
import LeaveRequestModal from "../requests/LeaveRequestModals.tsx";
import type { LeaveRequestForm } from "../requests/LeaveRequestModals.tsx";
import  Card  from "../common/Card.tsx"

type Timesheet = {
    timesheetId: string;
    dateOfIssue: string;
    function: string;
    hoursWorked: number;
};

const BASE_LEAVE_ALLOWANCE_HOURS = 120;

function isoWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d as any) - (yearStart as any)) / 86400000 + 1) / 7);
}

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
    const currentWeek = useMemo(() => isoWeekNumber(new Date()), []);
    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [timesheetLoading, setTimesheetLoading] = useState(false);
    const [timesheetError, setTimesheetError] = useState<string | null>(null);

    // payslips dummy data
    type PayslipRow = { date: string; week: string; id: string; payslip: string };
    const payslips: PayslipRow[] = [
        { date: "2025-11-03", week: "45", id: "PS-2025-45-0012", payslip: "November Week 45" },
        { date: "2025-10-27", week: "44", id: "PS-2025-44-0009", payslip: "October Week 44" },
        { date: "2025-10-20", week: "43", id: "PS-2025-43-0007", payslip: "October Week 43" },
        { date: "2025-10-13", week: "42", id: "PS-2025-42-0005", payslip: "October Week 42" },
        { date: "2025-10-06", week: "41", id: "PS-2025-41-0003", payslip: "October Week 41" },
        { date: "2025-09-29", week: "40", id: "PS-2025-40-0001", payslip: "September Week 40" },
        { date: "2025-09-22", week: "39", id: "PS-2025-39-0001", payslip: "September Week 39" },
        { date: "2025-09-15", week: "38", id: "PS-2025-38-0001", payslip: "September Week 38" },
    ];

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

    const hoursWorkedThisWeek = timesheets
        .filter((t) => isoWeekNumber(new Date(t.dateOfIssue)) === currentWeek)
        .reduce((sum, t) => sum + (t.hoursWorked ?? 0), 0);

    const leaveHoursApproved = list
        .filter((r) => r.status === "APPROVED")
        .reduce((sum, r) => sum + (r.hoursRequested ?? 0), 0);

    const leaveHoursPending = list
        .filter((r) => r.status === "PENDING")
        .reduce((sum, r) => sum + (r.hoursRequested ?? 0), 0);

    const leaveHoursAvailableNow = Math.max(0, BASE_LEAVE_ALLOWANCE_HOURS - leaveHoursApproved);

    return (
        <div className="userDashboardCard">
            <header className="pageHeader">
                <h1 className="pageTitle">User Dashboard</h1>
                <p className="pageSubtitle">Your payroll and leave in one place</p>
            </header>

            <section className="dashboardGrid">
                
                {/* 1. General Information */}
                <Card title="General Information" className="dashboardCardHeight">
                    <div className="generalInfoRows">
                        <div className="generalInfoRow">
                            <div className="generalInfoLabel">Current week</div>
                            <div className="generalInfoValue">Week {currentWeek}</div>
                        </div>
                        <div className="generalInfoRow">
                            <div className="generalInfoLabel">Hours worked this week</div>
                            <div className="generalInfoValue">
                                {timesheetLoading ? "Loading..." : `${hoursWorkedThisWeek.toFixed(1)} h`}
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
                        <button className="button" onClick={() => alert("Open payslips center")}>
                            View all
                        </button>
                    }
                >
                    <div className="payslipContainer">
                        {/* Static Header */}
                        <div className="payslipHeaderGrid">
                            <div className="phCell">Date</div>
                            <div className="phCell">Week</div>
                            <div className="phCell">Payslip ID</div>
                            <div className="phCell">Action</div>
                        </div>
                        {/* Scrollable Body */}
                        <div className="payslipScrollArea">
                            {payslips.map((p) => (
                                <div key={p.id} className="payslipRowGrid">
                                    <div className="pdCell">{p.date}</div>
                                    <div className="pdCell">{p.week}</div>
                                    <div className="pdCell">{p.id}</div>
                                    <div className="pdCell">
                                        <button className="linkButton" onClick={() => alert(`Downloading ${p.id}`)}>
                                            Download
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
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

                {/* 4. Shortcuts */}
                <Card title="Shortcuts" className="dashboardCardHeight">
                    <div className="shortcutList">
                        <button className="shortcutBtn" onClick={() => alert("Open payslip center")}>
                            <div className="shortcutIcon" aria-hidden="true">
                                <svg
                                    viewBox="0 0 24 24"
                                    width="20"
                                    height="20"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <path d="M14 2v6h6" />
                                    <path d="M16 13H8" />
                                    <path d="M16 17H8" />
                                    <path d="M10 9H8" />
                                </svg>
                            </div>
                            <span>Payslips</span>
                        </button>
                        {/* Adjusted Profile Button */}
                        <button className="shortcutBtn" onClick={() => navigate("/profile")}>
                            <div className="shortcutIcon" aria-hidden="true">
                                <svg
                                    viewBox="0 0 24 24"
                                    width="20"
                                    height="20"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M20 21a8 8 0 1 0-16 0" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </div>
                            <span>Profile</span>
                        </button>
                        <button className="shortcutBtn" onClick={() => navigate("/work-history")}>
                            <div className="shortcutIcon" aria-hidden="true">
                                <svg
                                    viewBox="0 0 24 24"
                                    width="20"
                                    height="20"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="12" cy="12" r="9" />
                                    <path d="M12 7v6l4 2" />
                                </svg>
                            </div>
                            <span>Work History</span>
                        </button>
                    </div>
                </Card>

            </section>

            <LeaveRequestModal
                open={openCreate}
                onClose={() => setOpenCreate(false)}
                availableHours={leaveHoursAvailableNow}
                onSubmit={handleCreateFromModal}
            />
        </div>
    );
}
