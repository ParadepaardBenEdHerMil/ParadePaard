import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import PageBack from "../components/PageBack";
import Card from "../components/common/Card";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { UserServices, type EmployeePlanningAssignmentDTO, type TimesheetRow } from "../services/user-service/UserServices";
import { formatDate, formatDateTime } from "../utils/dateFormat";
import "../stylesheets/GeneralInfo.css";
import "../stylesheets/MyPlanningShiftDetail.css";

function money(value: number | null | undefined): string {
    return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(value ?? 0));
}

function formatHourValue(value: number | null | undefined): string {
    return Number(value ?? 0).toFixed(1);
}

function formatDateValue(value?: string | null): string {
    if (!value) return "-";
    return formatDate(value);
}

function formatTimeRange(start?: string | null, end?: string | null): string {
    const startValue = start?.slice(11, 16);
    const endValue = end?.slice(11, 16);
    if (startValue && endValue) return `${startValue} - ${endValue}`;
    return "-";
}

function claimStatusLabel(value?: string | null): string {
    if (!value) return "Not submitted";
    return value
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function claimStatusTone(value?: string | null): string {
    return (value ?? "not-submitted").toLowerCase().replaceAll("_", "-");
}

export default function WorkHistoryShiftDetail() {
    const { timesheetId } = useParams<{ timesheetId: string }>();
    const location = useLocation();
    const { permissions, permissionsLoading } = useAuth();
    const [timesheet, setTimesheet] = useState<TimesheetRow | null>(null);
    const [assignment, setAssignment] = useState<EmployeePlanningAssignmentDTO | null>(null);
    const [employeeName, setEmployeeName] = useState<string>("-");
    const [useAdminEndpoints, setUseAdminEndpoints] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [proofError, setProofError] = useState<string | null>(null);

    useEffect(() => {
        if (!timesheetId) {
            setLoading(false);
            setError("Missing worked shift id.");
            return;
        }
        if (permissionsLoading) return;

        let cancelled = false;

        const load = async () => {
            try {
                setLoading(true);
                setError(null);
                const timesheetData = await UserServices.getTimesheetById(timesheetId);

                if (cancelled) return;
                setTimesheet(timesheetData);

                if (timesheetData.userId) {
                    try {
                        const names = await UserServices.getUserDisplayNames([timesheetData.userId]);
                        if (!cancelled) {
                            setEmployeeName(names[timesheetData.userId] ?? timesheetData.name ?? timesheetData.userId);
                        }
                    } catch {
                        if (!cancelled) {
                            setEmployeeName(timesheetData.name ?? timesheetData.userId ?? "-");
                        }
                    }
                } else {
                    setEmployeeName(timesheetData.name ?? "-");
                }

                if (!timesheetData.sourceScheduleEntryId) {
                    setAssignment(null);
                    return;
                }

                const canViewAdminAssignment =
                    permissions.includes("CAN_VIEW_ALL_TIMESHEETS") ||
                    permissions.includes("CAN_MANAGE_TIMESHEETS");
                if (!cancelled) {
                    setUseAdminEndpoints(canViewAdminAssignment);
                }

                const assignmentData = canViewAdminAssignment
                    ? await UserServices.getPlanningAssignmentAdmin(timesheetData.sourceScheduleEntryId)
                    : await UserServices.getMyPlanningAssignment(timesheetData.sourceScheduleEntryId);

                if (!cancelled) {
                    setAssignment(assignmentData);
                    if (assignmentData.userDisplayName?.trim()) {
                        setEmployeeName(assignmentData.userDisplayName.trim());
                    }
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load worked shift");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [permissions, permissionsLoading, timesheetId]);

    const backTarget = useMemo(() => {
        return location.pathname.startsWith("/management/work-history") ? "/management/work-history" : "/work-history";
    }, [location.pathname]);

    const openProof = async () => {
        if (!timesheet?.sourceScheduleEntryId) return;
        try {
            setProofError(null);
            const blob = await UserServices.getTravelClaimProof(timesheet.sourceScheduleEntryId, useAdminEndpoints);
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener,noreferrer");
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (err: unknown) {
            setProofError(err instanceof Error ? err.message : "Failed to open travel proof");
        }
    };

    const rate =
        assignment?.travelClaim?.ratePerKilometer != null || timesheet?.travelRate != null
            ? money(assignment?.travelClaim?.ratePerKilometer ?? timesheet?.travelRate)
            : "-";
    const kilometers = assignment?.travelClaim?.kilometers ?? timesheet?.travelKilometers ?? "-";
    const claimStatus = assignment?.travelClaim?.status;

    return (
        <>
            <Navbar />
            <div className="pageShell">
                <PrimaryNav />
                <div className="pageShellContent">
                    <header className="pageHeader">
                        <PageBack to={backTarget} />
                        <h1 className="pageTitle">Worked Shift</h1>
                    </header>
                    {loading ? (
                        <Spinner text="Loading worked shift" />
                    ) : error && !timesheet ? (
                        <p className="errorText">{error}</p>
                    ) : timesheet ? (
                        <div className="shiftDetailStack">
                            <Card title="Shift overview" className="shiftDetailCard">
                                <div className="generalInfoRows">
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Employee</div>
                                        <div className="generalInfoValue">{employeeName}</div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Date</div>
                                        <div className="generalInfoValue">
                                            {formatDateValue(assignment?.shiftDate ?? timesheet.shiftDate ?? timesheet.dateOfIssue)}
                                        </div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Time</div>
                                        <div className="generalInfoValue">
                                            {formatTimeRange(assignment?.startTime ?? timesheet.shiftStartTime, assignment?.endTime ?? timesheet.shiftEndTime)}
                                        </div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Shift</div>
                                        <div className="generalInfoValue">
                                            {assignment?.shiftName ?? timesheet.shiftName ?? timesheet.function}
                                        </div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Project</div>
                                        <div className="generalInfoValue">
                                            {assignment?.projectName ?? timesheet.projectName ?? "-"}
                                        </div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Function</div>
                                        <div className="generalInfoValue">
                                            {assignment?.functionName ?? timesheet.function}
                                        </div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Hours worked</div>
                                        <div className="generalInfoValue">{formatHourValue(timesheet.hoursWorked)} h</div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Break</div>
                                        <div className="generalInfoValue">
                                            {assignment?.breakMinutes ?? timesheet.breakMinutes ?? 0} min
                                        </div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Timesheet</div>
                                        <div className="generalInfoValue">
                                            {assignment?.timesheetExported ?? true ? "Logged" : "Not logged"}
                                        </div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Logged at</div>
                                        <div className="generalInfoValue">
                                            {formatDateTime(assignment?.timesheetExportedAt ?? null)}
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <Card title="Travel expenses" className="shiftDetailCard">
                                {proofError ? <p className="errorText">{proofError}</p> : null}
                                <div className="generalInfoRows">
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Timesheet travel amount</div>
                                        <div className="generalInfoValue">{money(timesheet.travelExpenses ?? 0)}</div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Submission status</div>
                                        <div className="generalInfoValue">
                                            <span className={`travelClaimStatus travelClaimStatus--${claimStatusTone(claimStatus)}`}>
                                                {claimStatusLabel(claimStatus)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Kilometers</div>
                                        <div className="generalInfoValue">{kilometers}</div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Rate</div>
                                        <div className="generalInfoValue">{rate}</div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Claim amount</div>
                                        <div className="generalInfoValue">
                                            {money(assignment?.travelClaim?.totalAmount ?? timesheet.travelExpenses ?? 0)}
                                        </div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Submitted at</div>
                                        <div className="generalInfoValue">
                                            {formatDateTime(assignment?.travelClaim?.submittedAt ?? null)}
                                        </div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Reviewed at</div>
                                        <div className="generalInfoValue">
                                            {formatDateTime(assignment?.travelClaim?.reviewedAt ?? null)}
                                        </div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Review note</div>
                                        <div className="generalInfoValue">
                                            {assignment?.travelClaim?.rejectionNote ?? "-"}
                                        </div>
                                    </div>
                                </div>
                                {assignment?.travelClaim?.hasProof && timesheet.sourceScheduleEntryId ? (
                                    <div className="travelClaimActions">
                                        <button type="button" className="button" onClick={() => void openProof()}>
                                            View proof
                                        </button>
                                    </div>
                                ) : null}
                            </Card>
                        </div>
                    ) : null}
                </div>
            </div>
        </>
    );
}
