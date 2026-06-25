import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import {
    downloadMarginCsv,
    getFinanceBreakdown,
    getFinanceOverview,
    getMarginBreakdown,
    getMarginOverview,
    getMarginShifts,
    type FinanceBreakdownRow,
    type FinanceDimension,
    type FinanceOverview,
    type MarginBreakdownRow,
    type MarginDimension,
    type MarginOverview,
    type ShiftFinanceRow,
} from "../services/user-service/PayrollFinanceApi";
import "../stylesheets/AdminDashboard.css";
import "../stylesheets/PayrollFinance.css";

const currencyFormatter = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const money = (value: number | null | undefined) => currencyFormatter.format(Number(value ?? 0));
const hours = (value: number | null | undefined) => Number(value ?? 0).toFixed(2);
const percent = (value: number | null | undefined) => `${Number(value ?? 0).toFixed(1)}%`;

const DIMENSIONS: { key: FinanceDimension; label: string }[] = [
    { key: "EMPLOYEE", label: "By employee" },
    { key: "FUNCTION", label: "By function" },
    { key: "MONTH", label: "By month" },
];

const MARGIN_DIMENSIONS: { key: MarginDimension; label: string }[] = [
    { key: "CLIENT", label: "By client" },
    { key: "PROJECT", label: "By project" },
    { key: "EMPLOYEE", label: "By employee" },
    { key: "FUNCTION", label: "By function" },
    { key: "MONTH", label: "By month" },
];

const MARGIN_STATUS: Record<string, { label: string; cls: string }> = {
    healthy: { label: "Healthy", cls: "marginChip--healthy" },
    low_margin: { label: "Low", cls: "marginChip--low" },
    negative_margin: { label: "Negative", cls: "marginChip--negative" },
    missing_rate: { label: "No rate", cls: "marginChip--missing" },
    incomplete: { label: "Incomplete", cls: "marginChip--missing" },
};

