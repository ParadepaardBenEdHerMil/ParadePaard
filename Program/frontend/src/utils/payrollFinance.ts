import { HORECA_EMPLOYER_PREMIUM_RULES } from "../data/horecaPayrollRules";
import { getPayrollVariableNumber } from "./horecaPayrollRules";

export type MarginStatus = "healthy" | "low_margin" | "negative_margin" | "missing_rate" | "incomplete";
export type BillingRateRoundingRule = "TWO_DECIMALS" | "NEAREST_0_05" | "NEAREST_0_10";

export type FinanceSettings = {
    minimumMarginPercentage: number;
    sicknessRiskPercentage: number;
    insuranceReservePercentage: number;
    administrationCostPerHour: number;
    overheadPercentage: number;
    roundingRule: BillingRateRoundingRule;
    includeHolidayAllowanceInCost: boolean;
    includeVacationReservationInCost: boolean;
    includePensionInCost: boolean;
    lockAfterPayrollApproval: boolean;
};

export type ClientBillingRate = {
    id: string;
    clientId: string;
    jobPresetId: string | null;
    defaultBillingRatePerHour: number;
    effectiveFrom: string;
    effectiveTo: string | null;
    notes: string;
    isActive: boolean;
};

export type JobPresetBillingRate = {
    id: string;
    jobPresetId: string;
    defaultBillingRatePerHour: number;
    effectiveFrom: string;
    effectiveTo: string | null;
    notes: string;
    isActive: boolean;
};

export type BillingRateOverrideLog = {
    id: string;
    shiftFinanceRecordId: string;
    oldRate: number | null;
    newRate: number;
    reason: string;
    changedBy: string;
    changedAt: string;
};

export type ShiftFinanceRecord = {
    id: string;
    shiftId: string;
    employeeId: string;
    clientId: string;
    jobPresetId: string;
    payrollRunId: string;
    shiftDate: string;
    clientName: string;
    location: string;
    employeeName: string;
    jobPresetName: string;
    jobFunction: string;
    functionGroup: string;
    contractType: string;
    payrollPeriod: string;
    invoiceStatus: "PAID" | "UNPAID";
    workedHours: number;
    employeeHourlyWage: number;
    employeeGrossWage: number;
    holidayAllowanceCost: number;
    vacationReservationCost: number;
    employeePayrollTaxWithheld: number;
    employeePensionDeduction: number;
    netWagePaid: number;
    employerAwf: number;
    employerAof: number;
    employerWhk: number;
    employerWko: number;
    employerZvw: number;
    employerPension: number;
    otherEmployerCosts: number;
    totalPayableToBelastingdienst: number;
    totalPayableToPensionFund: number;
    totalEmployerCost: number;
    clientBillingRatePerHour: number | null;
    clientRevenue: number;
    marginBeforeOverhead: number;
    marginPercentage: number;
    marginStatus: MarginStatus;
    billingRateSource: string;
    isBillingRateOverridden: boolean;
    billingRateOverrideReason: string;
    isLocked: boolean;
    createdAt: string;
    updatedAt: string;
    warnings: string[];
};

export type ShiftFinanceCalculationInput = {
    id: string;
    shiftId: string;
    employeeId: string;
    clientId: string;
    jobPresetId: string;
    payrollRunId: string;
    shiftDate?: string;
    clientName?: string;
    location?: string;
    employeeName?: string;
    jobPresetName?: string;
    jobFunction?: string;
    functionGroup?: string;
    contractType?: string;
    payrollPeriod?: string;
    invoiceStatus?: "PAID" | "UNPAID";
    workedHours: number;
    employeeHourlyWage: number | null;
    employeePayrollTaxWithheld: number;
    pensionApplicable: boolean;
    clientBillingRatePerHour: number | null;
    billingRateSource?: string;
    isBillingRateOverridden?: boolean;
    billingRateOverrideReason?: string;
    otherEmployerCosts: number;
    financeSettings: FinanceSettings;
    isLocked?: boolean;
    createdAt: string;
    updatedAt: string;
};

export type BillingRateResolutionInput = {
    customShiftRate?: number | null;
    employeeShiftRate?: number | null;
    overrideRate?: number | null;
    jobPresetDefaultRate?: number | null;
    clientDefaultRate?: number | null;
};

