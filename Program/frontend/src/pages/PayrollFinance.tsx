import { useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import {
    calculateFinanceSummary,
    calculateShiftFinanceRecord,
    type FinanceSettings,
    type ShiftFinanceRecord,
} from "../utils/payrollFinance";
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

const financeSettings: FinanceSettings = {
    minimumMarginPercentage: 18,
    sicknessRiskPercentage: 2,
    insuranceReservePercentage: 1,
    administrationCostPerHour: 1.25,
    overheadPercentage: 0,
    roundingRule: "TWO_DECIMALS",
    includeHolidayAllowanceInCost: true,
    includeVacationReservationInCost: true,
    includePensionInCost: true,
    lockAfterPayrollApproval: true,
};

const initialFinanceRows = [
    calculateShiftFinanceRecord({
        id: "finance-bar-employee",
        shiftId: "shift-breda-evening",
        employeeId: "employee-ava",
        clientId: "client-brasserie",
        jobPresetId: "bar-employee",
        payrollRunId: "payroll-2026-01",
        shiftDate: "2026-01-18",
        clientName: "Brasserie De Markt",
        location: "Breda main bar",
        employeeName: "Ava Jansen",
        jobPresetName: "Bar employee",
        jobFunction: "Bar service and guest support",
        functionGroup: "I+II",
        contractType: "Part time",
        payrollPeriod: "Monthly",
        invoiceStatus: "UNPAID",
        workedHours: 6,
        employeeHourlyWage: 16.5,
        employeePayrollTaxWithheld: 18,
        pensionApplicable: true,
        clientBillingRatePerHour: 29.5,
        billingRateSource: "Custom shift rate",
        isBillingRateOverridden: true,
        billingRateOverrideReason: "Evening event rate agreed with client.",
        otherEmployerCosts: 0,
        financeSettings,
        createdAt: "2026-01-18T10:00:00",
        updatedAt: "2026-01-18T10:00:00",
    }),
    calculateShiftFinanceRecord({
        id: "finance-runner",
        shiftId: "shift-breda-evening",
        employeeId: "employee-noah",
        clientId: "client-brasserie",
        jobPresetId: "runner",
        payrollRunId: "payroll-2026-01",
        shiftDate: "2026-01-18",
        clientName: "Brasserie De Markt",
        location: "Breda floor",
        employeeName: "Noah Bakker",
        jobPresetName: "Runner",
        jobFunction: "Floor support and clearing",
        functionGroup: "I+II",
        contractType: "Zero hours",
        payrollPeriod: "Monthly",
        invoiceStatus: "UNPAID",
        workedHours: 5,
        employeeHourlyWage: 14.71,
        employeePayrollTaxWithheld: 12.5,
        pensionApplicable: true,
        clientBillingRatePerHour: 26,
        billingRateSource: "Job preset default",
        otherEmployerCosts: 0,
        financeSettings,
        createdAt: "2026-01-18T10:00:00",
        updatedAt: "2026-01-18T10:00:00",
    }),
    calculateShiftFinanceRecord({
        id: "finance-supervisor",
        shiftId: "shift-breda-evening",
        employeeId: "employee-sara",
        clientId: "client-brasserie",
        jobPresetId: "supervisor",
        payrollRunId: "payroll-2026-01",
        shiftDate: "2026-01-18",
        clientName: "Brasserie De Markt",
        location: "Breda floor",
        employeeName: "Sara Vermeer",
        jobPresetName: "Supervisor",
        jobFunction: "Shift coordination",
        functionGroup: "I+II",
        contractType: "Full time",
        payrollPeriod: "Monthly",
        invoiceStatus: "PAID",
        workedHours: 7,
        employeeHourlyWage: 20,
        employeePayrollTaxWithheld: 28,
        pensionApplicable: true,
        clientBillingRatePerHour: 38,
        billingRateSource: "Client default",
        otherEmployerCosts: 0,
        financeSettings,
        isLocked: true,
        createdAt: "2026-01-18T10:00:00",
        updatedAt: "2026-01-18T10:00:00",
    }),
    calculateShiftFinanceRecord({
        id: "finance-missing-rate",
        shiftId: "shift-rooftop-lunch",
        employeeId: "employee-lina",
        clientId: "client-rooftop",
        jobPresetId: "waiter",
        payrollRunId: "payroll-2026-01",
        shiftDate: "2026-01-22",
        clientName: "Rooftop Lunch",
        location: "Tilburg terrace",
        employeeName: "Lina Smit",
        jobPresetName: "Waiter",
        jobFunction: "Guest service",
        functionGroup: "I+II",
        contractType: "Part time",
        payrollPeriod: "Monthly",
        invoiceStatus: "UNPAID",
        workedHours: 4,
        employeeHourlyWage: 14.71,
        employeePayrollTaxWithheld: 9,
        pensionApplicable: true,
        clientBillingRatePerHour: null,
        billingRateSource: "Missing billing rate",
        otherEmployerCosts: 0,
        financeSettings,
        createdAt: "2026-01-22T10:00:00",
        updatedAt: "2026-01-22T10:00:00",
    }),
];

function money(value: number): string {
    return currencyFormatter.format(value);
}

function pct(value: number): string {
    return `${numberFormatter.format(value)}%`;
}

function statusLabel(status: ShiftFinanceRecord["marginStatus"]): string {
    if (status === "missing_rate") return "Missing rate";
    if (status === "negative_margin") return "Negative margin";
    if (status === "low_margin") return "Low margin";
    if (status === "incomplete") return "Incomplete";
    return "Healthy";
}

export default function PayrollFinance() {
    const [records, setRecords] = useState<ShiftFinanceRecord[]>(initialFinanceRows);
    const [selectedRecordId, setSelectedRecordId] = useState(initialFinanceRows[0]?.id ?? "");
    const [selectedRows, setSelectedRows] = useState<string[]>([initialFinanceRows[0]?.id ?? ""]);
    const [bulkRate, setBulkRate] = useState("30.00");
    const [overrideReason, setOverrideReason] = useState("Manual finance review");
    const summary = useMemo(() => calculateFinanceSummary(records), [records]);
    const selectedRecord = records.find((record) => record.id === selectedRecordId) ?? records[0];

    const updateRecordRate = (recordId: string, nextRate: number | null, reason = "Inline billing rate edit") => {
        setRecords((current) =>
            current.map((record) => {
                if (record.id !== recordId) return record;
                return calculateShiftFinanceRecord({
                    ...record,
                    clientBillingRatePerHour: nextRate,
                    billingRateSource: nextRate == null ? "Missing billing rate" : "Manual override",
                    isBillingRateOverridden: true,
                    billingRateOverrideReason: reason,
                    otherEmployerCosts: 0,
                    pensionApplicable: record.employeePensionDeduction > 0 || record.employerPension > 0,
                    financeSettings,
                    updatedAt: new Date().toISOString(),
                });
            })
        );
    };

    const applyBulkRate = () => {
        const parsed = Number(bulkRate);
        if (!Number.isFinite(parsed) || parsed < 0) return;
        selectedRows.forEach((recordId) => updateRecordRate(recordId, parsed, overrideReason));
    };

    const toggleSelected = (recordId: string) => {
        setSelectedRows((current) =>
            current.includes(recordId) ? current.filter((id) => id !== recordId) : [...current, recordId]
        );
    };

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
                                    View shift billing, employer costs, client charges, and payroll margin.
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
                                            The employee is paid from wage, CAO, tax, pension, and payroll rules. The horeca
                                            client is billed separately from the shift billing rate. This page compares client
                                            revenue against employer cost and cash-flow payments.
                                        </div>
                                    </div>
                                </Card>

                                <Card title="Shift billing rates" className="payrollFinanceCard">
                                    <div className="payrollFinanceCardBody">
                                        <div className="financeRateGrid">
                                            <div>
                                                <strong>Billing rate priority</strong>
                                                <p>
                                                    Custom employee shift rate, special day override, custom shift rate, job
                                                    preset default, then client default.
                                                </p>
                                            </div>
                                            <div>
                                                <strong>Internal finance settings</strong>
                                                <p>
                                                    Client billing rate, margin target, sickness reserve, insurance reserve,
                                                    administration cost, and overhead are internal business values.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="financeBulkActions">
                                            <label>
                                                <span>Bulk update billing rates</span>
                                                <input
                                                    value={bulkRate}
                                                    onChange={(event) => setBulkRate(event.target.value)}
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                />
                                            </label>
                                            <label>
                                                <span>Manual override reason</span>
                                                <input value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} />
                                            </label>
                                            <button type="button" className="button" onClick={applyBulkRate}>
                                                Apply manual override with reason
                                            </button>
                                            <button type="button" className="button buttonSecondary">
                                                Set default rate from job preset
                                            </button>
                                            <button type="button" className="button buttonSecondary">
                                                Set default rate from client
                                            </button>
                                            <button type="button" className="button buttonSecondary">
                                                Copy previous rate from same client and job
                                            </button>
                                            <button type="button" className="button buttonSecondary">
                                                Apply weekend or holiday surcharge
                                            </button>
                                        </div>
                                    </div>
                                </Card>

                                <Card title="Finance history per shift" className="payrollFinanceCard">
                                    <div className="payrollFinanceCardBody">
                                        <div className="financeFilters">
                                            {[
                                                "Date range",
                                                "Client",
                                                "Location",
                                                "Employee",
                                                "Job preset",
                                                "Function group",
                                                "Contract type",
                                                "Margin status",
                                                "Paid or unpaid invoice status",
                                                "Payroll period",
                                            ].map((label) => (
                                                <label key={label}>
                                                    <span>{label}</span>
                                                    <input placeholder="All" />
                                                </label>
                                            ))}
                                        </div>
                                        <div className="tableScroll">
                                            <table className="financeTable">
                                                <thead>
                                                    <tr>
                                                        <th>Select</th>
                                                        <th>Shift</th>
                                                        <th>Employee</th>
                                                        <th>Client</th>
                                                        <th>Hours</th>
                                                        <th>Employee cost</th>
                                                        <th>Client billing rate per hour</th>
                                                        <th>Client revenue</th>
                                                        <th>Margin before overhead</th>
                                                        <th>Status</th>
                                                        <th>Breakdown</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {records.map((record) => (
                                                        <tr key={record.id}>
                                                            <td>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedRows.includes(record.id)}
                                                                    onChange={() => toggleSelected(record.id)}
                                                                    aria-label={`Select ${record.employeeName}`}
                                                                />
                                                            </td>
                                                            <td>
                                                                <strong>{record.shiftDate}</strong>
                                                                <span>{record.location}</span>
                                                            </td>
                                                            <td>
                                                                <strong>{record.employeeName}</strong>
                                                                <span>{record.jobPresetName}</span>
                                                            </td>
                                                            <td>{record.clientName}</td>
                                                            <td>{numberFormatter.format(record.workedHours)}</td>
                                                            <td>{money(record.totalEmployerCost)}</td>
                                                            <td>
                                                                <input
                                                                    className="financeRateInput"
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    aria-label={`Client billing rate per hour for ${record.employeeName}`}
                                                                    value={record.clientBillingRatePerHour ?? ""}
                                                                    onChange={(event) =>
                                                                        updateRecordRate(
                                                                            record.id,
                                                                            event.target.value === "" ? null : Number(event.target.value)
                                                                        )
                                                                    }
                                                                    disabled={record.isLocked}
                                                                />
                                                                <span>{record.billingRateSource}</span>
                                                            </td>
                                                            <td>{money(record.clientRevenue)}</td>
                                                            <td>{money(record.marginBeforeOverhead)}</td>
                                                            <td>
                                                                <span className={`financeStatus financeStatus--${record.marginStatus}`}>
                                                                    {statusLabel(record.marginStatus)}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <button
                                                                    type="button"
                                                                    className="button buttonSecondary"
                                                                    onClick={() => setSelectedRecordId(record.id)}
                                                                >
                                                                    View breakdown
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </Card>

                                <div className="financeSectionGrid">
                                    {[
                                        [
                                            "Client invoice calculation",
                                            "Client revenue equals worked hours times the client billing rate per hour. Missing billing rates block revenue calculation.",
                                        ],
                                        [
                                            "Employee cost breakdown",
                                            "Total employer cost includes gross wage, holiday allowance, vacation reservation, employer contributions, employer pension, sickness reserve, insurance reserve, and administration cost.",
                                        ],
                                        [
                                            "Employer tax and contribution breakdown",
                                            "Employer AWf, Aof, Whk, Wko, and Zvw are shown separately and also grouped into the Belastingdienst payment.",
                                        ],
                                        [
                                            "Pension cost breakdown",
                                            "Employee pension is withheld from gross wage. Employer pension is an extra employer cost. Both are paid to the pension fund.",
                                        ],
                                        [
                                            "Margin calculation",
                                            "Margin before overhead equals client revenue minus total employer cost. Margin percentage is margin divided by client revenue.",
                                        ],
                                        [
                                            "Finance settings",
                                            "Configure minimum margin, sickness risk, insurance reserve, administration cost, overhead, rounding, included cost categories, and finance lock behavior.",
                                        ],
                                    ].map(([title, text]) => (
                                        <Card title={title} className="payrollFinanceCard" key={title}>
                                            <div className="payrollFinanceCardBody">
                                                <p className="financeFlowText">{text}</p>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>

                            {selectedRecord ? (
                                <aside className="financeSidePanel">
                                    <div className="financeSidePanelHeader">
                                        <h2>{selectedRecord.employeeName}</h2>
                                        <span className={`financeStatus financeStatus--${selectedRecord.marginStatus}`}>
                                            {statusLabel(selectedRecord.marginStatus)}
                                        </span>
                                    </div>
                                    <div className="financeBreakdownRows">
                                        <h3>Employee wage breakdown</h3>
                                        <div><span>Worked hours</span><strong>{numberFormatter.format(selectedRecord.workedHours)}</strong></div>
                                        <div><span>Employee hourly wage</span><strong>{money(selectedRecord.employeeHourlyWage)}</strong></div>
                                        <div><span>Employee gross wage</span><strong>{money(selectedRecord.employeeGrossWage)}</strong></div>
                                        <div><span>Holiday allowance cost</span><strong>{money(selectedRecord.holidayAllowanceCost)}</strong></div>
                                        <div><span>Vacation buildup cost</span><strong>{money(selectedRecord.vacationReservationCost)}</strong></div>
                                        <h3>Employee deductions</h3>
                                        <div><span>Employee payroll tax withheld</span><strong>{money(selectedRecord.employeePayrollTaxWithheld)}</strong></div>
                                        <div><span>Employee pension deduction</span><strong>{money(selectedRecord.employeePensionDeduction)}</strong></div>
                                        <div><span>Net wage paid to employee</span><strong>{money(selectedRecord.netWagePaid)}</strong></div>
                                        <h3>Employer contributions</h3>
                                        <div><span>Employer AWf</span><strong>{money(selectedRecord.employerAwf)}</strong></div>
                                        <div><span>Employer Aof</span><strong>{money(selectedRecord.employerAof)}</strong></div>
                                        <div><span>Employer Whk</span><strong>{money(selectedRecord.employerWhk)}</strong></div>
                                        <div><span>Employer Wko</span><strong>{money(selectedRecord.employerWko)}</strong></div>
                                        <div><span>Employer Zvw</span><strong>{money(selectedRecord.employerZvw)}</strong></div>
                                        <div><span>Employer pension</span><strong>{money(selectedRecord.employerPension)}</strong></div>
                                        <h3>Belastingdienst payment</h3>
                                        <div><span>Total payable to Belastingdienst</span><strong>{money(selectedRecord.totalPayableToBelastingdienst)}</strong></div>
                                        <h3>Pension payment</h3>
                                        <div><span>Total payable to pension fund</span><strong>{money(selectedRecord.totalPayableToPensionFund)}</strong></div>
                                        <h3>Client invoice calculation</h3>
                                        <div><span>Client billing rate per hour</span><strong>{selectedRecord.clientBillingRatePerHour == null ? "Missing" : money(selectedRecord.clientBillingRatePerHour)}</strong></div>
                                        <div><span>Client revenue</span><strong>{money(selectedRecord.clientRevenue)}</strong></div>
                                        <h3>Margin calculation</h3>
                                        <div><span>Total employer cost</span><strong>{money(selectedRecord.totalEmployerCost)}</strong></div>
                                        <div><span>Margin before overhead</span><strong>{money(selectedRecord.marginBeforeOverhead)}</strong></div>
                                        <div><span>Margin percentage</span><strong>{pct(selectedRecord.marginPercentage)}</strong></div>
                                        <h3>Source notes</h3>
                                        <p>
                                            Payroll source values come from the horeca CAO, wage table, Belastingdienst
                                            documents, and pension fund rules. Billing rates, reserves, overhead, and margin
                                            targets are internal finance settings.
                                        </p>
                                        {selectedRecord.warnings.length > 0 ? (
                                            <div className="financeWarningList">
                                                {selectedRecord.warnings.map((warning) => (
                                                    <span key={warning}>{warning}</span>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                </aside>
                            ) : null}
                        </section>
                    </main>
                </div>
            </div>
        </>
    );
}
