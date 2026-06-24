import { useEffect, useState } from "react";
import { UserServices } from "../services/user-service/UserServices";
import type { ContractResponseDTO } from "../services/user-service/GetContracts";

const eur = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });

function formatDate(value?: string | null): string {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" });
}

function yesNo(value?: boolean | null): string {
    if (value === null || value === undefined) return "-";
    return value ? "Yes" : "No";
}

function pct(value?: number | null): string {
    return value === null || value === undefined ? "-" : `${value}%`;
}

export default function MyFinanceContract() {
    const [contract, setContract] = useState<ContractResponseDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        UserServices.getCurrentContract()
            .then((data) => {
                if (active) setContract(data);
            })
            .catch((err: unknown) => {
                if (active) setError(err instanceof Error ? err.message : "Failed to load your contract");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);

    const downloadPdf = async () => {
        if (!contract) return;
        try {
            setDownloadError(null);
            setDownloading(true);
            const blob = await UserServices.getContractPdf(contract.contractId);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `contract_${contract.contractId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err: unknown) {
            setDownloadError(err instanceof Error ? err.message : "Failed to download contract");
        } finally {
            setDownloading(false);
        }
    };

    if (loading) return <div className="myFinanceNotice">Loading contract...</div>;
    if (error) return <div className="myFinanceError">{error}</div>;
    if (!contract) return <div className="myFinanceNotice">You don't have an active contract yet.</div>;

    const rows: Array<[string, string]> = [
        ["Function", contract.functionName ?? "-"],
        ["Contract type", contract.contractType ?? "-"],
        ["Status", contract.status ?? "-"],
        ["Start date", formatDate(contract.startDate)],
        ["End date", contract.endDate ? formatDate(contract.endDate) : "Indefinite"],
        ["Gross hourly wage", contract.grossHourlyWage != null ? eur.format(Number(contract.grossHourlyWage)) : "-"],
        ["Weekly hours", contract.weeklyHours != null ? String(contract.weeklyHours) : "-"],
        ["Payment frequency", contract.paymentFrequency ?? "-"],
        ["Holiday allowance", pct(contract.holidayAllowancePercentage)],
        ["Travel allowance", yesNo(contract.travelAllowance)],
        ["Pension scheme", contract.pensionScheme ?? "-"],
        ["Pension applicable", yesNo(contract.pensionApplicable)],
        ["Employee pension premium", pct(contract.pensionEmployeePercentage)],
        ["Loonheffingskorting applied", yesNo(contract.applyLoonheffingskorting)],
        ["CAO", contract.collectiveAgreement ?? "-"],
    ];

    return (
        <div className="myFinanceContract">
            <div className="myFinanceOverviewHead">
                <h2 className="myFinanceSectionTitle">Contract</h2>
                <button type="button" className="myFinanceButton" onClick={() => void downloadPdf()} disabled={downloading}>
                    {downloading ? "Preparing..." : "Download contract PDF"}
                </button>
            </div>
            {downloadError ? <div className="myFinanceError">{downloadError}</div> : null}
            <dl className="myFinanceDefList">
                {rows.map(([label, value]) => (
                    <div className="myFinanceDefRow" key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
