import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import { FilterPanelBody, FilterToggleButton } from "../components/common/FilterPanel";
import { useFilterPanel } from "../components/common/useFilterPanel";
import type { FilterFieldConfig } from "../components/common/FilterPanel.types";
import { applyFilterRows, dateFromAtLeast, dateToAtMost, equalsNormalized, textIncludes } from "../utils/applyFilterRows";
import { UserServices, type OpenShiftDTO } from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";
import { formatTimeAgo } from "../utils/timeAgo";
import "../stylesheets/PageShell.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/OpenShifts.css";

function timeLabel(startTime: string, endTime: string): string {
    return `${startTime.slice(11, 16)} - ${endTime.slice(11, 16)}`;
}

function getShiftLocation(item: OpenShiftDTO): string {
    return item.shiftLocation?.trim() || item.projectLocation?.trim() || "No location yet";
}

function spotsCell(item: OpenShiftDTO): { label: string; className: string } {
    const spots = item.spotsRemaining ?? 0;
    if (spots <= 0) return { label: "Full", className: "cellSub cellWarn" };
    return { label: spots === 1 ? "1 left" : `${spots} left`, className: "cellSub cellOk" };
}

export default function OpenShifts() {
    const navigate = useNavigate();
    const [items, setItems] = useState<OpenShiftDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    return (
        <>
            <Navbar />
            <div className="pageShell">
                <PrimaryNav />
                <div className="pageShellContent">
                    <header className="pageHeader">
                        <h1 className="pageTitle">Open shifts</h1>
                    </header>
                    <Card
                        title="Shifts you can apply for"
                        className="openShiftsCard"
                        right={
                            <div className="openShiftsToolbar">
                                <div className="openShiftsCount">
                                    {filteredItems.length}
                                    {items.length !== filteredItems.length ? ` of ${items.length}` : ""} open shift
                                    {items.length === 1 ? "" : "s"}
                                </div>
                                <FilterToggleButton controller={filter} />
                            </div>
                        }
                    >
                        <FilterPanelBody
                            controller={filter}
                            resultMeta={`${filteredItems.length}${
                                items.length !== filteredItems.length ? ` of ${items.length}` : ""
                            } open shift${items.length === 1 ? "" : "s"}`}
                        />
                        <div className="listContainer">
                            <div className="listHeaderGrid gridOpenShifts">
                                <div>Project</div>
                                <div>Date &amp; time</div>
                                <div>Function</div>
                                <div>Location</div>
                                <div>Spots</div>
                                <div>Status</div>
                            </div>
                            <div className="listScrollArea openShiftsScroll">
                                {loading ? <div className="listEmpty">Loading open shifts...</div> : null}
                                {error ? <div className="listEmpty errorText">{error}</div> : null}
                                {!loading && !error && filteredItems.length === 0 ? (
                                    <div className="listEmpty">
                                        {items.length === 0
                                            ? "There are no open shifts right now. Check back later."
                                            : "No open shifts match your filters."}
                                    </div>
                                ) : null}

                                {!loading && !error
                                    ? filteredItems.map((item) => {
                                          const spots = spotsCell(item);
                                          const applied = Boolean(item.applied);
                                          return (
                                              <div
                                                  key={item.shiftId}
                                                  className="listRowGrid gridOpenShifts clickableRow"
                                                  onClick={() => navigate(`/open-shifts/${item.shiftId}`)}
                                              >
                                                  <div className="openShiftsProjectCell">
                                                      <div className="cellMain">{item.projectName}</div>
                                                      {item.shiftName?.trim() ? (
                                                          <div className="openShiftsProjectSub">{item.shiftName}</div>
                                                      ) : null}
                                                  </div>
                                                  <div className="cellSub" data-label="Date & time">
                                                      {formatDate(item.shiftDate)} - {timeLabel(item.startTime, item.endTime)}
                                                  </div>
                                                  <div className="cellSub" data-label="Function">{item.functionName}</div>
                                                  <div className="cellSub" data-label="Location">{getShiftLocation(item)}</div>
                                                  <div className={spots.className} data-label="Spots">{spots.label}</div>
                                                  <div
                                                      className={applied ? "cellSub cellInfo" : "cellSub openShiftsStatusMuted"}
                                                      data-label="Status"
                                                  >
                                                      {applied ? `Applied ${formatTimeAgo(item.appliedAt)}` : "Open"}
                                                  </div>
                                              </div>
                                          );
                                      })
                                    : null}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </>
    );
}
