import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Spinner from "../components/Spinner";
import Card from "../components/common/Card";
import {
    UserServices,
    type PayslipResponseDTO,
    type TimesheetRow,
    type UpdatePayslipRequestDTO,
} from "../services/user-service/UserServices";
import { formatDate, formatDateTime } from "../utils/dateFormat";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/GeneralInfo.css";
import "../stylesheets/UserDashboard.css";
import "../stylesheets/WorkHistory.css";

const MAX_ERROR_TITLE_LENGTH = 80;

const STATUS_OPTIONS = ["PENDING_REVIEW", "NEEDS_ATTENTION", "DISPUTED", "RELEASED"] as const;

type PayslipFormState = {
    dateOfIssue: string;
    functionName: string;
    hourlyWage: string;
    totalHoursWorked: string;
    wageTaxWithheldTest: string;
    travelExpenses: string;
    status: string;
    errorTitle: string;
    errorNote: string;
};

const money = (n: number | null | undefined) =>
    new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(n ?? 0));

const parseNumber = (value: string) => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const parseErrorDescription = (value?: string | null) => {
    if (!value) return { title: "", note: "" };
    const parts = value.split(/\r?\n/);
    const title = (parts.shift() ?? "").trim();
    const note = parts.join("\n").trim();
    return { title, note };
};

