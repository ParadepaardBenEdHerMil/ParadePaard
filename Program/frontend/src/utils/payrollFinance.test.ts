import { describe, expect, it } from "vitest";
import {
    calculateFinanceSummary,
    calculateShiftFinanceRecord,
    resolveBillingRate,
    type ShiftFinanceCalculationInput,
} from "./payrollFinance";

const baseInput: ShiftFinanceCalculationInput = {
    id: "finance-1",
    shiftId: "shift-1",
    employeeId: "employee-1",
    clientId: "client-1",
    jobPresetId: "bar-employee",
    payrollRunId: "payroll-2026-01",
    workedHours: 6,
    employeeHourlyWage: 16.5,
    employeePayrollTaxWithheld: 18,
    pensionApplicable: true,
    clientBillingRatePerHour: 29.5,
    otherEmployerCosts: 0,
    financeSettings: {
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
    },
    createdAt: "2026-01-18T10:00:00",
    updatedAt: "2026-01-18T10:00:00",
};

describe("payrollFinance", () => {
    it("calculates client revenue, employer cost, cash flow payments, and margin for one employee shift", () => {
        const record = calculateShiftFinanceRecord(baseInput);

        expect(record.employeeGrossWage).toBe(99);
        expect(record.clientRevenue).toBe(177);
        expect(record.holidayAllowanceCost).toBe(7.92);
        expect(record.employeePensionDeduction).toBe(8.32);
        expect(record.employerPension).toBe(8.32);
        expect(record.totalPayableToBelastingdienst).toBe(35.21);
        expect(record.totalPayableToPensionFund).toBe(16.64);
        expect(record.marginBeforeOverhead).toBe(24.57);
        expect(record.marginPercentage).toBe(13.88);
        expect(record.marginStatus).toBe("low_margin");
    });

    it("marks missing billing rate rows as incomplete and excludes client revenue", () => {
        const record = calculateShiftFinanceRecord({
            ...baseInput,
            clientBillingRatePerHour: null,
        });

        expect(record.clientRevenue).toBe(0);
        expect(record.marginStatus).toBe("missing_rate");
        expect(record.warnings).toContain("Billing rate is missing.");
    });

    it("resolves custom, job preset, then client billing rates in priority order", () => {
        expect(
            resolveBillingRate({
                customShiftRate: 32,
                jobPresetDefaultRate: 29,
                clientDefaultRate: 27,
            })
        ).toEqual({ rate: 32, source: "Custom shift rate" });

        expect(resolveBillingRate({ jobPresetDefaultRate: 29, clientDefaultRate: 27 })).toEqual({
            rate: 29,
            source: "Job preset default",
        });

        expect(resolveBillingRate({ clientDefaultRate: 27 })).toEqual({
            rate: 27,
            source: "Client default",
        });
    });

    it("summarizes finance totals and risk counts across employee shift rows", () => {
        const records = [
            calculateShiftFinanceRecord(baseInput),
            calculateShiftFinanceRecord({
                ...baseInput,
                id: "finance-2",
                shiftId: "shift-2",
                clientBillingRatePerHour: null,
            }),
            calculateShiftFinanceRecord({
                ...baseInput,
                id: "finance-3",
                shiftId: "shift-3",
                clientBillingRatePerHour: 18,
            }),
        ];

        const summary = calculateFinanceSummary(records);

        expect(summary.totalClientRevenue).toBe(285);
        expect(summary.totalEmployeeGrossWages).toBe(297);
        expect(summary.missingBillingRateCount).toBe(1);
        expect(summary.negativeMarginCount).toBe(1);
        expect(summary.totalPayableToBelastingdienst).toBe(105.63);
    });
});