export type FinanceSummary = {
    totalClientRevenue: number;
    totalEmployeeGrossWages: number;
    totalEmployerCosts: number;
    totalPayableToBelastingdienst: number;
    totalPayableToPensionFund: number;
    totalNetWagesPaid: number;
    totalMarginBeforeOverhead: number;
    averageMarginPercentage: number;
    missingBillingRateCount: number;
    negativeMarginCount: number;
};

function round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function premium(name: string): number {
    const found = HORECA_EMPLOYER_PREMIUM_RULES.find((rule) => rule.premiumName === name);
    if (!found) throw new Error(`Missing employer premium: ${name}`);
    return found.percentage;
}

function percentageOf(base: number, percentage: number): number {
    return round2(base * (percentage / 100));
}

function getMarginStatus(rate: number | null, margin: number, marginPercentage: number, minimumMargin: number): MarginStatus {
    if (rate == null || rate <= 0) return "missing_rate";
    if (margin < 0) return "negative_margin";
    if (marginPercentage < minimumMargin) return "low_margin";
    return "healthy";
}

export function resolveBillingRate(input: BillingRateResolutionInput): { rate: number | null; source: string } {
    if (input.employeeShiftRate != null) return { rate: input.employeeShiftRate, source: "Employee shift custom rate" };
    if (input.overrideRate != null) return { rate: input.overrideRate, source: "Special day override" };
    if (input.customShiftRate != null) return { rate: input.customShiftRate, source: "Custom shift rate" };
    if (input.jobPresetDefaultRate != null) return { rate: input.jobPresetDefaultRate, source: "Job preset default" };
    if (input.clientDefaultRate != null) return { rate: input.clientDefaultRate, source: "Client default" };
    return { rate: null, source: "Missing billing rate" };
}

