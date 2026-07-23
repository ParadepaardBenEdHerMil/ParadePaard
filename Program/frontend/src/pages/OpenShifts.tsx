import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import Spinner from "../components/Spinner";
import { FilterPanelBody, FilterToggleButton } from "../components/common/FilterPanel";
import { useFilterPanel } from "../components/common/useFilterPanel";
import type { FilterFieldConfig } from "../components/common/FilterPanel.types";
import { applyFilterRows, dateFromAtLeast, dateToAtMost, equalsNormalized, textIncludes } from "../utils/applyFilterRows";
import { UserServices, type OpenShiftDTO } from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";
import { formatTimeAgo } from "../utils/timeAgo";
import "../stylesheets/UserDashboard.css";
import "../stylesheets/AdminPlanningOverview.css";
import "../stylesheets/OpenShifts.css";

function timeLabel(startTime: string, endTime: string): string {
    return `${startTime.slice(11, 16)} - ${endTime.slice(11, 16)}`;
}

function getShiftLocation(item: OpenShiftDTO): string {
    return item.shiftLocation?.trim() || item.projectLocation?.trim() || "No location yet";
}

function getSpotsLabel(item: OpenShiftDTO): string {
    const spots = item.spotsRemaining ?? 0;
    if (spots <= 0) return "Fully staffed";
    return spots === 1 ? "1 spot left" : `${spots} spots left`;
}

