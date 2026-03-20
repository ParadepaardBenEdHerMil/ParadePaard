import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import { UserServices, type PlanningEventDTO } from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";
import {
    getEventClientName,
    getEventLocation,
    getEventShiftRecords,
    getEventStaffingLabel,
    getEventTimeLabel,
    getShiftDisplayName,
    getShiftLocation,
    getShiftStaffingLabel,
    getShiftTimeLabel,
} from "../utils/planningSummary";
import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminPlanningOverview.css";
import "../stylesheets/AdminPlanningDetail.css";

function formatDateRange(startDate: string, endDate: string): string {
    return startDate === endDate
        ? formatDate(startDate)
        : `${formatDate(startDate)} to ${formatDate(endDate)}`;
}

export default function AdminPlanningEventDetail() {
    const { eventId } = useParams<{ eventId: string }>();
    const [event, setEvent] = useState<PlanningEventDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadEvent = useCallback(async () => {
        if (!eventId) {
            setError("Missing event id.");
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

            setEvent(selectedEvent);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load event.";
            setError(message);
            setEvent(null);
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        void loadEvent();
    }, [loadEvent]);

    const shiftRecords = useMemo(() => (event ? getEventShiftRecords(event) : []), [event]);

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
                        </div>

                        <header className="pageHeader">
                            <h1 className="pageTitle">Event</h1>
                            <p className="pageSubtitle">
                                {event?.eventName ?? "Planning event details"}
                            </p>
                        </header>

                        <div className="adminDashboardCard">
                            {loading ? <div className="planningDetailEmpty">Loading event...</div> : null}
                            {!loading && error ? <div className="planningDetailEmpty planningDetailEmpty--error">{error}</div> : null}

                            {!loading && !error && event ? (
                                <div className="planningDetailGrid">
                                    <Card title="Event summary" className="planningDetailCard">
                                        <div className="planningDetailRows">
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Name</span>
                                                <span className="planningDetailValue">{event.eventName}</span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Client</span>
                                                <span className="planningDetailValue">{getEventClientName(event)}</span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Location</span>
                                                <span className="planningDetailValue">{getEventLocation(event)}</span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Dates</span>
                                                <span className="planningDetailValue">{formatDateRange(event.startDate, event.endDate)}</span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Time</span>
                                                <span className="planningDetailValue">{getEventTimeLabel(event)}</span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Staffing</span>
                                                <span className="planningDetailValue">{getEventStaffingLabel(event)}</span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Status</span>
                                                <span className="planningDetailValue">
                                                    {event.finalized ? "Finalized" : (event.status?.trim() || "Draft")}
                                                </span>
                                            </div>
                                            <div className="planningDetailRow">
                                                <span className="planningDetailLabel">Notes</span>
                                                <span className="planningDetailValue">
                                                    {event.internalDescription?.trim()
                                                        || event.externalDescription?.trim()
                                                        || "No notes added"}
                                                </span>
                                            </div>
                                        </div>
                                    </Card>

                                    <Card title={`Shifts (${shiftRecords.length})`} className="planningDetailCard">
                                        {shiftRecords.length === 0 ? (
                                            <div className="planningDetailEmpty">No shifts created for this event yet.</div>
                                        ) : (
                                            <div className="planningDetailShiftList">
                                                {shiftRecords.map((record) => (
                                                    <Link
                                                        key={record.shift.shiftId}
                                                        to={`/admin/planning/events/${event.eventId}/shifts/${record.shift.shiftId}`}
                                                        className="planningDetailShiftCard"
                                                    >
                                                        <div className="planningDetailShiftHeader">
                                                            <div>
                                                                <div className="planningDetailShiftTitle">
                                                                    {getShiftDisplayName(record.shift)}
                                                                </div>
                                                                <div className="planningDetailShiftMeta">
                                                                    {formatDate(record.day)}
                                                                </div>
                                                            </div>
                                                            <span className="planningEntryBadge">
                                                                {record.shift.staffingStatus ?? "Shift"}
                                                            </span>
                                                        </div>

                                                        <div className="planningDetailMiniRows">
                                                            <div className="planningDetailMiniRow">
                                                                <span className="planningDetailMiniLabel">Staffing</span>
                                                                <span className="planningDetailMiniValue">{getShiftStaffingLabel(record.shift)}</span>
                                                            </div>
                                                            <div className="planningDetailMiniRow">
                                                                <span className="planningDetailMiniLabel">Location</span>
                                                                <span className="planningDetailMiniValue">{getShiftLocation(event, record.shift)}</span>
                                                            </div>
                                                            <div className="planningDetailMiniRow">
                                                                <span className="planningDetailMiniLabel">Time</span>
                                                                <span className="planningDetailMiniValue">{getShiftTimeLabel(record.shift)}</span>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
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
