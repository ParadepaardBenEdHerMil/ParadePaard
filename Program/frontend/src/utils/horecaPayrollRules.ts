import {
    DEFAULT_HORECA_JOB_PRESETS,
    HORECA_EMPLOYER_PREMIUM_RULES,
    HORECA_PAYROLL_VARIABLES,
    HORECA_RULE_SOURCES,
    HORECA_WAGE_RULES,
    type ContractType,
    type HolidayAllowanceMode,
    type JobPreset,
    type PayrollPeriod,
    type PayrollRuleSource,
} from "../data/horecaPayrollRules";

export type HorecaContractValidationInput = {
    employeeDateOfBirth?: string | null;
    startDate?: string | null;
    caoId?: string | null;
    jobPresetId?: string | null;
    contractType?: string | null;
    functionGroup?: string | null;
    hourlyWage?: number | null;
    loonheffingskorting?: boolean | null;
    pensionApplicable?: boolean | null;
    isManualWageOverride?: boolean | null;
    manualWageOverrideReason?: string | null;
    sourcesOutdated?: boolean;
};

export type HorecaContractValidationResult = {
    blockingErrors: string[];
    warnings: string[];
    requiredHourlyWage: number | null;
    requiredWageSourceId: string | null;
};

export type HorecaWageLookupInput = {
    dateOfBirth?: string | null;
    startDate?: string | null;
    functionGroup?: string | null;
};

export type ExamplePayrollCalculation = {
    grossWage: number;
    holidayAllowanceReservation: number;
    vacationHoursBuildUp: number;
    payrollTaxWithheld: number;
    employeePensionDeduction: number;
    netWagePaid: number;
    employerAwfLow: number;
    employerAofLow: number;
    employerWhk: number;
    employerWkoSurcharge: number;
    employerZvw: number;
    employerPension: number;
    amountPayableToBelastingdienst: number;
    amountPayableToPensionFund: number;
    employerPayrollContributions: number;
    totalEmployerCostBeforePayrollMargin: number;
};

export type PayrollCalculatorInput = {
    grossWage?: number | null;
    hourlyWage: number;
    monthlyHours: number;
    payrollTaxWithheld: number;
    holidayAllowancePercentage: number;
    vacationBuildUpPerPaidHour: number;
    employeePensionPercentage: number;
    employerPensionPercentage: number;
    employerAwfPercentage: number;
    employerAofPercentage: number;
    employerWhkPercentage: number;
    employerWkoPercentage: number;
    employerZvwPercentage: number;
};

const STORAGE_KEY = "horeca-job-presets";

function round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundEntitlementHours(value: number): number {
    return Math.ceil((value - Number.EPSILON) * 100) / 100;
}

function safeNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value.replace(",", "."));
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function parseIsoDate(value?: string | null): Date | null {
    if (!value) return null;
    const normalized = value.trim();
    if (!normalized) return null;
    const date = new Date(`${normalized}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function isOnOrAfter(value: string, compareTo: string): boolean {
    return value >= compareTo;
}

function isOnOrBefore(value: string, compareTo: string | null): boolean {
    return compareTo == null || value <= compareTo;
}

export function calculateAgeOnDate(dateOfBirth?: string | null, onDate?: string | null): number | null {
    const birth = parseIsoDate(dateOfBirth);
    const date = parseIsoDate(onDate);
    if (!birth || !date) return null;

    let age = date.getFullYear() - birth.getFullYear();
    const birthdayThisYear = new Date(date.getFullYear(), birth.getMonth(), birth.getDate());
    if (date < birthdayThisYear) age -= 1;
    return age;
}

export function calculateMonthlyHours(hoursPerWeek: number): number {
    if (hoursPerWeek === 38) return 164.67;
    return round2((hoursPerWeek * 52) / 12);
}

export function getPayrollVariable(variableName: string) {
    return HORECA_PAYROLL_VARIABLES.find((variable) => variable.variableName === variableName) ?? null;
}

export function getPayrollVariableNumber(variableName: string): number {
    const value = getPayrollVariable(variableName)?.value;
    const numeric = safeNumber(value);
    if (numeric == null) throw new Error(`Missing numeric payroll variable: ${variableName}`);
    return numeric;
}

export function getRuleSource(sourceId?: string | null): PayrollRuleSource | null {
    if (!sourceId) return null;
    return HORECA_RULE_SOURCES.find((source) => source.id === sourceId) ?? null;
}

export function formatSourceLabel(sourceId?: string | null, fallbackPage?: string | null): string {
    const source = getRuleSource(sourceId);
    if (!source) return "Source: not set";
    const page = fallbackPage ?? source.pageNumber;
    return `Source: ${source.documentName}, ${page === "Web page" ? "web page" : `page ${page}`}`;
}

export function getActiveHorecaJobPresets(): JobPreset[] {
    return loadHorecaJobPresets().filter((preset) => preset.isActive);
}

export function loadHorecaJobPresets(): JobPreset[] {
    if (typeof localStorage === "undefined") return DEFAULT_HORECA_JOB_PRESETS;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_HORECA_JOB_PRESETS;

    try {
        const parsed = JSON.parse(stored) as JobPreset[];
        if (!Array.isArray(parsed)) return DEFAULT_HORECA_JOB_PRESETS;
        return parsed;
    } catch {
        return DEFAULT_HORECA_JOB_PRESETS;
    }
}

export function saveHorecaJobPresets(presets: JobPreset[]): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function resetHorecaJobPresets(): JobPreset[] {
    saveHorecaJobPresets(DEFAULT_HORECA_JOB_PRESETS);
    return DEFAULT_HORECA_JOB_PRESETS;
}

export function normalizeContractType(value?: string | null): ContractType {
    if (value === "FULL_TIME" || value === "PART_TIME" || value === "ZERO_HOURS") return value;
    return "PART_TIME";
}

export function normalizePayrollPeriod(value?: string | null): PayrollPeriod {
    if (value === "MONTHLY" || value === "WEEKLY" || value === "BIWEEKLY" || value === "FOUR_WEEKLY") return value;
    return "MONTHLY";
}

export function normalizeHolidayAllowanceMode(value?: string | null): HolidayAllowanceMode {
    if (value === "PAID_EACH_PERIOD") return "PAID_EACH_PERIOD";
    return "RESERVED";
}

export function getHorecaRequiredHourlyWage(input: HorecaWageLookupInput) {
    const startDate = input.startDate ?? "";
    const age = calculateAgeOnDate(input.dateOfBirth, startDate);
    if (age == null || age < 21 || !input.functionGroup || !startDate) return null;

    return (
        HORECA_WAGE_RULES.find((rule) => {
            return (
                rule.ageGroup === "Adult" &&
                rule.functionGroup === input.functionGroup &&
                isOnOrAfter(startDate, rule.effectiveFrom) &&
                isOnOrBefore(startDate, rule.effectiveTo)
            );
        }) ?? null
    );
}

export function validateContractPayrollSettings(
    input: HorecaContractValidationInput
): HorecaContractValidationResult {
    const blockingErrors: string[] = [];
    const warnings: string[] = [];

    if (!input.caoId) warnings.push("No CAO is selected.");
    if (!input.jobPresetId) warnings.push("No job preset is selected.");
    if (!input.contractType) warnings.push("Contract type is missing.");
    if (!input.employeeDateOfBirth) warnings.push("Employee age is missing, so the wage table row cannot be confirmed.");
    if (input.loonheffingskorting == null) warnings.push("Loonheffingskorting is missing, so net wage can change.");
    if (input.pensionApplicable == null) warnings.push("Pension setting is missing.");
    if (input.isManualWageOverride) warnings.push("The wage was manually overridden.");
    if (input.sourcesOutdated) warnings.push("One or more source documents may be outdated.");

    if (input.isManualWageOverride && !input.manualWageOverrideReason?.trim()) {
        blockingErrors.push("Manual wage override reason is required.");
    }

    const wageRule = getHorecaRequiredHourlyWage({
        dateOfBirth: input.employeeDateOfBirth,
        startDate: input.startDate,
        functionGroup: input.functionGroup,
    });
    const requiredHourlyWage = wageRule?.hourlyWage ?? null;

    if (requiredHourlyWage != null && input.hourlyWage != null) {
        if (input.hourlyWage < requiredHourlyWage) {
            blockingErrors.push(
                `Gross hourly wage is below the required horeca wage table amount of \u20ac${requiredHourlyWage.toFixed(2)}.`
            );
        } else if (input.hourlyWage > requiredHourlyWage) {
            warnings.push("Gross hourly wage is above the horeca CAO wage table amount.");
        }
    }

    if (requiredHourlyWage == null && input.employeeDateOfBirth && input.functionGroup) {
        warnings.push("No official horeca wage table row is available for this age and function group yet.");
    }

    return {
        blockingErrors,
        warnings,
        requiredHourlyWage,
        requiredWageSourceId: wageRule?.sourceId ?? null,
    };
}

export function calculatePayrollCalculator(input: PayrollCalculatorInput): ExamplePayrollCalculation {
    const grossWage = round2(input.grossWage ?? (input.hourlyWage * input.monthlyHours));
    const holidayAllowanceReservation = round2(grossWage * (input.holidayAllowancePercentage / 100));
    const vacationHoursBuildUp = roundEntitlementHours(input.monthlyHours * input.vacationBuildUpPerPaidHour);
    const employeePensionDeduction = round2(grossWage * (input.employeePensionPercentage / 100));
    const netWagePaid = round2(grossWage - input.payrollTaxWithheld - employeePensionDeduction);
    const employerAwfLow = round2(grossWage * (input.employerAwfPercentage / 100));
    const employerAofLow = round2(grossWage * (input.employerAofPercentage / 100));
    const employerWhk = round2(grossWage * (input.employerWhkPercentage / 100));
    const employerWkoSurcharge = round2(grossWage * (input.employerWkoPercentage / 100));
    const employerZvw = round2(grossWage * (input.employerZvwPercentage / 100));
    const employerPension = round2(grossWage * (input.employerPensionPercentage / 100));
    const amountPayableToBelastingdienst = round2(
        input.payrollTaxWithheld + employerAwfLow + employerAofLow + employerWhk + employerWkoSurcharge + employerZvw
    );
    const amountPayableToPensionFund = round2(employeePensionDeduction + employerPension);
    const employerPayrollContributions = round2(
        employerAwfLow + employerAofLow + employerWhk + employerWkoSurcharge + employerZvw
    );
    const totalEmployerCostBeforePayrollMargin = round2(
        grossWage + holidayAllowanceReservation + employerPayrollContributions + employerPension
    );

    return {
        grossWage,
        holidayAllowanceReservation,
        vacationHoursBuildUp,
        payrollTaxWithheld: input.payrollTaxWithheld,
        employeePensionDeduction,
        netWagePaid,
        employerAwfLow,
        employerAofLow,
        employerWhk,
        employerWkoSurcharge,
        employerZvw,
        employerPension,
        amountPayableToBelastingdienst,
        amountPayableToPensionFund,
        employerPayrollContributions,
        totalEmployerCostBeforePayrollMargin,
    };
}

export function calculateExamplePayroll(): ExamplePayrollCalculation {
    const premium = (name: string) => {
        const found = HORECA_EMPLOYER_PREMIUM_RULES.find((rule) => rule.premiumName === name);
        if (!found) throw new Error(`Missing employer premium: ${name}`);
        return found.percentage;
    };

    return calculatePayrollCalculator({
        grossWage: 2422.25,
        hourlyWage: 14.71,
        monthlyHours: 164.67,
        payrollTaxWithheld: getPayrollVariableNumber("monthlyPayrollTaxWithCreditAt2425_50"),
        holidayAllowancePercentage: getPayrollVariableNumber("holidayAllowancePercentage"),
        vacationBuildUpPerPaidHour: getPayrollVariableNumber("vacationBuildUpPerPaidHour"),
        employeePensionPercentage: getPayrollVariableNumber("pensionPremiumEmployee"),
        employerPensionPercentage: getPayrollVariableNumber("pensionPremiumEmployer"),
        employerAwfPercentage: premium("AWf low"),
        employerAofPercentage: premium("Aof low"),
        employerWhkPercentage: premium("Whk sector 33 Horeca algemeen"),
        employerWkoPercentage: premium("Wko surcharge"),
        employerZvwPercentage: premium("Employer Zvw contribution"),
    });
}
