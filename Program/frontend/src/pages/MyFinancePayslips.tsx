import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserServices } from "../services/user-service/UserServices";
import type { PayslipResponseDTO } from "../services/user-service/GetMyPayslips";

const eur = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const money = (value: number | null | undefined) => eur.format(Number(value ?? 0));

function formatDate(value?: string | null): string {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" });
}

export default function MyFinancePayslips() {
    const navigate = useNavigate();
    const [payslips, setPayslips] = useState<PayslipResponseDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloadId, setDownloadId] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        UserServices.getMyPayslips()
            .then((data) => {
                if (active) setPayslips(data);
            })
            .catch((err: unknown) => {
                if (active) setError(err instanceof Error ? err.message : "Failed to load your payslips");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);

    const sorted = useMemo(
        () => [...payslips].sort((a, b) => (b.dateOfIssue ?? "").localeCompare(a.dateOfIssue ?? "")),
        [payslips]
    );

    const downloadPdf = async (payslip: PayslipResponseDTO) => {
        try {
            setDownloadError(null);
            setDownloadId(payslip.payslipId);
            const blob = await UserServices.getPayslipPdf(payslip.payslipId);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `payslip_${payslip.dateOfIssue || payslip.payslipId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err: unknown) {
            setDownloadError(err instanceof Error ? err.message : "Failed to download payslip");
        } finally {
            setDownloadId(null);
        }
    };

    if (loading) return <div className="myFinanceNotice">Loading payslips...</div>;
    if (error) return <div className="myFinanceError">{error}</div>;
    if (sorted.length === 0) return <div className="myFinanceNotice">You don't have any payslips yet.</div>;

    return (
        <div className="myFinancePayslips">
            <h2 className="myFinanceSectionTitle">Payslips</h2>
            {downloadError ? <div className="myFinanceError">{downloadError}</div> : null}
            <table className="myFinanceTable">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Week</th>
                        <th className="num">Gross</th>
                        <th className="num">Deductions</th>
                        <th className="num">Net</th>
                        <th>Status</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((p) => (
                        <tr
                            key={p.payslipId}
                            className="myFinanceRowClickable"
                            onClick={() => navigate(`/payslips/${p.payslipId}`)}
                        >
                            <td>{formatDate(p.dateOfIssue)}</td>
                            <td>{p.weekBasedYear ? `${p.weekBasedYear} W${p.weekNumber ?? "-"}` : "-"}</td>
                            <td className="num">{money(p.totalGrossAmount)}</td>
                            <td className="num">{money(p.totalEmployeeDeductions ?? p.wageTaxWithheldAmount)}</td>
                            <td className="num">{money(p.totalNetAmount)}</td>
                            <td>{p.status ?? "-"}</td>
                            <td>
                                <button
                                    type="button"
                                    className="myFinanceButton myFinanceButton--small"
                                    disabled={downloadId === p.payslipId}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void downloadPdf(p);
                                    }}
                                >
                                    {downloadId === p.payslipId ? "..." : "PDF"}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
