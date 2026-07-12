import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import Spinner from "../components/Spinner";
import { UserServices, type EmployeePlanningAssignmentDTO } from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";
import "../stylesheets/UserDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/AdminPlanningOverview.css";

type PlanningTab = "upcoming" | "past";

function timeLabel(startTime: string, endTime: string): string {
    return `${startTime.slice(11, 16)} - ${endTime.slice(11, 16)}`;
}

function sortAssignments(items: EmployeePlanningAssignmentDTO[]): EmployeePlanningAssignmentDTO[] {
    return [...items].sort((left, right) => {
        const dateCompare = left.shiftDate.localeCompare(right.shiftDate);
        if (dateCompare !== 0) return dateCompare;
        return left.startTime.localeCompare(right.startTime);
    });
}

export type MyPlanningViewProps = {
    activeTab: PlanningTab;
    scheduledItems: EmployeePlanningAssignmentDTO[];
    acceptedItems: EmployeePlanningAssignmentDTO[];
    loading: boolean;
    error: string | null;
    pendingActionId: string | null;
    onTabChange: (next: PlanningTab) => void;
    onDecline: (scheduleEntryId: string) => void;
    onAccept: (scheduleEntryId: string) => void;
    onOpenShift: (scheduleEntryId: string) => void;
};

export function MyPlanningView({
    activeTab,
    scheduledItems,
    acceptedItems,
    loading,
    error,
    pendingActionId,
    onTabChange,
    onDecline,
    onAccept,
    onOpenShift,
}: MyPlanningViewProps) {
    return (
        <>
            <Navbar />
            <div className="pageShell">
                <PrimaryNav />
                <div className="pageShellContent">
                    <header className="pageHeader">
                        <h1 className="pageTitle">My Planning</h1>
                    </header>
                    {loading ? (
                        <Spinner text="Loading your planning" />
                    ) : (
                        <Card
                            title="Accepted shifts"
                            className="userPlanningCard userPlanningAcceptedCard"
                            right={
                                <div className="planningModeToggle userPlanningStatusToggle">
                                    {([
                                        { value: "upcoming", label: "Upcoming" },
                                        { value: "past", label: "Past" },
                                    ] as const).map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            className={[
                                                "planningModeButton",
                                                activeTab === option.value ? "planningModeButton--active" : "",
                                            ].filter(Boolean).join(" ")}
                                            onClick={() => onTabChange(option.value)}
                                            aria-pressed={activeTab === option.value}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            }
                        >
                            {error ? <p className="errorText userPlanningSectionMessage">{error}</p> : null}
                            {/* key={activeTab} remounts the panel when switching Upcoming/Past so
                                the fade-in animation plays instead of an instant content swap. */}
                            <div className="userPlanningAcceptedLayout userPlanningTabPanel" key={activeTab}>
                                {scheduledItems.length > 0 ? (
                                    <div className="userPlanningSectionCardList userPlanningCardBodyPad--wide">
                                        {scheduledItems.map((item) => {
                                            const isExpiredRequest = Boolean(item.isPast);
                                            return (
                                                <article key={item.scheduleEntryId} className="userPlanningRequestCard userPlanningPanelCard">
                                                    <div className="userPlanningRequestMain">
                                                        <div className="userPlanningRequestTitle">{item.projectName}</div>
                                                        <div className="userPlanningRequestMeta">
                                                            {formatDate(item.shiftDate)} - {timeLabel(item.startTime, item.endTime)}
                                                        </div>
                                                        <div className="userPlanningRequestMeta">
                                                            {item.functionName} - {item.shiftLocation ?? item.projectLocation ?? "Location follows after acceptance"}
                                                        </div>
                                                        {isExpiredRequest ? (
                                                            <div className="userPlanningRequestMeta">
                                                                This request is visible for history, but the shift has already ended.
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                    <div className="userPlanningRequestActions">
                                                        <button
                                                            type="button"
                                                            className="button userPlanningDeclineButton"
                                                            disabled={Boolean(pendingActionId) || isExpiredRequest}
                                                            onClick={() => onDecline(item.scheduleEntryId)}
                                                        >
                                                            {pendingActionId === `${item.scheduleEntryId}:CANCELLED` ? "Declining..." : "Decline"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="button userPlanningAcceptButton"
                                                            disabled={Boolean(pendingActionId) || isExpiredRequest}
                                                            onClick={() => onAccept(item.scheduleEntryId)}
                                                        >
                                                            {pendingActionId === `${item.scheduleEntryId}:CONFIRMED` ? "Accepting..." : "Accept"}
                                                        </button>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                ) : null}

                                <section
                                    className={["userPlanningSection", "userPlanningSection--table", scheduledItems.length > 0 ? "" : "userPlanningSection--flushTop"].filter(Boolean).join(" ")}
                                >
                                    {acceptedItems.length === 0 ? (
                                        <p className="helperText userPlanningSectionMessage userPlanningCardBodyPad--wide">
                                            {activeTab === "past" ? "No past accepted shifts yet." : "No upcoming accepted shifts."}
                                        </p>
                                    ) : (
                                        <div className="listContainer userPlanningAcceptedTable">
                                            <div className="listHeaderGrid userPlanningAcceptedGrid">
                                                <div>Project</div>
                                                <div>Day</div>
                                                <div>Time</div>
                                                <div>Location</div>
                                                <div>Timesheet</div>
                                            </div>
                                            <div className="listScrollArea userPlanningAcceptedScrollArea">
                                                {acceptedItems.map((item) => (
                                                    <button
                                                        key={item.scheduleEntryId}
                                                        type="button"
                                                        className="listRowGrid userPlanningAcceptedGrid clickableRow userPlanningRowButton"
                                                        onClick={() => onOpenShift(item.scheduleEntryId)}
                                                    >
                                                        <div>
                                                            <div className="cellMain">{item.projectName}</div>
                                                            <div className="cellSub">{item.shiftName ?? item.functionName}</div>
                                                        </div>
                                                        <div className="cellSub" data-label="Day">{formatDate(item.shiftDate)}</div>
                                                        <div className="cellSub userPlanningTimeCell" data-label="Time">{timeLabel(item.startTime, item.endTime)}</div>
                                                        <div className="cellSub" data-label="Location">{item.shiftLocation ?? item.projectLocation ?? "-"}</div>
                                                        <div className="cellSub" data-label="Status">
                                                            <span
                                                                className={[
                                                                    "userPlanningStatusPill",
                                                                    item.timesheetExported
                                                                        ? "userPlanningStatusPill--logged"
                                                                        : "userPlanningStatusPill--scheduled",
                                                                ].join(" ")}
                                                            >
                                                                {item.timesheetExported
                                                                    ? "Logged"
                                                                    : activeTab === "past"
                                                                      ? "Pending log"
                                                                      : "Scheduled"}
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </>
    );
}

export default function MyPlanning() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const initialTab = searchParams.get("tab") === "past" ? "past" : "upcoming";
    const [activeTab, setActiveTab] = useState<PlanningTab>(initialTab);
    const [items, setItems] = useState<EmployeePlanningAssignmentDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingActionId, setPendingActionId] = useState<string | null>(null);

    const loadPlanning = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getMyPlanning("all");
            setItems(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load planning");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadPlanning();
    }, [loadPlanning]);

    useEffect(() => {
        const nextParams = new URLSearchParams();
        nextParams.set("tab", activeTab);
        setSearchParams(nextParams, { replace: true });
    }, [activeTab, setSearchParams]);

    const scheduledItems = useMemo(
        () => sortAssignments(
            items.filter((item) => item.status === "ASSIGNED" && (activeTab === "past" ? item.isPast : !item.isPast))
        ),
        [activeTab, items]
    );

    const acceptedItems = useMemo(
        () => sortAssignments(
            items.filter((item) => item.status === "CONFIRMED" && (activeTab === "past" ? item.isPast : !item.isPast))
        ),
        [activeTab, items]
    );

    const respond = async (scheduleEntryId: string, status: "CONFIRMED" | "CANCELLED") => {
        try {
            setPendingActionId(`${scheduleEntryId}:${status}`);
            await UserServices.respondToMyPlanningAssignment(scheduleEntryId, status);
            await loadPlanning();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to update shift");
        } finally {
            setPendingActionId(null);
        }
    };

    return (
        <MyPlanningView
            activeTab={activeTab}
            scheduledItems={scheduledItems}
            acceptedItems={acceptedItems}
            loading={loading}
            error={error}
            pendingActionId={pendingActionId}
            onTabChange={setActiveTab}
            onDecline={(scheduleEntryId) => void respond(scheduleEntryId, "CANCELLED")}
            onAccept={(scheduleEntryId) => void respond(scheduleEntryId, "CONFIRMED")}
            onOpenShift={(scheduleEntryId) =>
                navigate(`/my-planning/${scheduleEntryId}${activeTab === "past" ? "?tab=past" : ""}`)
            }
        />
    );
}
