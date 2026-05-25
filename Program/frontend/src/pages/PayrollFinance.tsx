import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import { calculateFinanceSummary, type ShiftFinanceRecord } from "../utils/payrollFinance";
import "../stylesheets/AdminDashboard.css";
import "../stylesheets/PayrollFinance.css";

const currencyFormatter = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const financeRecords: ShiftFinanceRecord[] = [];

function money(value: number): string {
    return currencyFormatter.format(value);
}

function pct(value: number): string {
    return `${numberFormatter.format(value)}%`;
}

export default function PayrollFinance() {
    const summary = calculateFinanceSummary(financeRecords);

    const summaryCards = [
        ["Total client revenue", money(summary.totalClientRevenue)],
        ["Total employee gross wages", money(summary.totalEmployeeGrossWages)],
        ["Total employer costs", money(summary.totalEmployerCosts)],
        ["Total payable to Belastingdienst", money(summary.totalPayableToBelastingdienst)],
        ["Total payable to pension fund", money(summary.totalPayableToPensionFund)],
        ["Total net wages paid", money(summary.totalNetWagesPaid)],
        ["Total margin before overhead", money(summary.totalMarginBeforeOverhead)],
        ["Average margin percentage", pct(summary.averageMarginPercentage)],
        ["Number of shifts missing billing rates", String(summary.missingBillingRateCount)],
        ["Number of shifts with negative margin", String(summary.negativeMarginCount)],
    ];

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage payrollFinancePage">
                <div className="pageShell">
                    <PrimaryNav />
                    <main className="pageShellContent">
                        <header className="pageHeader">
                            <PageBack to="/management" />
                            <div>
                                <h1 className="pageTitle">Payroll Finance</h1>
                                <p className="pageSubtitle">
                                    View client revenue, employer costs, payroll payments, and payroll margin.
                                </p>
                            </div>
                        </header>

                        <div className="payrollFinanceNotice">
                            Client billing rates and payroll margin are internal business values. They are not visible to
                            employees and are not determined by the Horeca CAO or the Belastingdienst.
                        </div>

                        <section className="payrollFinanceLayout">
                            <div className="payrollFinanceMain">
                                <Card title="Finance overview" className="payrollFinanceCard">
                                    <div className="payrollFinanceCardBody">
                                        <div className="financeSummaryGrid">
                                            {summaryCards.map(([label, value]) => (
                                                <div className="financeSummaryCard" key={label}>
                                                    <span>{label}</span>
                                                    <strong>{value}</strong>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="financeFlowText">
                                            No approved payroll finance records are available yet. Finance totals will stay at
                                            zero until real approved payroll data with billing rates is available.
                                        </div>
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
