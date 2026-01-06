import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Spinner from "../components/Spinner";
import Card from "../components/common/Card";
import { UserServices, type PayslipResponseDTO } from "../services/user-service/UserServices";
import { formatDate, formatDateTime } from "../utils/dateFormat";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/GeneralInfo.css";
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

export default function PayslipDetails() {
    const { payslipId } = useParams<{ payslipId: string }>();
    const navigate = useNavigate();

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
        const hours = Number(payslip.totalHoursWorked ?? 0);
        const rate = Number(payslip.hourlyWage ?? 0);
        const tax = Number(payslip.wageTaxWithheldTest ?? 0);
        const travel = Number(payslip.travelExpenses ?? 0);
        const gross = hours * rate;
        const net = gross - tax + travel;
        return { gross, net };
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

    if (!payslipId) {
        return (
            <>
                <Navbar />
                <div className="adminDashboardPage">
                    <div className="adminDashboardCard">
                        <div className="workHistoryError">Missing payslip id.</div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="adminDashboardCard">
                    <header className="pageHeader">
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 16,
                                flexWrap: "wrap",
                            }}
                        >
                            <div>
                                <h1 className="pageTitle">Payslip Overview</h1>
                                <p className="pageSubtitle">Details for this payslip</p>
                            </div>
                            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                                <button
                                    className="button buttonSecondary"
                                    onClick={() => navigate("/payslips")}
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
                        </div>
                    </header>

                    {downloadError ? <div className="workHistoryError">{downloadError}</div> : null}

                    {loading ? (
                        <div className="workHistoryLoading">
                            <Spinner text="Loading payslip" />
                        </div>
                    ) : error ? (
                        <div className="workHistoryError">{error}</div>
                    ) : payslip ? (
                        <main className="adminDashboardGrid">
                            <Card title="Payslip overview" className="dashboardCardHeight">
                                <div className="generalInfoRows">
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Payslip ID</div>
                                        <div className="generalInfoValue">{payslip.payslipId}</div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Date of issue</div>
                                        <div className="generalInfoValue">{formatDate(payslip.dateOfIssue)}</div>
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
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Status</div>
                                        <div className="generalInfoValue">{statusLabel(payslip.status)}</div>
                                    </div>
                                </div>
                            </Card>

                            <Card title="Pay details" className="dashboardCardHeight">
                                <div className="generalInfoRows">
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Function</div>
                                        <div className="generalInfoValue">{payslip.functionName ?? "-"}</div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Hourly wage</div>
                                        <div className="generalInfoValue">{money(payslip.hourlyWage)}</div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Hours worked</div>
                                        <div className="generalInfoValue">
                                            {Number(payslip.totalHoursWorked ?? 0).toFixed(2)} h
                                        </div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Wage tax withheld</div>
                                        <div className="generalInfoValue">{money(payslip.wageTaxWithheldTest)}</div>
                                    </div>
                                    <div className="generalInfoRow">
                                        <div className="generalInfoLabel">Travel expenses</div>
                                        <div className="generalInfoValue">{money(payslip.travelExpenses)}</div>
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

                            <Card title="Employee details" className="dashboardCardHeight">
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
                        </main>
                    ) : null}
                </div>
            </div>
        </>
    );
}
