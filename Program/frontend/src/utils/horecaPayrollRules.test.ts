import { describe, expect, it } from "vitest";
import {
    calculateAgeOnDate,
    calculatePayrollCalculator,
    calculateMonthlyHours,
    formatOnboardingReviewTravelAllowanceHelpText,
    getManagedHorecaWageRules,
    getActiveHorecaJobPresets,
    getHorecaMinimumHourlyWage,
    getHorecaRequiredHourlyWage,
    getTravelAllowanceRatePerKilometer,
    validateContractPayrollSettings,
} from "./horecaPayrollRules";

describe("horecaPayrollRules", () => {
    it("exposes active horeca job presets with source-backed default values", () => {
        const presets = getActiveHorecaJobPresets();

        expect(presets.map((preset) => preset.presetName)).toContain("Bar employee");
        expect(presets[0]).toMatchObject({
            sector: "horeca",
            functionGroup: "I+II",
            defaultPayrollPeriod: "MONTHLY",
            pensionApplicable: true,
            holidayAllowanceMode: "RESERVED",
        });
    });

    it("uses 164.67 monthly hours for the 38 hour full-time horeca standard", () => {
        expect(calculateMonthlyHours(38)).toBe(164.67);
        expect(calculateMonthlyHours(24)).toBe(104);
    });

    it("exposes the shared horeca travel allowance rate per kilometer", () => {
        expect(getTravelAllowanceRatePerKilometer()).toBe(0.23);
    });

    it("formats onboarding review travel allowance help text with the shared rate", () => {
        expect(formatOnboardingReviewTravelAllowanceHelpText()).toBe(
            "This only marks whether travel allowance applies. The current rate is EUR 0.23 net / km from the Payroll and Contract Rules page, not this review form."
        );
    });

    it("finds the adult function group I plus II wage from the 2026 horeca wage table", () => {
        const wage = getHorecaRequiredHourlyWage({
            dateOfBirth: "1998-02-10",
            startDate: "2026-01-01",
            functionGroup: "I+II",
        });

        expect(wage?.hourlyWage).toBe(14.71);
        expect(wage?.monthlyWage).toBe(2422.25);
        expect(wage?.sourceId).toBe("loontabel-2026-01-01");
    });

    it("warns but does not block when the selected wage is below the source wage table", () => {
        const result = validateContractPayrollSettings({
            employeeDateOfBirth: "1998-02-10",
            startDate: "2026-01-01",
            caoId: "horeca-cao-2025-2026",
            jobPresetId: "bar-employee",
            contractType: "FULL_TIME",
            functionGroup: "I+II",
            hourlyWage: 14,
            loonheffingskorting: true,
            pensionApplicable: true,
            isManualWageOverride: true,
            manualWageOverrideReason: "Testing a low value",
        });

        expect(result.warnings).toContain(
            "The entered hourly wage (€14.00) is below the minimum wage from the horeca wage table (€14.71) for this employee age. Please proceed with caution."
        );
        expect(result.blockingErrors.some((message) => message.includes("below the"))).toBe(false);
    });

    it("uses the actual birthday, not just the year, to determine age", () => {
        // Born 2008-06-15: still 17 on 2026-06-14, becomes 18 on 2026-06-15.
        expect(calculateAgeOnDate("2008-06-15", "2026-06-14")).toBe(17);
        expect(calculateAgeOnDate("2008-06-15", "2026-06-15")).toBe(18);
    });

    it("looks up the minimum wage for ages 15 through 21+ from the 2026 horeca table", () => {
        const cases: Array<{ dob: string; expectedAge: number; expectedWage: number }> = [
            { dob: "2010-12-31", expectedAge: 15, expectedWage: 5.15 },
            { dob: "2009-12-31", expectedAge: 16, expectedWage: 6.62 },
            { dob: "2008-12-31", expectedAge: 17, expectedWage: 8.09 },
            { dob: "2007-12-31", expectedAge: 18, expectedWage: 9.56 },
            { dob: "2006-12-31", expectedAge: 19, expectedWage: 11.03 },
            { dob: "2005-12-31", expectedAge: 20, expectedWage: 12.5 },
            { dob: "2004-12-31", expectedAge: 21, expectedWage: 14.71 },
        ];
        for (const { dob, expectedAge, expectedWage } of cases) {
            const lookup = getHorecaMinimumHourlyWage({
                dateOfBirth: dob,
                referenceDate: "2026-01-01",
                functionGroup: "I+II",
            });
            expect(lookup.age).toBe(expectedAge);
            expect(lookup.minimumHourlyWage).toBe(expectedWage);
        }
    });

    it("returns no minimum when the employee is younger than 15", () => {
        const lookup = getHorecaMinimumHourlyWage({
            dateOfBirth: "2015-01-01",
            referenceDate: "2026-01-01",
            functionGroup: "I+II",
        });
        expect(lookup.minimumHourlyWage).toBeNull();
    });

    it("can resolve the minimum wage from backend-managed wage rule items", () => {
        const managedRules = getManagedHorecaWageRules([
            {
                itemKey: "adultFunctionGroupI_IIHourlyWage",
                name: "Adult function group I+II hourly wage",
                valueNumber: 14.71,
                valueType: "NUMBER",
                functionGroup: "I+II",
                ageGroup: "Adult",
                documentName: "Loontabel per 1 januari 2026",
                pageReference: "1",
            },
            {
                itemKey: "age18FunctionGroupI_IIHourlyWage",
                name: "Age 18 function group I+II hourly wage",
                valueNumber: 9.56,
                valueType: "NUMBER",
                functionGroup: "I+II",
                ageGroup: "18",
                documentName: "Loontabel per 1 januari 2026",
                pageReference: "1",
            },
        ]);

        const lookup = getHorecaMinimumHourlyWage(
            {
                dateOfBirth: "2007-12-31",
                referenceDate: "2026-01-01",
                functionGroup: "I+II",
            },
            { wageRules: managedRules }
        );

        expect(lookup.ageGroup).toBe("18");
        expect(lookup.minimumHourlyWage).toBe(9.56);
        expect(lookup.sourceId).toBe("loontabel-2026-01-01");
    });

    it("requires a reason when the admin manually overrides the wage", () => {
        const result = validateContractPayrollSettings({
            employeeDateOfBirth: "1998-02-10",
            startDate: "2026-01-01",
            caoId: "horeca-cao-2025-2026",
            jobPresetId: "bar-employee",
            contractType: "FULL_TIME",
            functionGroup: "I+II",
            hourlyWage: 15,
            loonheffingskorting: true,
            pensionApplicable: true,
            isManualWageOverride: true,
            manualWageOverrideReason: "",
        });

        expect(result.blockingErrors).toContain("Manual wage override reason is required.");
        expect(result.warnings).toContain("Gross hourly wage is above the horeca CAO wage table amount.");
    });

    it("calculates a payroll scenario from high-level calculator inputs", () => {
        const example = calculatePayrollCalculator({
            dateOfBirth: "1998-02-10",
            startDate: "2026-01-01",
            functionGroup: "I+II",
            contractType: "FULL_TIME",
            hoursPerWeek: 38,
            hourlyWage: 14.71,
            loonheffingskorting: true,
            pensionApplicable: true,
        });

        expect(example.grossWage).toBe(2422.25);
        expect(example.holidayAllowanceReservation).toBe(193.78);
        expect(example.vacationHoursBuildUp).toBe(15.83);
        expect(example.payrollTaxWithheld).toBe(160.5);
        expect(example.employeePensionDeduction).toBe(203.47);
        expect(example.netWagePaid).toBe(2058.28);
        expect(example.amountPayableToBelastingdienst).toBe(581.49);
        expect(example.amountPayableToPensionFund).toBe(406.94);
        expect(example.totalEmployerCostBeforePayrollMargin).toBe(3240.49);
    });

    it("lets wage change while keeping deductions source-driven", () => {
        const result = calculatePayrollCalculator({
            dateOfBirth: "1998-02-10",
            startDate: "2026-01-01",
            functionGroup: "I+II",
            contractType: "PART_TIME",
            hoursPerWeek: 24,
            hourlyWage: 15.5,
            loonheffingskorting: false,
            pensionApplicable: false,
        });

        expect(result.grossWage).toBe(1612);
        expect(result.employeePensionDeduction).toBe(0);
        expect(result.employerPension).toBe(0);
        expect(result.payrollTaxWithheld).toBeGreaterThan(0);
        expect(result.netWagePaid).toBeLessThan(result.grossWage);
        expect(result.amountPayableToBelastingdienst).toBeGreaterThan(result.payrollTaxWithheld);
    });
});
