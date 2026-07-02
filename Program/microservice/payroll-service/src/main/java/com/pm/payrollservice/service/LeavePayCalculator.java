package com.pm.payrollservice.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Turns approved-leave hours into pay, per the recommended model where each leave type keeps
 * its own treatment rather than being folded into worked hours:
 * <ul>
 *   <li>holiday / other paid leave — paid at the full hourly wage;</li>
 *   <li>sick leave — paid at a configurable percentage of the wage (Dutch loondoorbetaling bij
 *       ziekte is commonly reduced; the exact figure comes from the applicable CAO);</li>
 *   <li>unpaid leave — no pay (reported for the payslip, contributes 0).</li>
 * </ul>
 *
 * <p>Keeping sick and unpaid separate avoids over-paying sick hours at 100% and avoids paying
 * unpaid hours at all — both of which would happen if leave were merged into normal hours.
 */
public final class LeavePayCalculator {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private LeavePayCalculator() {
    }

    public static LeavePay compute(BigDecimal paidLeaveHours,
                                   BigDecimal sickLeaveHours,
                                   BigDecimal unpaidLeaveHours,
                                   BigDecimal hourlyWage,
                                   BigDecimal sickPayPercentage) {
        BigDecimal wage = nz(hourlyWage);
        BigDecimal paidHours = nz(paidLeaveHours);
        BigDecimal sickHours = nz(sickLeaveHours);
        BigDecimal unpaidHours = nz(unpaidLeaveHours);

        BigDecimal paidLeavePay = money(paidHours.multiply(wage));

        BigDecimal sickRate = wage.multiply(nz(sickPayPercentage))
                .divide(HUNDRED, 10, RoundingMode.HALF_UP);
        BigDecimal sickLeavePay = money(sickHours.multiply(sickRate));

        return new LeavePay(
                paidHours, paidLeavePay,
                sickHours, sickLeavePay,
                unpaidHours,
                paidLeavePay.add(sickLeavePay));
    }

    private static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    /** Leave pay broken out by type for the payslip; {@code totalLeavePay} adds to gross. */
    public record LeavePay(
            BigDecimal paidLeaveHours,
            BigDecimal paidLeavePay,
            BigDecimal sickLeaveHours,
            BigDecimal sickLeavePay,
            BigDecimal unpaidLeaveHours,
            BigDecimal totalLeavePay) {
    }
}
