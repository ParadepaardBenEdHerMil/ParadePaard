import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

export default function MyFinanceOverview() {
    const [payslips, setPayslips] = useState<PayslipResponseDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [year, setYear] = useState<number | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        UserServices.getMyPayslips()
            .then((data) => {
                if (!active) return;
                setPayslips(data);
                const years = data
                    .map((p) => p.weekBasedYear)
                    .filter((y): y is number => typeof y === "number" && y > 0);
                setYear(years.length ? Math.max(...years) : new Date().getFullYear());
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

    const years = useMemo(() => {
        const set = new Set<number>();
        payslips.forEach((p) => {
            if (typeof p.weekBasedYear === "number" && p.weekBasedYear > 0) set.add(p.weekBasedYear);
        });
        return Array.from(set).sort((a, b) => b - a);
    }, [payslips]);

    const yearPayslips = useMemo(
        () => payslips.filter((p) => p.weekBasedYear === year),
        [payslips, year]
    );

    const totals = useMemo(() => {
        const sum = (pick: (p: PayslipResponseDTO) => number | null | undefined) =>
            yearPayslips.reduce((acc, p) => acc + Number(pick(p) ?? 0), 0);
        return {
            gross: sum((p) => p.totalGrossAmount),
            net: sum((p) => p.totalNetAmount),
            tax: sum((p) => p.wageTaxWithheldAmount ?? p.wageTaxWithheldTest),
            count: yearPayslips.length,
        };
    }, [yearPayslips]);

    const lastPayslip = useMemo(() => {
        return [...payslips].sort((a, b) => (b.dateOfIssue ?? "").localeCompare(a.dateOfIssue ?? ""))[0] ?? null;
    }, [payslips]);

    const recent = useMemo(
        () => [...yearPayslips].sort((a, b) => (b.dateOfIssue ?? "").localeCompare(a.dateOfIssue ?? "")).slice(0, 5),
        [yearPayslips]
    );

    const downloadJaaropgaaf = async () => {
        if (!year) return;
        try {
            setDownloadError(null);
            setDownloading(true);
            const blob = await UserServices.getMyJaaropgaafPdf(year);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `jaaropgaaf_${year}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err: unknown) {
            setDownloadError(err instanceof Error ? err.message : "Failed to download jaaropgaaf");
        } finally {
            setDownloading(false);
        }
    };

    if (loading) return <div className="myFinanceNotice">Loading your finance overview...</div>;
    // Degrade gracefully: if the summary can't be loaded (e.g. no payslip access),
    // show a neutral state rather than an error, so the page never looks broken.
    if (error) return <div className="myFinanceNotice">No financial summary is available for you yet.</div>;

    const isCurrentYear = year === new Date().getFullYear();

    return (
        <div className="myFinanceOverview">
            <div className="myFinanceOverviewHead">
                <h2 className="myFinanceSectionTitle">Overview</h2>
                {years.length > 0 ? (
                    <label className="myFinanceYearSwitch">
                        Year
                        <select value={year ?? ""} onChange={(e) => setYear(Number(e.target.value))}>
                            {years.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    </label>
                ) : null}
            </div>

            {payslips.length === 0 ? (
                <div className="myFinanceNotice">You don't have any payslips yet.</div>
            ) : (
                <>
                    <div className="myFinanceCards">
                        <div className="myFinanceStat">
                            <span className="myFinanceStatLabel">Last net pay</span>
                            <span className="myFinanceStatValue">{money(lastPayslip?.totalNetAmount)}</span>
                            <span className="myFinanceStatMeta">{formatDate(lastPayslip?.dateOfIssue)}</span>
                        </div>
                        <div className="myFinanceStat">
                            <span className="myFinanceStatLabel">Net paid in {year}</span>
                            <span className="myFinanceStatValue">{money(totals.net)}</span>
                            <span className="myFinanceStatMeta">{totals.count} payslips</span>
                        </div>
                        <div className="myFinanceStat">
                            <span className="myFinanceStatLabel">Gross in {year}</span>
                            <span className="myFinanceStatValue">{money(totals.gross)}</span>
                        </div>
                        <div className="myFinanceStat">
                            <span className="myFinanceStatLabel">Wage tax withheld in {year}</span>
                            <span className="myFinanceStatValue">{money(totals.tax)}</span>
                        </div>
                    </div>

                    <div className="myFinanceJaaropgaafBanner">
                        <div>
                            <strong>Jaaropgaaf {year}</strong>
                            <p className="myFinanceMuted">
                                {isCurrentYear
                                    ? "Provisional - the year isn't complete yet, so the figures may still change."
                                    : "Annual statement for your income-tax return."}
                            </p>
                            {downloadError ? <p className="myFinanceError">{downloadError}</p> : null}
                        </div>
                        <button type="button" className="myFinanceButton" onClick={() => void downloadJaaropgaaf()} disabled={downloading}>
                            {downloading ? "Preparing..." : "Download PDF"}
                        </button>
                    </div>

                    <div className="myFinanceRecent">
                        <div className="myFinanceRecentHead">
                            <h3 className="myFinanceSubTitle">Recent payslips</h3>
                            <Link to="/my-finance/payslips" className="myFinanceLink">
                                View all
                            </Link>
                        </div>
                        <table className="myFinanceTable">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Week</th>
                                    <th className="num">Gross</th>
                                    <th className="num">Deductions</th>
                                    <th className="num">Net</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recent.map((p) => (
                                    <tr key={p.payslipId}>
                                        <td>{formatDate(p.dateOfIssue)}</td>
                                        <td>{p.weekBasedYear ? `${p.weekBasedYear} W${p.weekNumber ?? "-"}` : "-"}</td>
                                        <td className="num">{money(p.totalGrossAmount)}</td>
                                        <td className="num">{money(p.totalEmployeeDeductions ?? p.wageTaxWithheldAmount)}</td>
                                        <td className="num">{money(p.totalNetAmount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
