package com.pm.payrollservice.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PY-9: cent-exact golden masters for wage-tax (loonheffing) withholding, pinned against the
 * 2026 rate tables ({@link DutchPayrollTaxRates#forYear(int)}) which encode the Handboek
 * Loonheffingen figures. These lock the withheld amount to the exact cent across pay
 * frequencies, with/without loonheffingskorting, and on the green (AOW-age) table, so any
 * change to the brackets, credits, or period maths is caught immediately.
 *
 * <p>Values were captured from the calculator against the pinned 2026 tables; if a table is
 * updated, these expected cents must be re-derived from the new Handboek figures.
 */
class LoonheffingCalculatorGoldenMasterTest {

    private final DutchPayrollTaxRates rates = DutchPayrollTaxRates.forYear(2026);

    @Test
    void monthlyBelowAowWithLoonheffingskorting() {
        assertThat(LoonheffingCalculator.periodWageTax(new BigDecimal("3000"), 12, true, true, rates))
                .isEqualByComparingTo("388.14");
    }

    @Test
    void monthlyBelowAowWithoutLoonheffingskorting() {
        assertThat(LoonheffingCalculator.periodWageTax(new BigDecimal("3000"), 12, true, false, rates))
                .isEqualByComparingTo("1072.50");
    }

    @Test
    void loonheffingskortingLowersTheWithheldTax() {
        BigDecimal withCredit = LoonheffingCalculator.periodWageTax(new BigDecimal("3000"), 12, true, true, rates);
        BigDecimal withoutCredit = LoonheffingCalculator.periodWageTax(new BigDecimal("3000"), 12, true, false, rates);
        assertThat(withCredit).isLessThan(withoutCredit);
    }

    @Test
    void weeklyBelowAowWithLoonheffingskorting() {
        assertThat(LoonheffingCalculator.periodWageTax(new BigDecimal("700"), 52, true, true, rates))
                .isEqualByComparingTo("92.66");
    }

    @Test
    void fourWeeklyBelowAowWithLoonheffingskorting() {
        assertThat(LoonheffingCalculator.periodWageTax(new BigDecimal("2800"), 13, true, true, rates))
                .isEqualByComparingTo("370.66");
    }

    @Test
    void aowAgeGreenTableWithheldLessThanBelowAow() {
        // Above AOW age the first-bracket rate drops (no AOW premium), so at EUR 3000/month with
        // credits the withholding is nil — far below the below-AOW figure.
        BigDecimal aboveAow = LoonheffingCalculator.periodWageTax(new BigDecimal("3000"), 12, false, true, rates);
        BigDecimal belowAow = LoonheffingCalculator.periodWageTax(new BigDecimal("3000"), 12, true, true, rates);
        assertThat(aboveAow).isEqualByComparingTo("0.00");
        assertThat(aboveAow).isLessThan(belowAow);
    }

    @Test
    void periodTaxTimesPeriodsReconcilesToAnnualBracketTaxWithinRounding() {
        // 12 x monthly (no credit) should sum back to the annual bracket tax to within a cent of rounding.
        BigDecimal monthly = LoonheffingCalculator.periodWageTax(new BigDecimal("4166.67"), 12, true, false, rates);
        BigDecimal annualFromPeriods = monthly.multiply(BigDecimal.valueOf(12));
        BigDecimal annualDirect = LoonheffingCalculator
                .annualBracketTax(new BigDecimal("50000.04"), true, rates)
                .setScale(2, java.math.RoundingMode.HALF_UP);
        assertThat(annualFromPeriods.subtract(annualDirect).abs())
                .isLessThanOrEqualTo(new BigDecimal("0.12")); // <= 1 cent x 12 periods
    }
}