export function calculateShiftFinanceRecord(input: ShiftFinanceCalculationInput): ShiftFinanceRecord {
    const warnings: string[] = [];
    const hourlyWage = input.employeeHourlyWage ?? 0;
    const grossWage = round2(input.workedHours * hourlyWage);
    const holidayAllowanceCost = input.financeSettings.includeHolidayAllowanceInCost
        ? percentageOf(grossWage, getPayrollVariableNumber("holidayAllowancePercentage"))
        : 0;
    const vacationReservationCost = input.financeSettings.includeVacationReservationInCost
        ? percentageOf(grossWage, getPayrollVariableNumber("vacationBuildUpPerPaidHour") * 100)
        : 0;
    const employeePensionDeduction = input.pensionApplicable
        ? percentageOf(grossWage, getPayrollVariableNumber("pensionPremiumEmployee"))
        : 0;
    const employerAwf = percentageOf(grossWage, premium("AWf low"));
    const employerAof = percentageOf(grossWage, premium("Aof low"));
    const employerWhk = percentageOf(grossWage, premium("Whk sector 33 Horeca algemeen"));
    const employerWko = percentageOf(grossWage, premium("Wko surcharge"));
    const employerZvw = percentageOf(grossWage, premium("Employer Zvw contribution"));
    const employerPension =
        input.pensionApplicable && input.financeSettings.includePensionInCost
            ? percentageOf(grossWage, getPayrollVariableNumber("pensionPremiumEmployer"))
            : 0;
    const sicknessReserve = percentageOf(grossWage, input.financeSettings.sicknessRiskPercentage);
    const insuranceReserve = percentageOf(grossWage, input.financeSettings.insuranceReservePercentage);
    const administrationCost = round2(input.workedHours * input.financeSettings.administrationCostPerHour);
    const otherEmployerCosts = round2(input.otherEmployerCosts + sicknessReserve + insuranceReserve + administrationCost);
    const employerContributionTotal = round2(employerAwf + employerAof + employerWhk + employerWko + employerZvw);
    const totalPayableToBelastingdienst = round2(input.employeePayrollTaxWithheld + employerContributionTotal);
    const totalPayableToPensionFund = round2(employeePensionDeduction + employerPension);
    const netWagePaid = round2(grossWage - input.employeePayrollTaxWithheld - employeePensionDeduction);
    const totalEmployerCost = round2(
        grossWage +
            holidayAllowanceCost +
            vacationReservationCost +
            employerContributionTotal +
            employerPension +
            otherEmployerCosts
    );
    const clientRevenue = input.clientBillingRatePerHour == null ? 0 : round2(input.workedHours * input.clientBillingRatePerHour);
    const marginBeforeOverhead = input.clientBillingRatePerHour == null ? 0 : round2(clientRevenue - totalEmployerCost);
    const marginPercentage = clientRevenue > 0 ? round2((marginBeforeOverhead / clientRevenue) * 100) : 0;
    const marginStatus = getMarginStatus(
        input.clientBillingRatePerHour,
        marginBeforeOverhead,
        marginPercentage,
        input.financeSettings.minimumMarginPercentage
    );

    if (input.clientBillingRatePerHour == null) warnings.push("Billing rate is missing.");
    if (input.employeeHourlyWage == null) warnings.push("Employee wage is missing.");
    if (marginStatus === "negative_margin") warnings.push("Client revenue is lower than total employer cost.");
    if (marginStatus === "low_margin") warnings.push("Margin is below the configured minimum.");
    if (input.isLocked) warnings.push("Finance values are locked after payroll approval.");

    return {
        id: input.id,
        shiftId: input.shiftId,
        employeeId: input.employeeId,
        clientId: input.clientId,
        jobPresetId: input.jobPresetId,
        payrollRunId: input.payrollRunId,
        shiftDate: input.shiftDate ?? "2026-01-18",
        clientName: input.clientName ?? "Horeca client",
        location: input.location ?? "Main location",
        employeeName: input.employeeName ?? "Employee",
        jobPresetName: input.jobPresetName ?? "Job preset",
        jobFunction: input.jobFunction ?? "Horeca work",
        functionGroup: input.functionGroup ?? "I+II",
        contractType: input.contractType ?? "Part time",
        payrollPeriod: input.payrollPeriod ?? "Monthly",
        invoiceStatus: input.invoiceStatus ?? "UNPAID",
        workedHours: input.workedHours,
        employeeHourlyWage: hourlyWage,
        employeeGrossWage: grossWage,
        holidayAllowanceCost,
        vacationReservationCost,
        employeePayrollTaxWithheld: input.employeePayrollTaxWithheld,
        employeePensionDeduction,
        netWagePaid,
        employerAwf,
        employerAof,
        employerWhk,
        employerWko,
        employerZvw,
        employerPension,
        otherEmployerCosts,
        totalPayableToBelastingdienst,
        totalPayableToPensionFund,
        totalEmployerCost,
        clientBillingRatePerHour: input.clientBillingRatePerHour,
        clientRevenue,
        marginBeforeOverhead,
        marginPercentage,
        marginStatus,
        billingRateSource: input.billingRateSource ?? "Custom shift rate",
        isBillingRateOverridden: Boolean(input.isBillingRateOverridden),
        billingRateOverrideReason: input.billingRateOverrideReason ?? "",
        isLocked: Boolean(input.isLocked),
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
        warnings,
    };
}

export function calculateFinanceSummary(records: ShiftFinanceRecord[]): FinanceSummary {
    const totalClientRevenue = round2(records.reduce((sum, record) => sum + record.clientRevenue, 0));
    const totalEmployerCosts = round2(records.reduce((sum, record) => sum + record.totalEmployerCost, 0));
    const totalMarginBeforeOverhead = round2(records.reduce((sum, record) => sum + record.marginBeforeOverhead, 0));

    return {
        totalClientRevenue,
        totalEmployeeGrossWages: round2(records.reduce((sum, record) => sum + record.employeeGrossWage, 0)),
        totalEmployerCosts,
        totalPayableToBelastingdienst: round2(records.reduce((sum, record) => sum + record.totalPayableToBelastingdienst, 0)),
        totalPayableToPensionFund: round2(records.reduce((sum, record) => sum + record.totalPayableToPensionFund, 0)),
        totalNetWagesPaid: round2(records.reduce((sum, record) => sum + record.netWagePaid, 0)),
        totalMarginBeforeOverhead,
        averageMarginPercentage: totalClientRevenue > 0 ? round2((totalMarginBeforeOverhead / totalClientRevenue) * 100) : 0,
        missingBillingRateCount: records.filter((record) => record.marginStatus === "missing_rate").length,
        negativeMarginCount: records.filter((record) => record.marginStatus === "negative_margin").length,
    };
}
