package com.pm.payrollservice.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Leave → payroll pay model: holiday/other at full wage, sick at a configurable percentage,
 * unpaid paid nothing. Cent-exact.
 */
class LeavePayCalculatorTest {

    private static final BigDecimal WAGE = new BigDecimal("20.00");

    @Test
    void holidayHoursPaidAtFullWage() {
        LeavePayCalculator.LeavePay pay = LeavePayCalculator.compute(
                new BigDecimal("16.00"), BigDecimal.ZERO, BigDecimal.ZERO, WAGE, new BigDecimal("100"));

        assertThat(pay.paidLeavePay()).isEqualByComparingTo("320.00");
        assertThat(pay.totalLeavePay()).isEqualByComparingTo("320.00");
    }

    @Test
    void sickHoursPaidAtConfiguredPercentage() {
        // 8h at 70% of EUR 20 = 8 * 14 = 112.00
        LeavePayCalculator.LeavePay pay = LeavePayCalculator.compute(
                BigDecimal.ZERO, new BigDecimal("8.00"), BigDecimal.ZERO, WAGE, new BigDecimal("70"));

        assertThat(pay.sickLeavePay()).isEqualByComparingTo("112.00");
        assertThat(pay.paidLeavePay()).isEqualByComparingTo("0.00");
        assertThat(pay.totalLeavePay()).isEqualByComparingTo("112.00");
    }

    @Test
    void sickAtFullPercentageEqualsFullWage() {
        LeavePayCalculator.LeavePay pay = LeavePayCalculator.compute(
                BigDecimal.ZERO, new BigDecimal("10.00"), BigDecimal.ZERO, WAGE, new BigDecimal("100"));

        assertThat(pay.sickLeavePay()).isEqualByComparingTo("200.00");
    }

    @Test
    void unpaidLeaveContributesNoPayButIsReported() {
        LeavePayCalculator.LeavePay pay = LeavePayCalculator.compute(
                BigDecimal.ZERO, BigDecimal.ZERO, new BigDecimal("8.00"), WAGE, new BigDecimal("100"));

        assertThat(pay.unpaidLeaveHours()).isEqualByComparingTo("8.00");
        assertThat(pay.totalLeavePay()).isEqualByComparingTo("0.00");
    }

    @Test
    void mixedLeaveTotalsCorrectly() {
        // holiday 16h -> 320; sick 8h @ 70% -> 112; unpaid 4h -> 0. Total 432.00
        LeavePayCalculator.LeavePay pay = LeavePayCalculator.compute(
                new BigDecimal("16.00"), new BigDecimal("8.00"), new BigDecimal("4.00"), WAGE, new BigDecimal("70"));

        assertThat(pay.totalLeavePay()).isEqualByComparingTo("432.00");
    }

    @Test
    void nullsAreTreatedAsZero() {
        LeavePayCalculator.LeavePay pay = LeavePayCalculator.compute(null, null, null, null, null);

        assertThat(pay.totalLeavePay()).isEqualByComparingTo("0.00");
    }

    @Test
    void sickPercentageWithFractionalCentRoundsHalfUp() {
        // 3h at 70% of 14.71 = 3 * 10.297 = 30.891 -> 30.89
        LeavePayCalculator.LeavePay pay = LeavePayCalculator.compute(
                BigDecimal.ZERO, new BigDecimal("3"), BigDecimal.ZERO, new BigDecimal("14.71"), new BigDecimal("70"));

        assertThat(pay.sickLeavePay()).isEqualByComparingTo("30.89");
    }
}
