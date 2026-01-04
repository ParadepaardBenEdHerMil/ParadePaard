import { type JSX, useEffect, useState, useCallback } from "react";
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

import { UserServices } from "../../services/user-service/UserServices";
import { mapLeaves, type LeaveRequestDTO } from "../../utils/mapLeaveDtoToUi";
import Card from "../common/Card";

// Updated CSS imports
import "../../stylesheets/AdminDashboard.css";
import "../../stylesheets/AdminLists.css";

export default function AdminDashboard(): JSX.Element {
    const navigate = useNavigate();
    const [items, setItems] = useState<AnyRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [open, setOpen] = useState<AnyRequest | null>(null);
    const [acting, setActing] = useState(false);
    const [version, setVersion] = useState(0);

    const reload = useCallback(async () => {
        try {
            setLoading(true);
            setErr(null);
            const dtos: LeaveRequestDTO[] = await UserServices.leaveRequests.list("PENDING");
            const mapped = mapLeaves(dtos) as unknown as AnyRequest[];
            setItems(mapped);
        } catch (e: any) {
            setErr(e?.message || "Failed to load requests");
        } finally {
            setLoading(false);
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

    return (
        <div className="adminDashboardPage">
            
            <div className="adminDashboardCard">
                <header className="pageHeader">
                    <h1 className="pageTitle">Admin Dashboard</h1>
                    <p className="pageSubtitle">Payroll overview and request management</p>
                </header>

                <main className="adminDashboardGrid">
                    
                    {/* 1. General Info */}
                    <Card title="General Info" className="dashboardCardHeight">
                        <div className="statRows">
                            <div className="statRow">
                                <div className="statLabel">Total users</div>
                                <div className="statValue">1,284</div>
                            </div>
                            <div className="statRow">
                                <div className="statLabel">Sick today</div>
                                <div className="statValue">42</div>
                            </div>
                            <div className="statRow">
                                <div className="statLabel">Pending requests</div>
                                <div className="statValue">{items.length}</div>
                            </div>
                        </div>
                        <div className="cardFooter">
                            <button className="button" onClick={() => navigate("/admin/onboarding")}>
                                Onboard employee
                            </button>
                        </div>
                    </Card>

                    {/* 2. Requests (Main Action List) */}
                    <Card 
                        title="Pending Requests" 
                        className="dashboardCardHeight"
                        right={
                            <button className="button" onClick={() => setVersion(v => v+1)} disabled={loading}>
                                Refresh
                            </button>
                        }
                    >
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
                                        <div className="cellMain">{(req as LeaveRequest).by}</div>
                                        <div className="cellSub">
                                            {req.type === "PayslipUpdate" ? "Payslip Fix" : 
                                             req.type === "NewMember" ? "New Member" : "Leave"}
                                        </div>
                                        <div className="cellDate">{(req as LeaveRequest).createdAt}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>

                    {/* 3. Payslip Errors */}
                    <Card title="Payslip Errors" className="dashboardCardHeight">
                        <div className="listContainer">
                            <div className="listHeaderGrid gridErrors">
                                <div>Name</div>
                                <div>Issue</div>
                                <div>Time</div>
                            </div>
                            <div className="listScrollArea">
                                <div className="listRowGrid gridErrors">
                                    <div className="cellMain">J. Smith</div>
                                    <div className="cellBad">Missing bank info</div>
                                    <div className="cellDate">08:15</div>
                                </div>
                                <div className="listRowGrid gridErrors">
                                    <div className="cellMain">A. Garcia</div>
                                    <div className="cellBad">Tax ID mismatch</div>
                                    <div className="cellDate">08:12</div>
                                </div>
                                <div className="listRowGrid gridErrors">
                                    <div className="cellMain">K. Tanaka</div>
                                    <div className="cellBad">Overtime flag</div>
                                    <div className="cellDate">Yesterday</div>
                                </div>
                            </div>
                            <div className="cardFooter">
                                <button className="button buttonSecondary">Review errors</button>
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
                                <div className="listRowGrid gridContracts">
                                    <div className="cellMain">J. Smith</div>
                                    <div className="cellSub">Oct 29</div>
                                    <div className="cellWarn">1 day</div>
                                </div>
                                <div className="listRowGrid gridContracts">
                                    <div className="cellMain">A. Garcia</div>
                                    <div className="cellSub">Nov 2</div>
                                    <div className="cellSub">5 days</div>
                                </div>
                                <div className="listRowGrid gridContracts">
                                    <div className="cellMain">K. Tanaka</div>
                                    <div className="cellSub">Nov 10</div>
                                    <div className="cellSub">13 days</div>
                                </div>
                            </div>
                            <div className="cardFooter">
                                <button className="button buttonSecondary">View details</button>
                            </div>
                        </div>
                    </Card>

                    {/* 5. Calendar */}
                    <Card title="Calendar" className="dashboardCardHeight">
                        <div className="calendarWrapper">
                            <div className="calendarHeader">October 2025</div>
                            <div className="calendarGrid">
                                {["M","T","W","T","F","S","S"].map(d => <div key={d} className="calDayHead">{d}</div>)}
                                <div /> <div /> 
                                {[...Array(31)].map((_, i) => (
                                    <div key={i} className={`calDay ${i === 14 || i === 29 ? "calDayActive" : ""}`}>
                                        {i + 1}
                                    </div>
                                ))}
                            </div>
                            <div className="calendarLegend">
                                <span className="calDot" /> Run day
                            </div>
                        </div>
                    </Card>

                    {/* 6. Payout Check */}
                    <Card title="Payout Check" className="dashboardCardHeight">
                         <div className="listContainer">
                            <div className="listHeaderGrid gridPayouts">
                                <div>Name</div>
                                <div>Payout</div>
                                <div>Status</div>
                            </div>
                            <div className="listScrollArea">
                                <div className="listRowGrid gridPayouts">
                                    <div className="cellMain">J. Smith</div>
                                    <div className="cellSub">Oct 30</div>
                                    <div className="cellOk">Ready</div>
                                </div>
                                <div className="listRowGrid gridPayouts">
                                    <div className="cellMain">A. Garcia</div>
                                    <div className="cellSub">Oct 30</div>
                                    <div className="cellOk">Ready</div>
                                </div>
                                <div className="listRowGrid gridPayouts">
                                    <div className="cellMain">K. Tanaka</div>
                                    <div className="cellSub">Oct 30</div>
                                    <div className="cellOk">Ready</div>
                                </div>
                            </div>
                            <div className="cardFooter">
                                <button className="button">Process Payouts</button>
                            </div>
                        </div>
                    </Card>

                </main>
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
