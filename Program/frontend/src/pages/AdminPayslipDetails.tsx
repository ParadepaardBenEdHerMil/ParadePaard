import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Spinner from "../components/Spinner";
import Card from "../components/common/Card";
import {
    type PayrollDeductionLineDTO,
    UserServices,
    type PayslipResponseDTO,
    type TimesheetRow,
    type UpdatePayslipRequestDTO,
} from "../services/user-service/UserServices";
import { formatDate, formatDateTime } from "../utils/dateFormat";
import { formatDateInput, normalizeDateInput, parseDisplayDate } from "../utils/dateInput";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/GeneralInfo.css";
import "../stylesheets/PayslipDetails.css";
import "../stylesheets/UserDashboard.css";
import "../stylesheets/WorkHistory.css";

const MAX_ERROR_TITLE_LENGTH = 80;

const STATUS_OPTIONS = ["PENDING_REVIEW", "NEEDS_ATTENTION", "DISPUTED", "RELEASED"] as const;

type PayslipFormState = {
    dateOfIssue: string;
    functionName: string;
    hourlyWage: string;
    totalHoursWorked: string;
    travelExpenses: string;
    status: string;
    errorTitle: string;
    errorNote: string;
    deductionLines: PayrollDeductionLineDTO[];
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

const createEmptyDeductionLine = (): PayrollDeductionLineDTO => ({
    id: crypto.randomUUID(),
    code: "",
    label: "",
    category: "OTHER",
    calculationType: "FIXED_AMOUNT",
    configuredValue: null,
    calculatedAmount: null,
    manualAmountOverride: null,
    source: "MANUAL",
    notes: "",
    sortOrder: 10,
});

const calculateDeductionAmount = (line: PayrollDeductionLineDTO, gross: number) => {
    if (line.manualAmountOverride != null) return Number(line.manualAmountOverride ?? 0);
    if (line.calculationType === "PERCENT_OF_GROSS") {
        return (gross * Number(line.configuredValue ?? 0)) / 100;
    }
    return Number(line.configuredValue ?? 0);
};

const statusTone = (value?: string | null) => (value ?? "UNKNOWN").toLowerCase().replace(/_/g, "-");

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
        travelExpenses: "",
        status: "PENDING_REVIEW",
        errorTitle: "",
        errorNote: "",
        deductionLines: [],
    });

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

    const applyPayslipToForm = useCallback((data: PayslipResponseDTO) => {
        const parsed = parseErrorDescription(data.errorDescription);
        setForm({
            dateOfIssue: formatDateInput(data.dateOfIssue),
            functionName: data.functionName ?? "",
            hourlyWage: data.hourlyWage != null ? String(data.hourlyWage) : "",
            totalHoursWorked: data.totalHoursWorked != null ? String(data.totalHoursWorked) : "",
            travelExpenses: data.travelExpenses != null ? String(data.travelExpenses) : "",
            status: data.status ?? "PENDING_REVIEW",
            errorTitle: parsed.title,
            errorNote: parsed.note,
            deductionLines: (data.deductionLines ?? []).map((line) => ({ ...line })),
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
        const travel = parseNumber(form.travelExpenses) ?? 0;
        const gross = hours * rate;
        const totalDeductions = form.deductionLines.reduce((sum, line) => {
            return sum + calculateDeductionAmount(line, gross);
        }, 0);
        const wageTax = form.deductionLines.reduce((sum, line) => {
            if ((line.code ?? "").trim().toUpperCase() !== "LOONHEFFING") return sum;
            return sum + calculateDeductionAmount(line, gross);
        }, 0);
        const net = gross - totalDeductions + travel;
        return {
            gross,
            totalDeductions,
            wageTax,
            net,
        };
    }, [form.deductionLines, form.hourlyWage, form.totalHoursWorked, form.travelExpenses]);

    const addressLine = useMemo(() => {
        if (!payslip) return "-";
        const line1 = [payslip.streetName, payslip.houseNumber, payslip.houseNumberSuffix]
            .filter(Boolean)
            .join(" ");
        const line2 = [payslip.postalCode, payslip.city].filter(Boolean).join(" ");
        return [line1, line2].filter(Boolean).join(", ") || "-";
    }, [payslip]);

    const weekLabel = useMemo(() => {
        if (!payslip) return "-";
        return `${payslip.weekBasedYear ?? "-"} / Week ${payslip.weekNumber ?? "-"}`;
    }, [payslip]);

    const timesheetTravelTotal = useMemo(() => {
        return filteredTimesheets.reduce((sum, t) => sum + (t.travelExpenses ?? 0), 0);
    }, [filteredTimesheets]);

    const handleSave = async () => {
        if (!payslip || !payslipId) return;
        const parsedDateOfIssue = parseDisplayDate(form.dateOfIssue);

        if (!parsedDateOfIssue) {
            setSaveError("Please enter a valid date of issue in dd/mm/yyyy format.");
            return;
        }
        if (!form.functionName.trim()) {
            setSaveError("Please enter a function name.");
            return;
        }

        const hourlyWage = parseNumber(form.hourlyWage);
        const hoursWorked = parseNumber(form.totalHoursWorked);
        const travel = parseNumber(form.travelExpenses) ?? 0;

        if (hourlyWage === null || hourlyWage < 0) {
            setSaveError("Please enter a valid hourly wage.");
            return;
        }
        if (hoursWorked === null || hoursWorked < 0) {
            setSaveError("Please enter valid hours worked.");
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
            dateOfIssue: parsedDateOfIssue,
            functionName: form.functionName.trim(),
            hourlyWage,
            totalHoursWorked: hoursWorked,
            wageTaxWithheldAmount: totals.wageTax,
            travelExpenses: travel,
            status: form.status,
            errorDescription: combinedError,
            deductionLines: form.deductionLines.map((line, index) => ({
                ...line,
                code: (line.code ?? "").trim().toUpperCase(),
                label: (line.label ?? "").trim(),
                category: (line.category ?? "").trim().toUpperCase(),
                calculationType: (line.calculationType ?? "FIXED_AMOUNT").trim().toUpperCase(),
                configuredValue: line.configuredValue == null ? null : Number(line.configuredValue),
                manualAmountOverride: line.manualAmountOverride == null ? null : Number(line.manualAmountOverride),
                sortOrder: line.sortOrder ?? ((index + 1) * 10),
                notes: (line.notes ?? "").trim(),
            })),
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
                        <div className="payslipDetailLayout">
                            <section className="payslipHero">
                                <div className="payslipHeroIntro">
                                    <div className="payslipHeroEyebrow">Admin payroll editor</div>
                                    <h2 className="payslipHeroTitle">{payslip.name ?? "Employee payslip"}</h2>
                                    <p className="payslipHeroSubtitle">
                                        Review and update payroll information for {weekLabel}. Generated on{" "}
                                        {formatDateTime(payslip.generatedAt)} and scheduled for employee access on{" "}
                                        {formatDate(payslip.availableToUserAt)}.
                                    </p>
                                    <div className="payslipHeroMeta">
                                        <span
                                            className={`payslipStatusBadge payslipStatusBadge--${statusTone(
                                                form.status
                                            )}`}
                                        >
                                            {statusLabel(form.status)}
                                        </span>
                                        <span className="payslipStatusBadge">Payslip ID {payslip.payslipId}</span>
                                    </div>
                                </div>
                                <div className="payslipHeroMetrics">
                                    <div className="payslipHeroMetric">
                                        <span className="payslipHeroMetricLabel">Hours worked</span>
                                        <span className="payslipHeroMetricValue">
                                            {(parseNumber(form.totalHoursWorked) ?? 0).toFixed(2)} h
                                        </span>
                                    </div>
                                    <div className="payslipHeroMetric">
                                        <span className="payslipHeroMetricLabel">Gross pay</span>
                                        <span className="payslipHeroMetricValue">{money(totals.gross)}</span>
                                    </div>
                                    <div className="payslipHeroMetric">
                                        <span className="payslipHeroMetricLabel">Net pay</span>
                                        <span className="payslipHeroMetricValue">{money(totals.net)}</span>
                                    </div>
                                </div>
                            </section>

                            {(saveError || saveSuccess) ? (
                                <div className="payslipDetailNotices">
                                    {saveError ? <div className="workHistoryError">{saveError}</div> : null}
                                    {saveSuccess ? <div className="helperText">{saveSuccess}</div> : null}
                                </div>
                            ) : null}

                            <main className="payslipDetailGrid">
                                <Card title="Overview" className="payslipDetailSection">
                                    <div className="payslipDetailFields">
                                        <div className="payslipDetailField">
                                            <p className="payslipDetailFieldLabel">Payslip ID</p>
                                            <p className="payslipDetailFieldValue payslipDetailFieldValue--subtle">
                                                {payslip.payslipId}
                                            </p>
                                        </div>
                                        <div className="payslipDetailField">
                                            <label className="payslipDetailFieldLabel" htmlFor="payslip-date">
                                                Date of issue
                                            </label>
                                            <input
                                                id="payslip-date"
                                                className="uiSelect"
                                                type="text"
                                                value={form.dateOfIssue}
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        dateOfIssue: normalizeDateInput(e.target.value),
                                                    }))
                                                }
                                                inputMode="numeric"
                                                placeholder="dd/mm/yyyy"
                                                maxLength={10}
                                                disabled={saving}
                                            />
                                        </div>
                                        <div className="payslipDetailField">
                                            <p className="payslipDetailFieldLabel">Week</p>
                                            <p className="payslipDetailFieldValue">{weekLabel}</p>
                                        </div>
                                        <div className="payslipDetailField">
                                            <p className="payslipDetailFieldLabel">Available to user</p>
                                            <p className="payslipDetailFieldValue">
                                                {formatDate(payslip.availableToUserAt)}
                                            </p>
                                        </div>
                                        <div className="payslipDetailField">
                                            <p className="payslipDetailFieldLabel">Generated at</p>
                                            <p className="payslipDetailFieldValue payslipDetailFieldValue--subtle">
                                                {formatDateTime(payslip.generatedAt)}
                                            </p>
                                        </div>
                                    </div>
                                </Card>

                                <Card title="Error handling" className="payslipDetailSection">
                                    <div className="payslipDetailFields">
                                        <div className="payslipDetailField">
                                            <label className="payslipDetailFieldLabel" htmlFor="payslip-status">
                                                Status
                                            </label>
                                            <select
                                                id="payslip-status"
                                                className="uiSelect"
                                                value={form.status}
                                                onChange={(e) =>
                                                    setForm((prev) => ({ ...prev, status: e.target.value }))
                                                }
                                                disabled={saving}
                                            >
                                                {STATUS_OPTIONS.map((option) => (
                                                    <option key={option} value={option}>
                                                        {statusLabel(option)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="payslipDetailField">
                                            <label
                                                className="payslipDetailFieldLabel"
                                                htmlFor="payslip-error-title"
                                            >
                                                Error title
                                            </label>
                                            <input
                                                id="payslip-error-title"
                                                className="uiSelect"
                                                type="text"
                                                maxLength={MAX_ERROR_TITLE_LENGTH}
                                                value={form.errorTitle}
                                                onChange={(e) =>
                                                    setForm((prev) => ({ ...prev, errorTitle: e.target.value }))
                                                }
                                                disabled={saving}
                                            />
                                        </div>
                                        <div className="payslipDetailField">
                                            <label className="payslipDetailFieldLabel" htmlFor="payslip-error-note">
                                                Error note
                                            </label>
                                            <textarea
                                                id="payslip-error-note"
                                                className="uiSelect"
                                                rows={3}
                                                value={form.errorNote}
                                                onChange={(e) =>
                                                    setForm((prev) => ({ ...prev, errorNote: e.target.value }))
                                                }
                                                disabled={saving}
                                            />
                                        </div>
                                    </div>
                                </Card>

                                <Card title="Pay details" className="payslipDetailSection">
                                    <div className="payslipDetailFields">
                                        <div className="payslipDetailField">
                                            <label className="payslipDetailFieldLabel" htmlFor="payslip-function">
                                                Function
                                            </label>
                                            <input
                                                id="payslip-function"
                                                className="uiSelect"
                                                type="text"
                                                value={form.functionName}
                                                onChange={(e) =>
                                                    setForm((prev) => ({ ...prev, functionName: e.target.value }))
                                                }
                                                disabled={saving}
                                            />
                                        </div>
                                        <div className="payslipDetailField">
                                            <label className="payslipDetailFieldLabel" htmlFor="payslip-rate">
                                                Hourly wage
                                            </label>
                                            <input
                                                id="payslip-rate"
                                                className="uiSelect"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={form.hourlyWage}
                                                onChange={(e) =>
                                                    setForm((prev) => ({ ...prev, hourlyWage: e.target.value }))
                                                }
                                                disabled={saving}
                                            />
                                        </div>
                                        <div className="payslipDetailField">
                                            <label className="payslipDetailFieldLabel" htmlFor="payslip-hours">
                                                Hours worked
                                            </label>
                                            <input
                                                id="payslip-hours"
                                                className="uiSelect"
                                                type="number"
                                                min="0"
                                                step="0.25"
                                                value={form.totalHoursWorked}
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        totalHoursWorked: e.target.value,
                                                    }))
                                                }
                                                disabled={saving}
                                            />
                                        </div>
                                        <div className="payslipDetailField">
                                            <label className="payslipDetailFieldLabel" htmlFor="payslip-travel">
                                                Travel expenses
                                            </label>
                                            <input
                                                id="payslip-travel"
                                                className="uiSelect"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={form.travelExpenses}
                                                onChange={(e) =>
                                                    setForm((prev) => ({ ...prev, travelExpenses: e.target.value }))
                                                }
                                                disabled={saving}
                                            />
                                        </div>
                                        <div className="payslipDetailField payslipDetailField--accent">
                                            <p className="payslipDetailFieldLabel">Gross total</p>
                                            <p className="payslipDetailFieldValue payslipDetailFieldValue--numeric">
                                                {money(totals.gross)}
                                            </p>
                                        </div>
                                        <div className="payslipDetailField payslipDetailField--accent">
                                            <p className="payslipDetailFieldLabel">Loonheffing total</p>
                                            <p className="payslipDetailFieldValue payslipDetailFieldValue--numeric">
                                                {money(totals.wageTax)}
                                            </p>
                                        </div>
                                        <div className="payslipDetailField payslipDetailField--accent">
                                            <p className="payslipDetailFieldLabel">Total deductions</p>
                                            <p className="payslipDetailFieldValue payslipDetailFieldValue--numeric">
                                                {money(totals.totalDeductions)}
                                            </p>
                                        </div>
                                        <div className="payslipDetailField payslipDetailField--accent">
                                            <p className="payslipDetailFieldLabel">Net total</p>
                                            <p className="payslipDetailFieldValue payslipDetailFieldValue--numeric">
                                                {money(totals.net)}
                                            </p>
                                        </div>
                                    </div>
                                </Card>

                                <Card title="Deductions" className="payslipDetailSection payslipDetailSection--wide">
                                    <div className="payslipDeductionList">
                                        {form.deductionLines.map((line, index) => (
                                            <div key={line.id || index} className="payslipDeductionRow">
                                                <div className="payslipDeductionGrid">
                                                    <input
                                                        className="uiSelect"
                                                        type="text"
                                                        placeholder="Code"
                                                        value={line.code ?? ""}
                                                        onChange={(event) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                deductionLines: prev.deductionLines.map((current, currentIndex) =>
                                                                    currentIndex === index
                                                                        ? { ...current, code: event.target.value }
                                                                        : current
                                                                ),
                                                            }))
                                                        }
                                                        disabled={saving}
                                                    />
                                                    <input
                                                        className="uiSelect"
                                                        type="text"
                                                        placeholder="Label"
                                                        value={line.label ?? ""}
                                                        onChange={(event) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                deductionLines: prev.deductionLines.map((current, currentIndex) =>
                                                                    currentIndex === index
                                                                        ? { ...current, label: event.target.value }
                                                                        : current
                                                                ),
                                                            }))
                                                        }
                                                        disabled={saving}
                                                    />
                                                    <input
                                                        className="uiSelect"
                                                        type="text"
                                                        placeholder="Category"
                                                        value={line.category ?? ""}
                                                        onChange={(event) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                deductionLines: prev.deductionLines.map((current, currentIndex) =>
                                                                    currentIndex === index
                                                                        ? { ...current, category: event.target.value }
                                                                        : current
                                                                ),
                                                            }))
                                                        }
                                                        disabled={saving}
                                                    />
                                                    <select
                                                        className="uiSelect"
                                                        value={line.calculationType ?? "FIXED_AMOUNT"}
                                                        onChange={(event) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                deductionLines: prev.deductionLines.map((current, currentIndex) =>
                                                                    currentIndex === index
                                                                        ? { ...current, calculationType: event.target.value }
                                                                        : current
                                                                ),
                                                            }))
                                                        }
                                                        disabled={saving}
                                                    >
                                                        <option value="FIXED_AMOUNT">Fixed amount</option>
                                                        <option value="PERCENT_OF_GROSS">Percent of gross</option>
                                                    </select>
                                                    <input
                                                        className="uiSelect"
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        placeholder="Configured value"
                                                        value={line.configuredValue ?? ""}
                                                        onChange={(event) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                deductionLines: prev.deductionLines.map((current, currentIndex) =>
                                                                    currentIndex === index
                                                                        ? {
                                                                            ...current,
                                                                            configuredValue: event.target.value === ""
                                                                                ? null
                                                                                : Number(event.target.value),
                                                                        }
                                                                        : current
                                                                ),
                                                            }))
                                                        }
                                                        disabled={saving}
                                                    />
                                                    <input
                                                        className="uiSelect"
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        placeholder="Manual override"
                                                        value={line.manualAmountOverride ?? ""}
                                                        onChange={(event) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                deductionLines: prev.deductionLines.map((current, currentIndex) =>
                                                                    currentIndex === index
                                                                        ? {
                                                                            ...current,
                                                                            manualAmountOverride: event.target.value === ""
                                                                                ? null
                                                                                : Number(event.target.value),
                                                                        }
                                                                        : current
                                                                ),
                                                            }))
                                                        }
                                                        disabled={saving}
                                                    />
                                                    <input
                                                        className="uiSelect"
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        placeholder="Sort order"
                                                        value={line.sortOrder ?? ""}
                                                        onChange={(event) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                deductionLines: prev.deductionLines.map((current, currentIndex) =>
                                                                    currentIndex === index
                                                                        ? {
                                                                            ...current,
                                                                            sortOrder: event.target.value === ""
                                                                                ? null
                                                                                : Number(event.target.value),
                                                                        }
                                                                        : current
                                                                ),
                                                            }))
                                                        }
                                                        disabled={saving}
                                                    />
                                                    <input
                                                        className="uiSelect"
                                                        type="text"
                                                        placeholder="Notes"
                                                        value={line.notes ?? ""}
                                                        onChange={(event) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                deductionLines: prev.deductionLines.map((current, currentIndex) =>
                                                                    currentIndex === index
                                                                        ? { ...current, notes: event.target.value }
                                                                        : current
                                                                ),
                                                            }))
                                                        }
                                                        disabled={saving}
                                                    />
                                                </div>
                                                <div className="payslipDeductionFooter">
                                                    <span className="payslipDetailFieldValue payslipDetailFieldValue--subtle">
                                                        Calculated amount {money(calculateDeductionAmount(line, totals.gross))}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="settingsUserRemove"
                                                        onClick={() =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                deductionLines: prev.deductionLines.filter((_, currentIndex) => currentIndex !== index),
                                                            }))
                                                        }
                                                        disabled={saving}
                                                    >
                                                        Remove line
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="cardFooter">
                                        <button
                                            className="button buttonSecondary"
                                            type="button"
                                            onClick={() =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    deductionLines: [...prev.deductionLines, createEmptyDeductionLine()],
                                                }))
                                            }
                                            disabled={saving}
                                        >
                                            Add deduction line
                                        </button>
                                    </div>
                                </Card>

                                <Card title="Employee details" className="payslipDetailSection">
                                    <div className="payslipDetailFields">
                                        <div className="payslipDetailField">
                                            <p className="payslipDetailFieldLabel">Full name</p>
                                            <p className="payslipDetailFieldValue">{payslip.name ?? "-"}</p>
                                        </div>
                                        <div className="payslipDetailField">
                                            <p className="payslipDetailFieldLabel">User ID</p>
                                            <p className="payslipDetailFieldValue payslipDetailFieldValue--subtle">
                                                {payslip.userId}
                                            </p>
                                        </div>
                                        <div className="payslipDetailField">
                                            <p className="payslipDetailFieldLabel">Date of birth</p>
                                            <p className="payslipDetailFieldValue">{formatDate(payslip.dateOfBirth)}</p>
                                        </div>
                                        <div className="payslipDetailField">
                                            <p className="payslipDetailFieldLabel">Start date</p>
                                            <p className="payslipDetailFieldValue">{formatDate(payslip.startDate)}</p>
                                        </div>
                                        <div className="payslipDetailField">
                                            <p className="payslipDetailFieldLabel">Address</p>
                                            <p className="payslipDetailFieldValue payslipDetailFieldValue--subtle">
                                                {addressLine}
                                            </p>
                                        </div>
                                        <div className="payslipDetailField">
                                            <p className="payslipDetailFieldLabel">Country</p>
                                            <p className="payslipDetailFieldValue">{payslip.country ?? "-"}</p>
                                        </div>
                                    </div>
                                </Card>

                                <Card
                                    title={`Timesheets (${weekLabel})`}
                                    className="payslipDetailSection payslipDetailSection--wide workHistoryCard"
                                >
                                    {timesheetLoading ? (
                                        <div className="workHistoryLoading">
                                            <Spinner text="Loading timesheets" />
                                        </div>
                                    ) : timesheetError ? (
                                        <div className="workHistoryError">{timesheetError}</div>
                                    ) : (
                                        <>
                                            <div className="payslipTimesheetSummary">
                                                <div className="payslipTimesheetSummaryItem">
                                                    <span className="payslipTimesheetSummaryLabel">
                                                        Recorded hours
                                                    </span>
                                                    <span className="payslipTimesheetSummaryValue">
                                                        {totalTimesheetHours.toFixed(1)}
                                                    </span>
                                                </div>
                                                <div className="payslipTimesheetSummaryItem">
                                                    <span className="payslipTimesheetSummaryLabel">
                                                        Travel total
                                                    </span>
                                                    <span className="payslipTimesheetSummaryValue">
                                                        {money(timesheetTravelTotal)}
                                                    </span>
                                                </div>
                                            </div>
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
                                                                {money(timesheetTravelTotal)}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </>
                                    )}
                                </Card>
                            </main>
                        </div>
                    ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
