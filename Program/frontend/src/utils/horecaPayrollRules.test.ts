import { describe, expect, it } from "vitest";
import {
    calculatePayrollCalculator,
    calculateMonthlyHours,
    getActiveHorecaJobPresets,
    getHorecaRequiredHourlyWage,
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

    it("blocks contract generation when the selected wage is below the source wage table", () => {
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

        expect(result.blockingErrors).toContain(
            "Gross hourly wage is below the required horeca wage table amount of €14.71."
        );
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

    it("calculates a payroll scenario from calculator inputs", () => {
        const example = calculatePayrollCalculator({
            grossWage: 2422.25,
            hourlyWage: 14.71,
            monthlyHours: 164.67,
            payrollTaxWithheld: 160.5,
            holidayAllowancePercentage: 8,
            vacationBuildUpPerPaidHour: 0.0961,
            employeePensionPercentage: 8.4,
            employerPensionPercentage: 8.4,
            employerAwfPercentage: 2.74,
            employerAofPercentage: 6.27,
            employerWhkPercentage: 1.77,
            employerWkoPercentage: 0.5,
            employerZvwPercentage: 6.1,
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
});