function statusChip(status: string) {
    const s = MARGIN_STATUS[status] ?? { label: status, cls: "marginChip--missing" };
    return <span className={`marginChip ${s.cls}`}>{s.label}</span>;
}

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
    const [marginDimension, setMarginDimension] = useState<MarginDimension>("CLIENT");

    const [overview, setOverview] = useState<FinanceOverview | null>(null);
    const [rows, setRows] = useState<FinanceBreakdownRow[]>([]);
    const [marginOverview, setMarginOverview] = useState<MarginOverview | null>(null);
    const [marginRows, setMarginRows] = useState<MarginBreakdownRow[]>([]);
    const [shiftRows, setShiftRows] = useState<ShiftFinanceRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [marginLoading, setMarginLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadCost = useCallback(async () => {
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

    const loadMargin = useCallback(async () => {
        if (!from || !to) return;
        setMarginLoading(true);
        try {
            const [ov, br, sh] = await Promise.all([
                getMarginOverview(from, to),
                getMarginBreakdown(from, to, marginDimension),
                getMarginShifts(from, to),
            ]);
            setMarginOverview(ov);
            setMarginRows(br);
            setShiftRows(sh);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load revenue & margin data");
        } finally {
            setMarginLoading(false);
        }
    }, [from, to, marginDimension]);

    useEffect(() => {
        void loadCost();
    }, [loadCost]);

    useEffect(() => {
        void loadMargin();
    }, [loadMargin]);

    const handleExport = useCallback(async () => {
        setExporting(true);
        try {
            await downloadMarginCsv(from, to);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to export CSV");
        } finally {
            setExporting(false);
        }
    }, [from, to]);

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
                                    Company payroll cost, client revenue and margin for the selected period.
                                </p>
                            </div>
                        </header>

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
                                <Card title="Revenue & margin" className="payrollFinanceCard">
                                    <div className="payrollFinanceCardBody">
                                        {marginLoading && !marginOverview ? (
                                            <div className="financeFlowText">Loading revenue & margin...</div>
                                        ) : (
                                            <div className="financeSummaryGrid marginKpis">
                                                <div className="financeSummaryCard">
                                                    <span>Client revenue</span>
                                                    <strong>{money(marginOverview?.totalRevenue)}</strong>
                                                </div>
                                                <div className="financeSummaryCard">
                                                    <span>Employer cost</span>
                                                    <strong>{money(marginOverview?.totalEmployerCost)}</strong>
                                                </div>
                                                <div className="financeSummaryCard">
                                                    <span>Margin</span>
                                                    <strong className={Number(marginOverview?.totalMargin ?? 0) < 0 ? "financeNeg" : ""}>
                                                        {money(marginOverview?.totalMargin)}
                                                    </strong>
                                                </div>
                                                <div className="financeSummaryCard">
                                                    <span>Margin %</span>
                                                    <strong>{percent(marginOverview?.marginPercentage)}</strong>
                                                </div>
                                                <div className="financeSummaryCard">
                                                    <span>Shifts without a rate</span>
                                                    <strong className={Number(marginOverview?.missingRateCount ?? 0) > 0 ? "financeNeg" : ""}>
                                                        {String(marginOverview?.missingRateCount ?? 0)}
                                                    </strong>
                                                </div>
                                                <div className="financeSummaryCard">
                                                    <span>Negative-margin shifts</span>
                                                    <strong className={Number(marginOverview?.negativeMarginCount ?? 0) > 0 ? "financeNeg" : ""}>
                                                        {String(marginOverview?.negativeMarginCount ?? 0)}
                                                    </strong>
                                                </div>
                                            </div>
                                        )}
                                        <p className="financeFlowText">
                                            Estimated from worked shifts and resolved billing rates. Final (ACTUAL) figures are
                                            reconciled against released payslips.
                                        </p>
                                    </div>
                                </Card>

                                <Card title="Margin breakdown" className="payrollFinanceCard">
                                    <div className="payrollFinanceCardBody">
                                        <div className="financeCardHeaderRow">
                                            <div className="financeToggle" role="tablist" aria-label="Margin breakdown dimension">
                                                {MARGIN_DIMENSIONS.map((d) => (
                                                    <button
                                                        key={d.key}
                                                        type="button"
                                                        role="tab"
                                                        aria-selected={marginDimension === d.key}
                                                        className={`financeToggleBtn${marginDimension === d.key ? " financeToggleBtn--active" : ""}`}
                                                        onClick={() => setMarginDimension(d.key)}
                                                    >
                                                        {d.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                className="financeExportBtn"
                                                onClick={() => void handleExport()}
                                                disabled={exporting}
                                            >
                                                {exporting ? "Exporting..." : "Export CSV"}
                                            </button>
                                        </div>

                                        {marginRows.length === 0 ? (
                                            <div className="financeFlowText">No revenue & margin data for this period yet.</div>
                                        ) : (
                                            <table className="financeTable">
                                                <thead>
                                                    <tr>
                                                        <th>{MARGIN_DIMENSIONS.find((d) => d.key === marginDimension)?.label.replace("By ", "")}</th>
                                                        <th className="num">Revenue</th>
                                                        <th className="num">Cost</th>
                                                        <th className="num">Margin</th>
                                                        <th className="num">Margin %</th>
                                                        <th className="num">Hours</th>
                                                        <th className="num">Shifts</th>
                                                        <th className="num">No rate</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {marginRows.map((r) => (
                                                        <tr key={r.groupId}>
                                                            <td>{r.label}</td>
                                                            <td className="num">{money(r.revenue)}</td>
                                                            <td className="num">{money(r.employerCost)}</td>
                                                            <td className={`num${Number(r.margin ?? 0) < 0 ? " financeNeg" : ""}`}>{money(r.margin)}</td>
                                                            <td className="num">{percent(r.marginPercentage)}</td>
                                                            <td className="num">{hours(r.hours)}</td>
                                                            <td className="num">{r.shiftCount}</td>
                                                            <td className="num">{r.missingRateCount}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </Card>

                                <Card title="Shifts" className="payrollFinanceCard">
                                    <div className="payrollFinanceCardBody">
                                        {shiftRows.length === 0 ? (
                                            <div className="financeFlowText">No shifts for this period yet.</div>
                                        ) : (
                                            <table className="financeTable">
                                                <thead>
                                                    <tr>
                                                        <th>Date</th>
                                                        <th>Client</th>
                                                        <th>Project</th>
                                                        <th>Function</th>
                                                        <th className="num">Hours</th>
                                                        <th className="num">Rate</th>
                                                        <th className="num">Revenue</th>
                                                        <th className="num">Cost</th>
                                                        <th className="num">Margin</th>
                                                        <th>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {shiftRows.map((r) => (
                                                        <tr key={r.timesheetId}>
                                                            <td>{r.shiftDate ?? "—"}</td>
                                                            <td>{r.clientName ?? "—"}</td>
                                                            <td>{r.projectName ?? "—"}</td>
                                                            <td>{r.function ?? "—"}</td>
                                                            <td className="num">{hours(r.hours)}</td>
                                                            <td className="num">{r.ratePerHour == null ? "—" : money(r.ratePerHour)}</td>
                                                            <td className="num">{money(r.clientRevenue)}</td>
                                                            <td className="num">{money(r.totalEmployerCost)}</td>
                                                            <td className={`num${Number(r.margin ?? 0) < 0 ? " financeNeg" : ""}`}>{money(r.margin)}</td>
                                                            <td>{statusChip(r.marginStatus)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </Card>

                                <Card title="Payroll cost overview" className="payrollFinanceCard">
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

                                <Card title="Cost breakdown" className="payrollFinanceCard">
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
                                            <div className="financeFlowText">No payroll data for this period yet.</div>
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
