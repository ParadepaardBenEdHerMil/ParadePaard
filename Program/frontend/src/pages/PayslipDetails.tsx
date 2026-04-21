import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Spinner from "../components/Spinner";
import Card from "../components/common/Card";
import { UserServices, type PayslipResponseDTO } from "../services/user-service/UserServices";
import { formatDate, formatDateTime } from "../utils/dateFormat";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/GeneralInfo.css";
import "../stylesheets/PayslipDetails.css";
import "../stylesheets/UserDashboard.css";
import "../stylesheets/WorkHistory.css";

const money = (n: number | null | undefined) =>
    new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(n ?? 0));

const statusLabel = (value?: string | null) => {
    const normalized = (value ?? "").toUpperCase();
    if (normalized === "RELEASED") return "Released";
    if (normalized === "PENDING_REVIEW") return "Pending review";
    if (normalized === "PENDING_APPROVAL") return "Pending approval";
    if (normalized === "NEEDS_ATTENTION") return "Needs attention";
    if (normalized === "DISPUTED") return "Disputed";
    if (normalized === "APPROVED") return "Approved";
    return value ?? "-";
};

const statusTone = (value?: string | null) => (value ?? "UNKNOWN").toLowerCase().replace(/_/g, "-");

export default function PayslipDetails() {
    const { payslipId } = useParams<{ payslipId: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const personalView = searchParams.get("view") === "personal";

    const [payslip, setPayslip] = useState<PayslipResponseDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);

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
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load payslip.";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [payslipId]);

    useEffect(() => {
        void loadPayslip();
    }, [loadPayslip]);

    const totals = useMemo(() => {
        if (!payslip) return { gross: 0, net: 0 };
        const gross = Number(payslip.totalGrossAmount ?? 0);
        const deductions = Number(payslip.totalEmployeeDeductions ?? payslip.wageTaxWithheldAmount ?? payslip.wageTaxWithheldTest ?? 0);
        const travel = Number(payslip.travelExpenses ?? 0);
        const net = Number(payslip.totalNetAmount ?? (gross - deductions + travel));
        return { gross, deductions, net };
    }, [payslip]);

    const addressLine = useMemo(() => {
        if (!payslip) return "-";
        const line1 = [payslip.streetName, payslip.houseNumber, payslip.houseNumberSuffix]
            .filter(Boolean)
            .join(" ");
        const line2 = [payslip.postalCode, payslip.city].filter(Boolean).join(" ");
        return [line1, line2].filter(Boolean).join(", ") || "-";
    }, [payslip]);

    const downloadPayslipPdf = useCallback(async () => {
        if (!payslip) return;
        try {
            setDownloading(true);
            setDownloadError(null);
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
            setDownloadError(message);
        } finally {
            setDownloading(false);
        }
    }, [payslip]);

    const weekLabel = useMemo(() => {
        if (!payslip) return "-";
        return `${payslip.weekBasedYear ?? "-"} / Week ${payslip.weekNumber ?? "-"}`;
    }, [payslip]);

    const pageHeader = (
        <header className="pageHeader">
            <h1 className="pageTitle">Payslip Overview</h1>
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
                                    onClick={() => navigate(personalView ? "/payslips?view=personal" : "/payslips")}
                                >
                                    Back to payslips
                                </button>
                                <button
                                    className="button"
                                    onClick={() => void downloadPayslipPdf()}
                                    disabled={downloading}
                                >
                                    {downloading ? "Downloading..." : "Download PDF"}
                                </button>
                            </div>

                            {downloadError ? <div className="workHistoryError">{downloadError}</div> : null}

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
                                            <div className="payslipHeroEyebrow">Payslip summary</div>
                                            <h2 className="payslipHeroTitle">{payslip.name ?? "Employee payslip"}</h2>
                                            <p className="payslipHeroSubtitle">
                                                {payslip.functionName ?? "No function assigned"} for {weekLabel}. Issued on{" "}
                                                {formatDate(payslip.dateOfIssue)} and available to the employee on{" "}
                                                {formatDate(payslip.availableToUserAt)}.
                                            </p>
                                            <div className="payslipHeroMeta">
                                                <span
                                                    className={`payslipStatusBadge payslipStatusBadge--${statusTone(
                                                        payslip.status
                                                    )}`}
                                                >
                                                    {statusLabel(payslip.status)}
                                                </span>
                                                <span className="payslipStatusBadge">Payslip ID {payslip.payslipId}</span>
                                            </div>
                                        </div>
                                        <div className="payslipHeroMetrics">
                                            <div className="payslipHeroMetric">
                                                <span className="payslipHeroMetricLabel">Hours worked</span>
                                                <span className="payslipHeroMetricValue">
                                                    {Number(payslip.totalHoursWorked ?? 0).toFixed(2)} h
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

                                    <main className="payslipDetailGrid">
                                        <Card title="Overview" className="payslipDetailSection">
                                            <div className="payslipDetailFields">
                                                <div className="payslipDetailField">
                                                    <p className="payslipDetailFieldLabel">Date of issue</p>
                                                    <p className="payslipDetailFieldValue">{formatDate(payslip.dateOfIssue)}</p>
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
                                                <div className="payslipDetailField">
                                                    <p className="payslipDetailFieldLabel">Status</p>
                                                    <p className="payslipDetailFieldValue">{statusLabel(payslip.status)}</p>
                                                </div>
                                                <div className="payslipDetailField">
                                                    <p className="payslipDetailFieldLabel">Payslip ID</p>
                                                    <p className="payslipDetailFieldValue payslipDetailFieldValue--subtle">
                                                        {payslip.payslipId}
                                                    </p>
                                                </div>
                                            </div>
                                        </Card>

                                        <Card title="Pay details" className="payslipDetailSection">
                                            <div className="payslipDetailFields">
                                                <div className="payslipDetailField">
                                                    <p className="payslipDetailFieldLabel">Function</p>
                                                    <p className="payslipDetailFieldValue">{payslip.functionName ?? "-"}</p>
                                                </div>
                                                <div className="payslipDetailField">
                                                    <p className="payslipDetailFieldLabel">Hourly wage</p>
                                                    <p className="payslipDetailFieldValue payslipDetailFieldValue--numeric">
                                                        {money(payslip.hourlyWage)}
                                                    </p>
                                                </div>
                                                <div className="payslipDetailField">
                                                    <p className="payslipDetailFieldLabel">Hours worked</p>
                                                    <p className="payslipDetailFieldValue payslipDetailFieldValue--numeric">
                                                        {Number(payslip.totalHoursWorked ?? 0).toFixed(2)} h
                                                    </p>
                                                </div>
                                                <div className="payslipDetailField">
                                                    <p className="payslipDetailFieldLabel">Loonheffing</p>
                                                    <p className="payslipDetailFieldValue payslipDetailFieldValue--numeric">
                                                        {money(payslip.wageTaxWithheldAmount ?? payslip.wageTaxWithheldTest)}
                                                    </p>
                                                </div>
                                                <div className="payslipDetailField">
                                                    <p className="payslipDetailFieldLabel">Total deductions</p>
                                                    <p className="payslipDetailFieldValue payslipDetailFieldValue--numeric">
                                                        {money(payslip.totalEmployeeDeductions)}
                                                    </p>
                                                </div>
                                                <div className="payslipDetailField">
                                                    <p className="payslipDetailFieldLabel">Travel expenses</p>
                                                    <p className="payslipDetailFieldValue payslipDetailFieldValue--numeric">
                                                        {money(payslip.travelExpenses)}
                                                    </p>
                                                </div>
                                                <div className="payslipDetailField payslipDetailField--accent">
                                                    <p className="payslipDetailFieldLabel">Gross total</p>
                                                    <p className="payslipDetailFieldValue payslipDetailFieldValue--numeric">
                                                        {money(totals.gross)}
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

                                        <Card title="Deductions" className="payslipDetailSection">
                                            <div className="payslipDeductionList">
                                                {(payslip.deductionLines ?? []).length === 0 ? (
                                                    <div className="payslipDetailFieldValue payslipDetailFieldValue--subtle">
                                                        No deduction lines recorded for this payslip.
                                                    </div>
                                                ) : (
                                                    (payslip.deductionLines ?? []).map((line) => (
                                                        <div key={line.id} className="payslipDeductionSummaryRow">
                                                            <div>
                                                                <div className="payslipDetailFieldLabel">
                                                                    {line.label || line.code}
                                                                </div>
                                                                <div className="payslipDetailFieldValue payslipDetailFieldValue--subtle">
                                                                    {line.category || "OTHER"}
                                                                </div>
                                                            </div>
                                                            <div className="payslipDetailFieldValue payslipDetailFieldValue--numeric">
                                                                {money(line.calculatedAmount)}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </Card>

                                        <Card
                                            title="Employee details"
                                            className="payslipDetailSection payslipDetailSection--wide"
                                        >
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
                                                    <p className="payslipDetailFieldValue">
                                                        {formatDate(payslip.dateOfBirth)}
                                                    </p>
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
