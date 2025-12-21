import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom"; //

import "../../stylesheets/UserDashboard.css"
import "../../stylesheets/GeneralInfo.css";
import "../../stylesheets/common/Card.css";
import "../../stylesheets/Payslips.css";
import "../../stylesheets/LeaveRequests.css";
import "../../stylesheets/Shortcuts.css";

import { LeaveRequests } from "../../services/user-service/LeaveRequests";
import { mapLeaves } from "../../utils/mapLeaveDtoToUi";
import type { LeaveRequestUI } from "../../utils/mapLeaveDtoToUi";
import LeaveRequestModal from "../requests/LeaveRequestModals.tsx";
import type { LeaveRequestForm } from "../requests/LeaveRequestModals.tsx";
import  Card  from "../common/Card.tsx"

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

    // general info dummy data
    const currentWeek = useMemo(() => isoWeekNumber(new Date()), []);
    const [availableHours] = useState<number>(120);
    const usedHours = 24;
    const totalHours = availableHours + usedHours;

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
                const me = await LeaveRequests.getMe();
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
                const data = await LeaveRequests.listMine(userId);
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

    // create from modal
    const handleCreateFromModal = async (form: LeaveRequestForm) => {
        if (!userId) return;
        try {
            const created = await LeaveRequests.create(userId, {
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
                            <div className="generalInfoLabel">Leave hours available</div>
                            <div className="generalInfoValue">{availableHours} h</div>
                        </div>
                        <div className="generalInfoRow">
                            <div className="generalInfoLabel">Leave hours used</div>
                            <div className="generalInfoValue">{usedHours} h</div>
                        </div>
                        <div className="generalInfoRow">
                            <div className="generalInfoLabel">Total leave hours</div>
                            <div className="generalInfoValue">{totalHours} h</div>
                        </div>
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
                    {meLoading ? <p className="helperText">Loading your account…</p> : null}
                    {meError ? <p className="errorText">{meError}</p> : null}
                    {listLoading ? <p className="helperText">Loading…</p> : null}
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
                            <div className="shortcutIcon">📄</div>
                            <span>Payslips</span>
                        </button>
                        {/* Adjusted Profile Button */}
                        <button className="shortcutBtn" onClick={() => navigate("/profile")}>
                            <div className="shortcutIcon">👤</div>
                            <span>Profile</span>
                        </button>
                        <button className="shortcutBtn" onClick={() => alert("Open calendar")}>
                            <div className="shortcutIcon">📅</div>
                            <span>Calendar</span>
                        </button>
                    </div>
                </Card>

            </section>

            <LeaveRequestModal
                open={openCreate}
                onClose={() => setOpenCreate(false)}
                availableHours={availableHours}
                onSubmit={handleCreateFromModal}
            />
        </div>
    );
}