export default function AdminPayslipDetails() {
    const { payslipId } = useParams<{ payslipId: string }>();
    const navigate = useNavigate();

    const [payslip, setPayslip] = useState<PayslipResponseDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [timesheets, setTimesheets] = useState<TimesheetRow[]>([]);
    const [timesheetLoading, setTimesheetLoading] = useState(true);
    const [timesheetError, setTimesheetError] = useState<string | null>(null);

    const [form, setForm] = useState<PayslipFormState>({
        dateOfIssue: "",
        functionName: "",
        hourlyWage: "",
        totalHoursWorked: "",
        wageTaxWithheldTest: "",
        travelExpenses: "",
        status: "PENDING_REVIEW",
        errorTitle: "",
        errorNote: "",
    });

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

    const applyPayslipToForm = useCallback((data: PayslipResponseDTO) => {
        const parsed = parseErrorDescription(data.errorDescription);
        setForm({
            dateOfIssue: data.dateOfIssue ?? "",
            functionName: data.functionName ?? "",
            hourlyWage: data.hourlyWage != null ? String(data.hourlyWage) : "",
            totalHoursWorked: data.totalHoursWorked != null ? String(data.totalHoursWorked) : "",
            wageTaxWithheldTest: data.wageTaxWithheldTest != null ? String(data.wageTaxWithheldTest) : "",
            travelExpenses: data.travelExpenses != null ? String(data.travelExpenses) : "",
            status: data.status ?? "PENDING_REVIEW",
            errorTitle: parsed.title,
            errorNote: parsed.note,
        });
    }, []);

    const loadPayslip = useCallback(async () => {
        if (!payslipId) {
            setError("Missing payslip id.");
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getPayslipById(payslipId);
            setPayslip(data);
            applyPayslipToForm(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load payslip.";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [applyPayslipToForm, payslipId]);

    const loadTimesheets = useCallback(async () => {
        try {
            setTimesheetLoading(true);
            setTimesheetError(null);
            const data = await UserServices.getTimesheets();
            setTimesheets(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load timesheets.";
            setTimesheetError(message);
        } finally {
            setTimesheetLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadPayslip();
    }, [loadPayslip]);

    useEffect(() => {
        void loadTimesheets();
    }, [loadTimesheets]);

    const filteredTimesheets = useMemo(() => {
        if (!payslip) return [];
        return timesheets
            .filter(
                (t) =>
                    t.userId === payslip.userId &&
                    t.weekNumber === payslip.weekNumber &&
                    t.weekBasedYear === payslip.weekBasedYear
            )
            .sort((a, b) => (b.dateOfIssue ?? "").localeCompare(a.dateOfIssue ?? ""));
    }, [payslip, timesheets]);

    const totalTimesheetHours = useMemo(() => {
        return filteredTimesheets.reduce((sum, t) => sum + (t.hoursWorked ?? 0), 0);
    }, [filteredTimesheets]);

    const totals = useMemo(() => {
        const hours = parseNumber(form.totalHoursWorked) ?? 0;
        const rate = parseNumber(form.hourlyWage) ?? 0;
        const tax = parseNumber(form.wageTaxWithheldTest) ?? 0;
        const travel = parseNumber(form.travelExpenses) ?? 0;
        const gross = hours * rate;
        const net = gross - tax + travel;
        return {
            gross,
            net,
        };
    }, [form.hourlyWage, form.totalHoursWorked, form.travelExpenses, form.wageTaxWithheldTest]);

    const addressLine = useMemo(() => {
        if (!payslip) return "-";
        const line1 = [payslip.streetName, payslip.houseNumber, payslip.houseNumberSuffix]
            .filter(Boolean)
            .join(" ");
        const line2 = [payslip.postalCode, payslip.city].filter(Boolean).join(" ");
        return [line1, line2].filter(Boolean).join(", ") || "-";
    }, [payslip]);

    const handleSave = async () => {
        if (!payslip || !payslipId) return;

        if (!form.dateOfIssue) {
            setSaveError("Please choose a date of issue.");
            return;
        }
        if (!form.functionName.trim()) {
            setSaveError("Please enter a function name.");
            return;
        }

        const hourlyWage = parseNumber(form.hourlyWage);
        const hoursWorked = parseNumber(form.totalHoursWorked);
        const wageTax = parseNumber(form.wageTaxWithheldTest) ?? 0;
        const travel = parseNumber(form.travelExpenses) ?? 0;

        if (hourlyWage === null || hourlyWage < 0) {
            setSaveError("Please enter a valid hourly wage.");
            return;
        }
        if (hoursWorked === null || hoursWorked < 0) {
            setSaveError("Please enter valid hours worked.");
            return;
        }
        if (wageTax < 0) {
            setSaveError("Please enter a valid tax amount.");
            return;
        }
        if (travel < 0) {
            setSaveError("Please enter a valid travel expense.");
            return;
        }

        const title = form.errorTitle.trim();
        const note = form.errorNote.trim();
        const combinedError = title ? (note ? `${title}
${note}` : title) : "";

        const payload: UpdatePayslipRequestDTO = {
            userId: payslip.userId,
            dateOfIssue: form.dateOfIssue,
            functionName: form.functionName.trim(),
            hourlyWage,
            totalHoursWorked: hoursWorked,
            wageTaxWithheldTest: wageTax,
            travelExpenses: travel,
            status: form.status,
            errorDescription: combinedError,
        };

        try {
            setSaving(true);
            setSaveError(null);
            setSaveSuccess(null);
            const updated = await UserServices.updatePayslip(payslipId, payload);
            setPayslip(updated);
            applyPayslipToForm(updated);
            setSaveSuccess("Payslip updated.");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to update payslip.";
            setSaveError(message);
        } finally {
            setSaving(false);
        }
    };

    const statusLabel = (value?: string | null) => {
        const normalized = (value ?? "").toUpperCase();
        if (normalized === "RELEASED") return "Released";
        if (normalized === "PENDING_REVIEW") return "Pending review";
        if (normalized === "NEEDS_ATTENTION") return "Needs attention";
        if (normalized === "DISPUTED") return "Disputed";
        return value ?? "-";
    };

    const downloadPayslipPdf = useCallback(async () => {
        if (!payslip) return;
        try {
            const blob = await UserServices.getPayslipPdf(payslip.payslipId);
            const url = URL.createObjectURL(blob);
            try {
                const a = document.createElement("a");
                a.href = url;
                a.download = `payslip_${payslip.weekBasedYear}_W${payslip.weekNumber}.pdf`;
                a.rel = "noopener";
                document.body.appendChild(a);
                a.click();
                a.remove();
            } finally {
                URL.revokeObjectURL(url);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to download payslip.";
            setSaveError(message);
        }
    }, [payslip]);

    const pageHeader = (
        <header className="pageHeader">
            <h1 className="pageTitle">Payslip Details</h1>
        </header>
    );

    if (!payslipId) {
        return (
            <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        {pageHeader}
                        <div className="adminDashboardCard">
                            <div className="workHistoryError">Missing payslip id.</div>
                        </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        {pageHeader}
                        <div className="adminDashboardCard">
                            <div className="pageActions">
                                <button
                                    className="button buttonSecondary"
                                    onClick={() => void downloadPayslipPdf()}
                                    disabled={saving}
                                >
                                    Download PDF
                                </button>
                                <button
                                    className="button buttonSecondary"
                                    onClick={() => {
                                        if (payslip) navigate(`/admin/user/${payslip.userId}`);
                                    }}
                                    disabled={saving}
                                >
                                    View user
                                </button>
                                <button
                                    className="button"
                                    onClick={() => void handleSave()}
                                    disabled={saving}
                                >
                                    {saving ? "Saving..." : "Save changes"}
                                </button>
                            </div>

                    {loading ? (
                        <div className="workHistoryLoading">
                            <Spinner text="Loading payslip" />
                        </div>
                    ) : error ? (
                        <div className="workHistoryError">{error}</div>
                    ) : payslip ? (
                        <main className="adminDashboardGrid">
                            <Card
                                title="Payslip Overview"
                                className="dashboardCardHeight"
                            >
                                <div className="generalInfoRows">
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Payslip ID</div>
                                        <div className="generalInfoValue">{payslip.payslipId}</div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <label className="generalInfoLabel" htmlFor="payslip-date">
                                            Date of issue
                                        </label>
                                        <input
                                            id="payslip-date"
                                            className="uiSelect"
                                            type="date"
                                            value={form.dateOfIssue}
                                            onChange={(e) => setForm((prev) => ({ ...prev, dateOfIssue: e.target.value }))}
                                            disabled={saving}
                                        />
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Week</div>
                                        <div className="generalInfoValue">
                                            {payslip.weekNumber ?? "-"} ({payslip.weekBasedYear ?? "-"})
                                        </div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Available to user</div>
                                        <div className="generalInfoValue">{formatDate(payslip.availableToUserAt)}</div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Generated at</div>
                                        <div className="generalInfoValue">{formatDateTime(payslip.generatedAt)}</div>
                                    </div>
                                </div>

                                {saveError ? <p className="errorText">{saveError}</p> : null}
                                {saveSuccess ? <p className="helperText">{saveSuccess}</p> : null}
                            </Card>

                            <Card title="Error Handling" className="dashboardCardHeight">
                                <div className="generalInfoRows">
                                    <div className="generalInfoRow">
                                        <label className="generalInfoLabel" htmlFor="payslip-status">
                                            Status
                                        </label>
                                        <select
                                            id="payslip-status"
                                            className="uiSelect"
                                            value={form.status}
                                            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                                            disabled={saving}
                                        >
                                            {STATUS_OPTIONS.map((option) => (
                                                <option key={option} value={option}>
                                                    {statusLabel(option)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="generalInfoRow">
                                        <label className="generalInfoLabel" htmlFor="payslip-error-title">
                                            Error title
                                        </label>
                                        <input
                                            id="payslip-error-title"
                                            className="uiSelect"
                                            type="text"
                                            maxLength={MAX_ERROR_TITLE_LENGTH}
                                            value={form.errorTitle}
                                            onChange={(e) => setForm((prev) => ({ ...prev, errorTitle: e.target.value }))}
                                            disabled={saving}
                                        />
                                    </div>
                                    <div className="generalInfoRow">
                                        <label className="generalInfoLabel" htmlFor="payslip-error-note">
                                            Error note
                                        </label>
                                        <textarea
                                            id="payslip-error-note"
                                            className="uiSelect"
                                            rows={3}
                                            value={form.errorNote}
                                            onChange={(e) => setForm((prev) => ({ ...prev, errorNote: e.target.value }))}
                                            disabled={saving}
                                        />
                                    </div>
                                </div>
                            </Card>

                            <Card title="Pay Details" className="dashboardCardHeight">
                                <div className="generalInfoRows">
                                    <div className="generalInfoRow">
                                        <label className="generalInfoLabel" htmlFor="payslip-function">
                                            Function
                                        </label>
                                        <input
                                            id="payslip-function"
                                            className="uiSelect"
                                            type="text"
                                            value={form.functionName}
                                            onChange={(e) => setForm((prev) => ({ ...prev, functionName: e.target.value }))}
                                            disabled={saving}
                                        />
                                    </div>
                                    <div className="generalInfoRow">
                                        <label className="generalInfoLabel" htmlFor="payslip-rate">
                                            Hourly wage
                                        </label>
                                        <input
                                            id="payslip-rate"
                                            className="uiSelect"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={form.hourlyWage}
                                            onChange={(e) => setForm((prev) => ({ ...prev, hourlyWage: e.target.value }))}
                                            disabled={saving}
                                        />
                                    </div>
                                    <div className="generalInfoRow">
                                        <label className="generalInfoLabel" htmlFor="payslip-hours">
                                            Hours worked
                                        </label>
                                        <input
                                            id="payslip-hours"
                                            className="uiSelect"
                                            type="number"
                                            min="0"
                                            step="0.25"
                                            value={form.totalHoursWorked}
                                            onChange={(e) => setForm((prev) => ({ ...prev, totalHoursWorked: e.target.value }))}
                                            disabled={saving}
                                        />
                                    </div>
                                    <div className="generalInfoRow">
                                        <label className="generalInfoLabel" htmlFor="payslip-tax">
                                            Wage tax withheld
                                        </label>
                                        <input
                                            id="payslip-tax"
                                            className="uiSelect"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={form.wageTaxWithheldTest}
                                            onChange={(e) => setForm((prev) => ({ ...prev, wageTaxWithheldTest: e.target.value }))}
                                            disabled={saving}
                                        />
                                    </div>
                                    <div className="generalInfoRow">
                                        <label className="generalInfoLabel" htmlFor="payslip-travel">
                                            Travel expenses
                                        </label>
                                        <input
                                            id="payslip-travel"
                                            className="uiSelect"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={form.travelExpenses}
                                            onChange={(e) => setForm((prev) => ({ ...prev, travelExpenses: e.target.value }))}
                                            disabled={saving}
                                        />
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Gross total</div>
                                        <div className="generalInfoValue">{money(totals.gross)}</div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Net total</div>
                                        <div className="generalInfoValue">{money(totals.net)}</div>
                                    </div>
                                </div>

                            </Card>

                            <Card
                                title="Employee Details"
                                className="dashboardCardHeight"
                            >
                                <div className="generalInfoRows">
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Full name</div>
                                        <div className="generalInfoValue">{payslip.name ?? "-"}</div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">User ID</div>
                                        <div className="generalInfoValue">{payslip.userId}</div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Date of birth</div>
                                        <div className="generalInfoValue">{formatDate(payslip.dateOfBirth)}</div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Start date</div>
                                        <div className="generalInfoValue">{formatDate(payslip.startDate)}</div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Address</div>
                                        <div className="generalInfoValue">{addressLine}</div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Country</div>
                                        <div className="generalInfoValue">{payslip.country ?? "-"}</div>
                                    </div>
                                </div>
                            </Card>

                            <Card
                                title={`Timesheets (Week ${payslip.weekNumber ?? "-"})`}
                                className="workHistoryCard"
                            >
                                {timesheetLoading ? (
                                    <div className="workHistoryLoading">
                                        <Spinner text="Loading timesheets" />
                                    </div>
                                ) : timesheetError ? (
                                    <div className="workHistoryError">{timesheetError}</div>
                                ) : (
                                    <div className="workHistoryTableWrap">
                                        <table className="workHistoryTable">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Function</th>
                                                    <th className="workHistoryHoursCol">Hours</th>
                                                    <th className="workHistoryHoursCol">Travel</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredTimesheets.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} className="workHistoryEmpty">
                                                            No timesheets found for this payslip.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredTimesheets.map((t) => (
                                                        <tr key={t.timesheetId}>
                                                            <td>{formatDate(t.dateOfIssue)}</td>
                                                            <td>{t.function}</td>
                                                            <td className="workHistoryHoursCol">
                                                                {Number(t.hoursWorked ?? 0).toFixed(1)}
                                                            </td>
                                                            <td className="workHistoryHoursCol">
                                                                {money(t.travelExpenses ?? 0)}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                            <tfoot>
                                                <tr className="workHistoryTotalRow">
                                                    <td colSpan={2}>Total</td>
                                                    <td className="workHistoryHoursCol">
                                                        {totalTimesheetHours.toFixed(1)}
                                                    </td>
                                                    <td className="workHistoryHoursCol">
                                                        {money(
                                                            filteredTimesheets.reduce(
                                                                (sum, t) => sum + (t.travelExpenses ?? 0),
                                                                0
                                                            )
                                                        )}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}
                            </Card>
                        </main>
                    ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
