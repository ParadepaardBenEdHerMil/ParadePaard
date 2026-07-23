import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import Spinner from "../components/Spinner";
import { UserServices, type OpenShiftDTO } from "../services/user-service/UserServices";
import { goBackOrFallback } from "../utils/backNavigation";
import { formatDate } from "../utils/dateFormat";
import { formatTimeAgo } from "../utils/timeAgo";
import "../stylesheets/UserDashboard.css";
import "../stylesheets/MyPlanningShiftDetail.css";
import "../stylesheets/OpenShifts.css";

function timeLabel(startTime: string, endTime: string): string {
    return `${startTime.slice(11, 16)} - ${endTime.slice(11, 16)}`;
}

function getShiftLocation(item: OpenShiftDTO): string {
    return item.shiftLocation?.trim() || item.projectLocation?.trim() || "-";
}

function spotsLabel(item: OpenShiftDTO): string {
    const spots = item.spotsRemaining ?? 0;
    if (spots <= 0) return "Fully staffed";
    return spots === 1 ? "1 spot left" : `${spots} spots left`;
}

export default function OpenShiftDetail() {
    const { shiftId } = useParams<{ shiftId: string }>();
    const navigate = useNavigate();
    const [item, setItem] = useState<OpenShiftDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    // There is no single-shift endpoint, so the detail view reads the same open
    // shifts list the marketplace uses and picks the one being viewed.
    const loadShift = useCallback(async () => {
        if (!shiftId) return;
        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getOpenShifts();
            const found = data.find((shift) => shift.shiftId === shiftId) ?? null;
            setItem(found);
            if (!found) setError("This shift is no longer open.");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load shift");
        } finally {
            setLoading(false);
        }
    }, [shiftId]);

    useEffect(() => {
        void loadShift();
    }, [loadShift]);

    const runShiftAction = async (action: () => Promise<OpenShiftDTO>) => {
        if (!shiftId) return;
        try {
            setError(null);
            setPending(true);
            const updated = await action();
            setItem(updated);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to update your application");
            // The rejection usually means the marketplace is stale (shift filled
            // up or started) — reload so the detail reflects reality.
            await loadShift();
        } finally {
            setPending(false);
        }
    };

    const applied = Boolean(item?.applied);
    const isFull = (item?.spotsRemaining ?? 0) <= 0;

    return (
        <>
            <Navbar />
            <div className="pageShell">
                <PrimaryNav />
                <div className="pageShellContent">
                    <header className="pageHeader">
                        <button
                            type="button"
                            className="button"
                            onClick={() => goBackOrFallback(navigate, "/open-shifts")}
                        >
                            Back
                        </button>
                        <h1 className="pageTitle">Shift Detail</h1>
                    </header>
                    {loading ? (
                        <Spinner text="Loading shift detail" />
                    ) : error && !item ? (
                        <p className="errorText">{error}</p>
                    ) : item ? (
                        <div className="shiftDetailStack">
                            {error ? <p className="errorText">{error}</p> : null}
                            <Card title={item.projectName} className="shiftDetailCard">
                                <div className="generalInfoRows">
                                    <div className="generalInfoRow"><div className="generalInfoLabel">Date</div><div className="generalInfoValue">{formatDate(item.shiftDate)}</div></div>
                                    <div className="generalInfoRow"><div className="generalInfoLabel">Time</div><div className="generalInfoValue">{timeLabel(item.startTime, item.endTime)}</div></div>
                                    <div className="generalInfoRow"><div className="generalInfoLabel">Shift</div><div className="generalInfoValue">{item.shiftName?.trim() || item.functionName}</div></div>
                                    <div className="generalInfoRow"><div className="generalInfoLabel">Function</div><div className="generalInfoValue">{item.functionName}</div></div>
                                    <div className="generalInfoRow"><div className="generalInfoLabel">Location</div><div className="generalInfoValue">{getShiftLocation(item)}</div></div>
                                    <div className="generalInfoRow"><div className="generalInfoLabel">Break</div><div className="generalInfoValue">{item.breakMinutes ?? 0} min</div></div>
                                    <div className="generalInfoRow"><div className="generalInfoLabel">Spots</div><div className="generalInfoValue">{spotsLabel(item)}</div></div>
                                    {item.externalDescription?.trim() ? (
                                        <div className="generalInfoRow"><div className="generalInfoLabel">Description</div><div className="generalInfoValue">{item.externalDescription}</div></div>
                                    ) : null}
                                </div>
                            </Card>

                            <Card title="Apply for this shift" className="shiftDetailCard">
                                <div className="openShiftDetailApply">
                                    <p className="helperText openShiftDetailApplyText">
                                        {applied
                                            ? `You applied ${formatTimeAgo(item.appliedAt)}. The planner will confirm your spot.`
                                            : isFull
                                                ? "This shift is fully staffed. You can no longer apply."
                                                : "Apply to let the planner know you want this shift."}
                                    </p>
                                    <div className="openShiftDetailApplyActions">
                                        {applied ? (
                                            <button
                                                type="button"
                                                className="button userPlanningDeclineButton"
                                                disabled={pending}
                                                onClick={() =>
                                                    void runShiftAction(() =>
                                                        UserServices.withdrawOpenShiftApplication(item.shiftId)
                                                    )
                                                }
                                            >
                                                {pending ? "Withdrawing..." : "Withdraw application"}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className="button userPlanningAcceptButton"
                                                disabled={pending || isFull}
                                                onClick={() =>
                                                    void runShiftAction(() =>
                                                        UserServices.applyToOpenShift(item.shiftId)
                                                    )
                                                }
                                            >
                                                {pending ? "Applying..." : "Apply"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        </div>
                    ) : null}
                </div>
            </div>
        </>
    );
}
