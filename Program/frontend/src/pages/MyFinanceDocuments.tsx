import { useEffect, useMemo, useState } from "react";
import { UserServices } from "../services/user-service/UserServices";
import type { PayslipResponseDTO } from "../services/user-service/GetMyPayslips";

export default function MyFinanceDocuments() {
    const [payslips, setPayslips] = useState<PayslipResponseDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloadYear, setDownloadYear] = useState<number | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        UserServices.getMyPayslips()
            .then((data) => {
                if (active) setPayslips(data);
            })
            .catch((err: unknown) => {
                if (active) setError(err instanceof Error ? err.message : "Failed to load your documents");
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

    const currentYear = new Date().getFullYear();

    const download = async (year: number) => {
        try {
            setDownloadError(null);
            setDownloadYear(year);
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
            setDownloadYear(null);
        }
    };

    if (loading) return <div className="myFinanceNotice">Loading documents...</div>;
    if (error) return <div className="myFinanceError">{error}</div>;
    if (years.length === 0) return <div className="myFinanceNotice">No annual statements available yet.</div>;

    return (
        <div className="myFinanceDocuments">
            <h2 className="myFinanceSectionTitle">Documents</h2>
            <p className="myFinanceMuted">
                Your jaaropgaaf (annual statement) for each year. While a year is still running, or before your
                employer has finalised it, the statement is provisional and its figures may still change.
            </p>
            {downloadError ? <div className="myFinanceError">{downloadError}</div> : null}
            <table className="myFinanceTable">
                <thead>
                    <tr>
                        <th>Document</th>
                        <th>Year</th>
                        <th>Status</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {years.map((year) => {
                        const provisional = year >= currentYear;
                        return (
                            <tr key={year}>
                                <td>Jaaropgaaf {year}</td>
                                <td>{year}</td>
                                <td>
                                    <span className={`myFinanceBadge${provisional ? " myFinanceBadge--provisional" : ""}`}>
                                        {provisional ? "Provisional" : "Provisional (not yet finalised)"}
                                    </span>
                                </td>
                                <td>
                                    <button
                                        type="button"
                                        className="myFinanceButton myFinanceButton--small"
                                        disabled={downloadYear === year}
                                        onClick={() => void download(year)}
                                    >
                                        {downloadYear === year ? "Preparing..." : "Download PDF"}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
