import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import {
    getFinanceBreakdown,
    getFinanceOverview,
    type FinanceBreakdownRow,
    type FinanceDimension,
    type FinanceOverview,
} from "../services/user-service/PayrollFinanceApi";
import "../stylesheets/AdminDashboard.css";
import "../stylesheets/PayrollFinance.css";

const currencyFormatter = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const money = (value: number | null | undefined) => currencyFormatter.format(Number(value ?? 0));
const hours = (value: number | null | undefined) => Number(value ?? 0).toFixed(2);

const DIMENSIONS: { key: FinanceDimension; label: string }[] = [
    { key: "EMPLOYEE", label: "By employee" },
    { key: "FUNCTION", label: "By function" },
    { key: "MONTH", label: "By month" },
];

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

function yearStartIso(): string {
    return `${new Date().getFullYear()}-01-01`;
}

export default function PayrollFinance() {
    const [from, setFrom] = useState<string>(yearStartIso());
    const [to, setTo] = useState<string>(todayIso());
    const [dimension, setDimension] = useState<FinanceDimension>("EMPLOYEE");

    const [overview, setOverview] = useState<FinanceOverview | null>(null);
    const [rows, setRows] = useState<FinanceBreakdownRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!from || !to) return;
        setLoading(true);
        setError(null);
        try {
            const [ov, br] = await Promise.all([
                getFinanceOverview(from, to),
                getFinanceBreakdown(from, to, dimension),
            ]);
            setOverview(ov);
            setRows(br);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load finance data");
        } finally {
            setLoading(false);
        }
    }, [from, to, dimension]);

    useEffect(() => {
        void load();
    }, [load]);

    const summaryCards: [string, string][] = overview
        ? [
              ["Total gross wages", money(overview.totalGross)],
              ["Total net paid", money(overview.totalNet)],
              ["Total to Belastingdienst", money(overview.totalToBelastingdienst)],
              ["Loonheffing withheld", money(overview.totalLoonheffing)],
              ["Employer Zvw levy", money(overview.totalEmployerZvw)],
              ["Premies werknemersverzekeringen", money(overview.totalEmployerInsurancePremiums)],
              ["Employee pension", money(overview.totalPensionEmployee)],
              ["Total employer cost", money(overview.totalEmployerCost)],
              ["Hours worked", hours(overview.totalHours)],
              ["Employees", String(overview.employeeCount)],
              ["Payslips", String(overview.payslipCount)],
          ]
        : [];

    const totals = useMemo(() => {
        return rows.reduce(
            (acc, r) => ({
                gross: acc.gross + Number(r.gross ?? 0),
                net: acc.net + Number(r.net ?? 0),
                loonheffing: acc.loonheffing + Number(r.loonheffing ?? 0),
                employerCost: acc.employerCost + Number(r.employerCost ?? 0),
                hours: acc.hours + Number(r.hours ?? 0),
                payslips: acc.payslips + Number(r.payslipCount ?? 0),
            }),
            { gross: 0, net: 0, loonheffing: 0, employerCost: 0, hours: 0, payslips: 0 }
        );
    }, [rows]);

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage payrollFinancePage">
                <div className="pageShell">
                    <PrimaryNav />
                    <main className="pageShellContent">
                        <header className="pageHeader">
                            <PageBack to="/management/finance" />
                            <div>
                                <h1 className="pageTitle">Payroll Finance</h1>
                                <p className="pageSubtitle">
                                    Company payroll cost for the selected period: wages, withholdings, employer levies, and pension.
                                </p>
                            </div>
                        </header>

                        <div className="payrollFinanceNotice">
                            These are internal payroll-cost figures. Client revenue and margin (which depend on billing rates)
                            will be added in a later phase.
                        </div>

                        <div className="financeFilters">
                            <label>
                                From
                                <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
                            </label>
                            <label>
                                To
                                <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
                            </label>
                        </div>

                        {error ? <div className="payrollFinanceError">{error}</div> : null}

                        <section className="payrollFinanceLayout">
                            <div className="payrollFinanceMain">
                                <Card title="Finance overview" className="payrollFinanceCard">
                                    <div className="payrollFinanceCardBody">
                                        {loading && !overview ? (
                                            <div className="financeFlowText">Loading finance figures...</div>
                                        ) : (
                                            <div className="financeSummaryGrid">
                                                {summaryCards.map(([label, value]) => (
                                                    <div className="financeSummaryCard" key={label}>
                                                        <span>{label}</span>
                                                        <strong>{value}</strong>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </Card>

                                <Card title="Breakdown" className="payrollFinanceCard">
                                    <div className="payrollFinanceCardBody">
                                        <div className="financeToggle" role="tablist" aria-label="Breakdown dimension">
                                            {DIMENSIONS.map((d) => (
                                                <button
                                                    key={d.key}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={dimension === d.key}
                                                    className={`financeToggleBtn${dimension === d.key ? " financeToggleBtn--active" : ""}`}
                                                    onClick={() => setDimension(d.key)}
                                                >
                                                    {d.label}
                                                </button>
                                            ))}
                                        </div>

                                        {rows.length === 0 ? (
                                            <div className="financeFlowText">
                                                No payroll data for this period yet.
                                            </div>
                                        ) : (
                                            <table className="financeTable">
                                                <thead>
                                                    <tr>
                                                        <th>{DIMENSIONS.find((d) => d.key === dimension)?.label.replace("By ", "")}</th>
                                                        <th className="num">Gross</th>
                                                        <th className="num">Net</th>
                                                        <th className="num">Loonheffing</th>
                                                        <th className="num">Employer cost</th>
                                                        <th className="num">Hours</th>
                                                        <th className="num">Payslips</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rows.map((r) => (
                                                        <tr key={r.groupId}>
                                                            <td>{r.label}</td>
                                                            <td className="num">{money(r.gross)}</td>
                                                            <td className="num">{money(r.net)}</td>
                                                            <td className="num">{money(r.loonheffing)}</td>
                                                            <td className="num">{money(r.employerCost)}</td>
                                                            <td className="num">{hours(r.hours)}</td>
                                                            <td className="num">{r.payslipCount}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="financeTotalRow">
                                                        <td>Total</td>
                                                        <td className="num">{money(totals.gross)}</td>
                                                        <td className="num">{money(totals.net)}</td>
                                                        <td className="num">{money(totals.loonheffing)}</td>
                                                        <td className="num">{money(totals.employerCost)}</td>
                                                        <td className="num">{hours(totals.hours)}</td>
                                                        <td className="num">{totals.payslips}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        )}
                                    </div>
                                </Card>
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        </>
    );
}
