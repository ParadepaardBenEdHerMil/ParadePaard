import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import { UserServices, type PlanningEventDTO } from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";
import {
    findShiftRecord,
    getAllocationDisplayName,
    getEventClientName,
    getEventLocation,
    getEventTimeLabel,
    getShiftDisplayName,
    getShiftLocation,
    getShiftStaffingLabel,
    getShiftTimeLabel,
} from "../utils/planningSummary";
import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminPlanningOverview.css";
import "../stylesheets/AdminPlanningDetail.css";

export default function AdminPlanningShiftDetail() {
    const { eventId, shiftId } = useParams<{ eventId: string; shiftId: string }>();
    const [event, setEvent] = useState<PlanningEventDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadShift = useCallback(async () => {
        if (!eventId || !shiftId) {
            setError("Missing event or shift id.");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const company = await UserServices.getMyCompany();
            const data = await UserServices.getPlanningOverview(company.companyId, eventId);
            const selectedEvent = data.find((candidate) => candidate.eventId === eventId) ?? null;

            if (!selectedEvent) {
                setEvent(null);
                setError("Event not found.");
                return;
            }

            const selectedShift = findShiftRecord(selectedEvent, shiftId);
            if (!selectedShift) {
                setEvent(null);
                setError("Shift not found.");
                return;
            }

            setEvent(selectedEvent);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load shift.";
            setError(message);
            setEvent(null);
        } finally {
            setLoading(false);
        }
    }, [eventId, shiftId]);

    useEffect(() => {
        void loadShift();
    }, [loadShift]);

    const shiftRecord = useMemo(() => {
        if (!event || !shiftId) return null;
        return findShiftRecord(event, shiftId);
    }, [event, shiftId]);

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <div className="planningDetailBreadcrumbs">
                            <Link to="/admin/planning" className="planningDetailBackLink">
                                Back to planning
                            </Link>
                            {eventId ? (
                                <Link to={`/admin/planning/events/${eventId}`} className="planningDetailBackLink">
                                    Back to event
                                </Link>
                            ) : null}
                        </div>

                        <header className="pageHeader">
                            <h1 className="pageTitle">Shift</h1>
                            <p className="pageSubtitle">
                                {shiftRecord ? getShiftDisplayName(shiftRecord.shift) : "Planning shift details"}
                            </p>
                        </header>

                        <div className="adminDashboardCard">
                            {loading ? <div className="planningDetailEmpty">Loading shift...</div> : null}
                            {!loading && error ? <div className="planningDetailEmpty planningDetailEmpty--error">{error}</div> : null}

                            {!loading && !error && event && shiftRecord ? (
                                <div className="planningDetailGrid">
                                    <Card title="Shift summary" className="planningDetailCard">
                                        <div className="planningDetailRows">
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Event</span>
                                                <span className="planningDetailValue">{event.eventName}</span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Shift</span>
                                                <span className="planningDetailValue">{getShiftDisplayName(shiftRecord.shift)}</span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Function</span>
                                                <span className="planningDetailValue">{shiftRecord.shift.functionName}</span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Date</span>
                                                <span className="planningDetailValue">{formatDate(shiftRecord.day)}</span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Client</span>
                                                <span className="planningDetailValue">{getEventClientName(event)}</span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Location</span>
                                                <span className="planningDetailValue">{getShiftLocation(event, shiftRecord.shift)}</span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Time</span>
                                                <span className="planningDetailValue">{getShiftTimeLabel(shiftRecord.shift)}</span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Staffing</span>
                                                <span className="planningDetailValue">{getShiftStaffingLabel(shiftRecord.shift)}</span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Status</span>
                                                <span className="planningDetailValue">{shiftRecord.shift.staffingStatus ?? "Open"}</span>
                                            </div>
                                        </div>
                                    </Card>

                                    <Card title={`Assigned team (${shiftRecord.shift.allocations.length})`} className="planningDetailCard">
                                        {shiftRecord.shift.allocations.length === 0 ? (
                                            <div className="planningDetailEmpty">Nobody is scheduled on this shift yet.</div>
                                        ) : (
                                            <div className="planningDetailAssignmentList">
                                                {shiftRecord.shift.allocations.map((allocation) => (
                                                    <div key={allocation.scheduleEntryId} className="planningDetailAssignmentCard">
                                                        <div className="planningDetailShiftHeader">
                                                            <div>
                                                                <div className="planningDetailShiftTitle">
                                                                    {getAllocationDisplayName(allocation)}
                                                                </div>
                                                                <div className="planningDetailShiftMeta">
                                                                    {allocation.functionName || shiftRecord.shift.functionName}
                                                                </div>
                                                            </div>
                                                            <span className="planningEntryBadge">{allocation.status}</span>
                                                        </div>
                                                        <div className="planningDetailMiniRows">
                                                            <div className="planningDetailMiniRow">
                                                                <span className="planningDetailMiniLabel">Time</span>
                                                                <span className="planningDetailMiniValue">
                                                                    {getShiftTimeLabel({
                                                                        ...shiftRecord.shift,
                                                                        startTime: allocation.startTime || shiftRecord.shift.startTime,
                                                                        endTime: allocation.endTime || shiftRecord.shift.endTime,
                                                                    })}
                                                                </span>
                                                            </div>
                                                            <div className="planningDetailMiniRow">
                                                                <span className="planningDetailMiniLabel">User id</span>
                                                                <span className="planningDetailMiniValue">{allocation.userId}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </Card>

                                    <Card title="Event snapshot" className="planningDetailCard">
                                        <div className="planningDetailRows">
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Event name</span>
                                                <span className="planningDetailValue">
                                                    <Link
                                                        to={`/admin/planning/events/${event.eventId}`}
                                                        className="planningDetailInlineLink"
                                                    >
                                                        {event.eventName}
                                                    </Link>
                                                </span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Location</span>
                                                <span className="planningDetailValue">{getEventLocation(event)}</span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Dates</span>
                                                <span className="planningDetailValue">
                                                    {event.startDate === event.endDate
                                                        ? formatDate(event.startDate)
                                                        : `${formatDate(event.startDate)} to ${formatDate(event.endDate)}`}
                                                </span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Event time</span>
                                                <span className="planningDetailValue">{getEventTimeLabel(event)}</span>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
