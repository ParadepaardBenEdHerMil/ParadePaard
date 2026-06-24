import { useEffect, useState } from "react";
import { UserServices } from "../services/user-service/UserServices";
import type { MyTimesheetRow } from "../services/user-service/GetMyTimesheets";

const eur = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const money = (value: number | null | undefined) => eur.format(Number(value ?? 0));

function formatDate(value?: string | null): string {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" });
}

export default function MyFinanceWorkHistory() {
    const [rows, setRows] = useState<MyTimesheetRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        UserServices.getMyTimesheetsPage(0, 100)
            .then((page) => {
                if (active) setRows(page.items ?? []);
            })
            .catch((err: unknown) => {
                if (active) setError(err instanceof Error ? err.message : "Failed to load your work history");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);

    if (loading) return <div className="myFinanceNotice">Loading work history...</div>;
    if (error) return <div className="myFinanceError">{error}</div>;
    if (rows.length === 0) return <div className="myFinanceNotice">No worked shifts recorded yet.</div>;

    const totalHours = rows.reduce((acc, r) => acc + Number(r.hoursWorked ?? 0), 0);

    return (
        <div className="myFinanceWorkHistory">
            <div className="myFinanceOverviewHead">
                <h2 className="myFinanceSectionTitle">Work history</h2>
                <span className="myFinanceMuted">{totalHours.toFixed(2)} hours across {rows.length} shifts</span>
            </div>
            <table className="myFinanceTable">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Project</th>
                        <th>Function</th>
                        <th className="num">Hours</th>
                        <th className="num">Travel</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => (
                        <tr key={r.timesheetId}>
                            <td>{formatDate(r.shiftDate ?? r.dateOfIssue)}</td>
                            <td>{r.projectName ?? "-"}</td>
                            <td>{r.function ?? "-"}</td>
                            <td className="num">{Number(r.hoursWorked ?? 0).toFixed(2)}</td>
                            <td className="num">{money(r.travelExpenses)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