export default function OpenShifts() {
    const [items, setItems] = useState<OpenShiftDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingShiftId, setPendingShiftId] = useState<string | null>(null);

    const loadOpenShifts = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getOpenShifts();
            setItems(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load open shifts");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadOpenShifts();
    }, [loadOpenShifts]);

    const functionOptions = useMemo(() => {
        const names = [...new Set(items.map((item) => item.functionName).filter(Boolean))].sort();
        return names.map((name) => ({ label: name, value: name }));
    }, [items]);

    const filterFields = useMemo<FilterFieldConfig[]>(
        () => [
            {
                field: "search",
                label: "Search",
                section: "Shift",
                placeholder: "Project, shift, function or location",
                kind: { kind: "search" },
            },
            {
                field: "function",
                label: "Function",
                section: "Shift",
                kind: { kind: "select", options: functionOptions, emptyLabel: "Any function" },
            },
            {
                field: "location",
                label: "Location",
                section: "Shift",
                placeholder: "City or venue",
                kind: { kind: "text" },
            },
            {
                field: "dateFrom",
                label: "Date from",
                section: "Date",
                placeholder: "dd/mm/yyyy",
                maxLength: 10,
                kind: { kind: "date" },
            },
            {
                field: "dateTo",
                label: "Date to",
                section: "Date",
                placeholder: "dd/mm/yyyy",
                maxLength: 10,
                kind: { kind: "date" },
            },
        ],
        [functionOptions]
    );

    const filter = useFilterPanel({ fields: filterFields });

    const filteredItems = useMemo(
        () =>
            applyFilterRows(items, filter.rows, {
                search: (item, value) =>
                    textIncludes(item.projectName, value) ||
                    textIncludes(item.shiftName, value) ||
                    textIncludes(item.functionName, value) ||
                    textIncludes(getShiftLocation(item), value),
                function: (item, value) => equalsNormalized(item.functionName, value),
                location: (item, value) => textIncludes(getShiftLocation(item), value),
                dateFrom: (item, value) => dateFromAtLeast(item.shiftDate, value),
                dateTo: (item, value) => dateToAtMost(item.shiftDate, value),
            }),
        [items, filter.rows]
    );

    const runShiftAction = async (shiftId: string, action: () => Promise<OpenShiftDTO>) => {
        try {
            setError(null);
            setPendingShiftId(shiftId);
            const updated = await action();
            setItems((prev) => prev.map((item) => (item.shiftId === shiftId ? updated : item)));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to update your application");
            // The rejection usually means the marketplace is stale (shift
            // filled up or started) — reload so the list reflects reality.
            await loadOpenShifts();
        } finally {
            setPendingShiftId(null);
        }
    };

    return (
        <>
            <Navbar />
            <div className="pageShell">
                <PrimaryNav />
                <div className="pageShellContent">
                    <header className="pageHeader">
                        <h1 className="pageTitle">Open shifts</h1>
                    </header>
                    {loading ? (
                        <Spinner text="Loading open shifts" />
                    ) : (
                        <Card
                            title="Shifts you can apply for"
                            className="openShiftsCard"
                            right={<FilterToggleButton controller={filter} />}
                        >
                            <FilterPanelBody
                                controller={filter}
                                resultMeta={`${filteredItems.length}${
                                    items.length !== filteredItems.length ? ` of ${items.length}` : ""
                                } open shift${items.length === 1 ? "" : "s"}`}
                            />
                            {error ? <p className="errorText openShiftsMessage">{error}</p> : null}
                            {filteredItems.length === 0 ? (
                                <p className="helperText openShiftsMessage">
                                    {items.length === 0
                                        ? "There are no open shifts right now. Check back later."
                                        : "No open shifts match your filters."}
                                </p>
                            ) : (
                                <div className="userPlanningSectionCardList openShiftsList">
                                    {filteredItems.map((item) => {
                                        const applied = Boolean(item.applied);
                                        const isPending = pendingShiftId === item.shiftId;
                                        const isFull = (item.spotsRemaining ?? 0) <= 0;

                                        return (
                                            <article
                                                key={item.shiftId}
                                                className={[
                                                    "userPlanningRequestCard",
                                                    "userPlanningPanelCard",
                                                    "openShiftsItem",
                                                    applied ? "openShiftsItem--applied" : "",
                                                ].filter(Boolean).join(" ")}
                                            >
                                                <div className="userPlanningRequestMain">
                                                    <div className="userPlanningRequestTitle">{item.projectName}</div>
                                                    <div className="userPlanningRequestMeta">
                                                        {formatDate(item.shiftDate)} - {timeLabel(item.startTime, item.endTime)}
                                                    </div>
                                                    <div className="userPlanningRequestMeta">
                                                        {item.functionName} - {getShiftLocation(item)}
                                                    </div>
                                                    {item.externalDescription?.trim() ? (
                                                        <div className="userPlanningRequestMeta openShiftsDescription">
                                                            {item.externalDescription}
                                                        </div>
                                                    ) : null}
                                                    <div className="openShiftsBadges">
                                                        <span
                                                            className={[
                                                                "openShiftsSpotsPill",
                                                                isFull ? "openShiftsSpotsPill--full" : "",
                                                            ].filter(Boolean).join(" ")}
                                                        >
                                                            {getSpotsLabel(item)}
                                                        </span>
                                                        {applied ? (
                                                            <span className="openShiftsAppliedPill">
                                                                Applied {formatTimeAgo(item.appliedAt)}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div className="userPlanningRequestActions">
                                                    {applied ? (
                                                        <button
                                                            type="button"
                                                            className="button userPlanningDeclineButton"
                                                            disabled={Boolean(pendingShiftId)}
                                                            onClick={() =>
                                                                void runShiftAction(item.shiftId, () =>
                                                                    UserServices.withdrawOpenShiftApplication(item.shiftId)
                                                                )
                                                            }
                                                        >
                                                            {isPending ? "Withdrawing..." : "Withdraw"}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="button userPlanningAcceptButton"
                                                            disabled={Boolean(pendingShiftId) || isFull}
                                                            onClick={() =>
                                                                void runShiftAction(item.shiftId, () =>
                                                                    UserServices.applyToOpenShift(item.shiftId)
                                                                )
                                                            }
                                                        >
                                                            {isPending ? "Applying..." : "Apply"}
                                                        </button>
                                                    )}
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>
                    )}
                </div>
            </div>
        </>
    );
}
