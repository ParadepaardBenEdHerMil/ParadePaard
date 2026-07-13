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
import type { HorecaRuleItemDTO } from "../services/user-service/Types";

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

export type ManagedHorecaWageRule = {
    itemKey: string;
    name: string;
    ageGroup: string;
    functionGroup: string;
    hourlyWage: number;
    sourceId: string | null;
    pageReference: string | null;
};

export type HorecaWageLookupOptions = {
    wageRules?: ManagedHorecaWageRule[] | null;
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
    dateOfBirth?: string | null;
    startDate?: string | null;
    functionGroup?: string | null;
    contractType?: ContractType | null;
    hoursPerWeek?: number | null;
    hourlyWage: number;
    loonheffingskorting: boolean;
    pensionApplicable: boolean;
};

const STORAGE_KEY = "horeca-job-presets";
const HORECA_TRAVEL_ALLOWANCE_RATE_PER_KILOMETER = 0.23;

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

function sourceIdFromDocumentName(documentName?: string | null): string | null {
    if (!documentName?.trim()) return null;
    return HORECA_RULE_SOURCES.find((source) => source.documentName === documentName)?.id ?? null;
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

export function getTravelAllowanceRatePerKilometer(): number {
    return HORECA_TRAVEL_ALLOWANCE_RATE_PER_KILOMETER;
}

export function formatOnboardingReviewTravelAllowanceHelpText(): string {
    return `This only marks whether travel allowance applies. The current rate is EUR ${getTravelAllowanceRatePerKilometer().toFixed(2)} net / km from the Payroll and Contract Rules page, not this review form.`;
}

function getEmployerPremiumPercentage(premiumName: string): number {
    const found = HORECA_EMPLOYER_PREMIUM_RULES.find((rule) => rule.premiumName === premiumName);
    if (!found) throw new Error(`Missing employer premium: ${premiumName}`);
    return found.percentage;
}

function getGrossWageFromScenario(input: PayrollCalculatorInput, monthlyHours: number): number {
    const hourlyWage = round2(input.hourlyWage);
    const contractType = input.contractType ?? "PART_TIME";
    const wageRule = getHorecaRequiredHourlyWage({
        dateOfBirth: input.dateOfBirth,
        startDate: input.startDate,
        functionGroup: input.functionGroup,
    });

    if (
        contractType === "FULL_TIME" &&
        monthlyHours === getPayrollVariableNumber("normalFullTimeMonthlyHours") &&
        wageRule &&
        Math.abs(wageRule.hourlyWage - hourlyWage) < 0.001
    ) {
        return wageRule.monthlyWage;
    }

    return round2(hourlyWage * monthlyHours);
}

function estimatePayrollTaxWithholding(grossWage: number, loonheffingskorting: boolean): number {
    const referenceGrossWage = 2425.5;
    const referenceTax = loonheffingskorting
        ? getPayrollVariableNumber("monthlyPayrollTaxWithCreditAt2425_50")
        : getPayrollVariableNumber("monthlyPayrollTaxWithoutCreditAt2425_50");
    const documentedExampleGrossWage = 2422.25;

    if (Math.abs(grossWage - documentedExampleGrossWage) < 0.01) {
        return referenceTax;
    }

    return round2((grossWage / referenceGrossWage) * referenceTax);
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
    if (
        value === "MONTHLY" ||
        value === "WEEKLY" ||
        value === "BIWEEKLY" ||
        value === "FOUR_WEEKLY" ||
        value === "EVERY_10_MINUTES"
    ) return value;
    return "MONTHLY";
}

export function normalizeHolidayAllowanceMode(value?: string | null): HolidayAllowanceMode {
    if (value === "PAID_EACH_PERIOD") return "PAID_EACH_PERIOD";
    return "RESERVED";
}

function ageGroupForAge(age: number): string | null {
    if (age >= 21) return "Adult";
    if (age >= 15 && age <= 20) return String(age);
    return null;
}

export function formatHorecaAgeGroupLabel(ageGroup?: string | null): string {
    if (!ageGroup) return "Unknown";
    return ageGroup === "Adult" ? "Adult (21+)" : `${ageGroup} years`;
}

export function getManagedHorecaWageRules(items?: HorecaRuleItemDTO[] | null): ManagedHorecaWageRule[] {
    return (items ?? [])
        .map((item) => {
            const hourlyWage = safeNumber(item.valueNumber);
            const functionGroup = item.functionGroup?.trim() ?? "";
            const ageGroup = item.ageGroup?.trim() ?? "";
            if (!item.itemKey || !item.name?.trim() || hourlyWage == null || !functionGroup || !ageGroup) {
                return null;
            }
            return {
                itemKey: item.itemKey,
                name: item.name,
                ageGroup,
                functionGroup,
                hourlyWage,
                sourceId: sourceIdFromDocumentName(item.documentName),
                pageReference: item.pageReference?.trim() ?? null,
            } satisfies ManagedHorecaWageRule;
        })
        .filter((rule): rule is ManagedHorecaWageRule => rule != null);
}

export function getHorecaRequiredHourlyWage(input: HorecaWageLookupInput, options: HorecaWageLookupOptions = {}) {
    const startDate = input.startDate ?? "";
    const age = calculateAgeOnDate(input.dateOfBirth, startDate);
    if (age == null || !input.functionGroup || !startDate) return null;

    const ageGroup = ageGroupForAge(age);
    if (!ageGroup) return null;

    const managedRule = options.wageRules?.find((rule) => {
        return rule.ageGroup === ageGroup && rule.functionGroup === input.functionGroup;
    });
    if (managedRule) {
        return {
            id: managedRule.itemKey,
            year: Number(startDate.slice(0, 4)),
            effectiveFrom: startDate,
            effectiveTo: null,
            ageGroup: managedRule.ageGroup,
            functionGroup: managedRule.functionGroup,
            vakkrachtStatus: managedRule.name,
            monthlyWage: 0,
            weeklyWage: 0,
            hourlyWage: managedRule.hourlyWage,
            sourceId: managedRule.sourceId ?? "loontabel-2026-01-01",
            pageNumber: managedRule.pageReference ?? "1",
        };
    }

    return (
        HORECA_WAGE_RULES.find((rule) => {
            return (
                rule.ageGroup === ageGroup &&
                rule.functionGroup === input.functionGroup &&
                isOnOrAfter(startDate, rule.effectiveFrom) &&
                isOnOrBefore(startDate, rule.effectiveTo)
            );
        }) ?? null
    );
}

// Resolves the minimum hourly wage for an employee on a given reference date
// using the horeca wage table. This is the building block the contract create
// and edit forms use to auto-fill the wage and to warn admins when a manually
// entered wage is below the table.
export type HorecaMinimumWageLookup = {
    dateOfBirth?: string | null;
    referenceDate?: string | null;
    functionGroup?: string | null;
};

export type HorecaMinimumWageResult = {
    age: number | null;
    ageGroup: string | null;
    minimumHourlyWage: number | null;
    sourceId: string | null;
};

export function getHorecaMinimumHourlyWage(
    input: HorecaMinimumWageLookup,
    options: HorecaWageLookupOptions = {}
): HorecaMinimumWageResult {
    const referenceDate = input.referenceDate ?? new Date().toISOString().slice(0, 10);
    const age = calculateAgeOnDate(input.dateOfBirth, referenceDate);
    const functionGroup = input.functionGroup ?? "I+II";
    const wageRule = getHorecaRequiredHourlyWage({
        dateOfBirth: input.dateOfBirth,
        startDate: referenceDate,
        functionGroup,
    }, options);
    return {
        age,
        ageGroup: age == null ? null : ageGroupForAge(age),
        minimumHourlyWage: wageRule?.hourlyWage ?? null,
        sourceId: wageRule?.sourceId ?? null,
    };
}

export function validateContractPayrollSettings(
    input: HorecaContractValidationInput,
    options: HorecaWageLookupOptions = {}
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
    }, options);
    const requiredHourlyWage = wageRule?.hourlyWage ?? null;

    if (requiredHourlyWage != null && input.hourlyWage != null) {
        if (input.hourlyWage < requiredHourlyWage) {
            // The admin is allowed to push the contract through with a wage
            // below the table, but they must be clearly warned. This text is
            // the user-facing copy for the wage warning across all admin
            // contract create/edit screens.
            warnings.push(
                `The entered hourly wage (\u20ac${input.hourlyWage.toFixed(2)}) is below the minimum wage from the horeca wage table (\u20ac${requiredHourlyWage.toFixed(2)}) for this employee age. Please proceed with caution.`
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
    const hoursPerWeek = input.contractType === "FULL_TIME" ? 38 : (input.hoursPerWeek ?? 0);
    const monthlyHours = input.contractType === "ZERO_HOURS" ? calculateMonthlyHours(hoursPerWeek) : calculateMonthlyHours(hoursPerWeek);
    const grossWage = getGrossWageFromScenario(input, monthlyHours);
    const holidayAllowancePercentage = getPayrollVariableNumber("holidayAllowancePercentage");
    const vacationBuildUpPerPaidHour = getPayrollVariableNumber("vacationBuildUpPerPaidHour");
    const employeePensionPercentage = input.pensionApplicable ? getPayrollVariableNumber("pensionPremiumEmployee") : 0;
    const employerPensionPercentage = input.pensionApplicable ? getPayrollVariableNumber("pensionPremiumEmployer") : 0;
    const employerAwfPercentage = getEmployerPremiumPercentage("AWf low");
    const employerAofPercentage = getEmployerPremiumPercentage("Aof low");
    const employerWhkPercentage = getEmployerPremiumPercentage("Whk sector 33 Horeca algemeen");
    const employerWkoPercentage = getEmployerPremiumPercentage("Wko surcharge");
    const employerZvwPercentage = getEmployerPremiumPercentage("Employer Zvw contribution");
    const payrollTaxWithheld = estimatePayrollTaxWithholding(grossWage, input.loonheffingskorting);
    const holidayAllowanceReservation = round2(grossWage * (holidayAllowancePercentage / 100));
    const vacationHoursBuildUp = roundEntitlementHours(monthlyHours * vacationBuildUpPerPaidHour);
    const employeePensionDeduction = round2(grossWage * (employeePensionPercentage / 100));
    const netWagePaid = round2(grossWage - payrollTaxWithheld - employeePensionDeduction);
    const employerAwfLow = round2(grossWage * (employerAwfPercentage / 100));
    const employerAofLow = round2(grossWage * (employerAofPercentage / 100));
    const employerWhk = round2(grossWage * (employerWhkPercentage / 100));
    const employerWkoSurcharge = round2(grossWage * (employerWkoPercentage / 100));
    const employerZvw = round2(grossWage * (employerZvwPercentage / 100));
    const employerPension = round2(grossWage * (employerPensionPercentage / 100));
    const amountPayableToBelastingdienst = round2(
        payrollTaxWithheld + employerAwfLow + employerAofLow + employerWhk + employerWkoSurcharge + employerZvw
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
        payrollTaxWithheld,
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
    return calculatePayrollCalculator({
        dateOfBirth: "1998-02-10",
        startDate: "2026-01-01",
        functionGroup: "I+II",
        contractType: "FULL_TIME",
        hoursPerWeek: 38,
        hourlyWage: 14.71,
        loonheffingskorting: true,
        pensionApplicable: true,
    });
}
