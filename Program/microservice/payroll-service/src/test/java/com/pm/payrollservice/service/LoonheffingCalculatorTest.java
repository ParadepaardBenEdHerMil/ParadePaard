package com.pm.payrollservice.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LoonheffingCalculatorTest {

    private final DutchPayrollTaxRates rates = DutchPayrollTaxRates.forYear(2026);

    @Test
    void monthlyWageTaxMatchesBelastingdienstTableExample() {
        // Handboek/witte maandtabel anchor: table wage EUR 2.425,50, below AOW.
        // The bracket-formula result is within table-rounding tolerance of the
        // official table values (160,50 with credit / 867,08 without).
        BigDecimal tableWage = new BigDecimal("2425.50");

        BigDecimal withCredit = LoonheffingCalculator.periodWageTax(tableWage, 12, true, true, rates);
        BigDecimal withoutCredit = LoonheffingCalculator.periodWageTax(tableWage, 12, true, false, rates);

        assertEquals("160.57", withCredit.toPlainString());
        assertEquals("867.12", withoutCredit.toPlainString());
        assertTrue(withCredit.compareTo(withoutCredit) < 0, "loonheffingskorting must lower the tax");
    }

    @Test
    void zeroWageYieldsZeroTaxAndNeverNegative() {
        assertEquals("0.00", LoonheffingCalculator.periodWageTax(BigDecimal.ZERO, 52, true, true, rates).toPlainString());
        assertEquals("0.00", LoonheffingCalculator.periodWageTax(new BigDecimal("-50"), 12, true, true, rates).toPlainString());
        // A small wage where credits exceed the gross tax still floors at zero.
        assertEquals("0.00", LoonheffingCalculator.periodWageTax(new BigDecimal("100"), 52, true, true, rates).toPlainString());
    }

    @Test
    void annualBracketTaxAddsAcrossSchijven() {
        // First bracket only: 10.000 * 35,75% = 3.575,00
        assertEquals(0, LoonheffingCalculator.annualBracketTax(new BigDecimal("10000"), true, rates)
                .compareTo(new BigDecimal("3575.0000000000")));
        // Spanning bracket 1 and 2a: 38.883 * 35,75% + (50.000 - 38.883) * 37,56%
        BigDecimal expected = new BigDecimal("38883").multiply(new BigDecimal("0.3575"))
                .add(new BigDecimal("11117").multiply(new BigDecimal("0.3756")));
        assertEquals(0, LoonheffingCalculator.annualBracketTax(new BigDecimal("50000"), true, rates)
                .compareTo(expected));
    }

    @Test
    void algemeneHeffingskortingIsFullBelowPhaseOutThenDecreases() {
        assertEquals(0, LoonheffingCalculator.algemeneHeffingskorting(new BigDecimal("20000"), true, rates)
                .compareTo(new BigDecimal("3115")));
        BigDecimal mid = LoonheffingCalculator.algemeneHeffingskorting(new BigDecimal("50000"), true, rates);
        assertTrue(mid.compareTo(new BigDecimal("3115")) < 0 && mid.signum() > 0);
        assertEquals(0, LoonheffingCalculator.algemeneHeffingskorting(new BigDecimal("90000"), true, rates).signum());
    }

    @Test
    void arbeidskortingPeaksThenPhasesOutToZero() {
        BigDecimal atPeak = LoonheffingCalculator.arbeidskorting(new BigDecimal("45592"), true, rates);
        // Peak is the configured maximum (EUR 5.685) within rounding.
        assertTrue(atPeak.compareTo(new BigDecimal("5680")) > 0 && atPeak.compareTo(new BigDecimal("5686")) <= 0);
        assertEquals(0, LoonheffingCalculator.arbeidskorting(new BigDecimal("140000"), true, rates).signum());
    }

    @Test
    void zvwEmployeeContributionIsCappedAtPeriodMaximum() {
        // Below the monthly maximumbijdrageloon: 4.000 * 4,85% = 194,00
        assertEquals("194.00", LoonheffingCalculator.periodZvwEmployee(new BigDecimal("4000"), 12, rates).toPlainString());
        // Above the monthly cap (EUR 6.617,41): contribution is on the cap, not the wage.
        BigDecimal capped = LoonheffingCalculator.periodZvwEmployee(new BigDecimal("9000"), 12, rates);
        BigDecimal atCap = LoonheffingCalculator.periodZvwEmployee(new BigDecimal("6617.41"), 12, rates);
        assertEquals(atCap.toPlainString(), capped.toPlainString());
    }

    @Test
    void periodsPerYearMapsKnownFrequencies() {
        assertEquals(52, LoonheffingCalculator.periodsPerYear("WEEKLY"));
        assertEquals(12, LoonheffingCalculator.periodsPerYear("MONTHLY"));
        assertEquals(13, LoonheffingCalculator.periodsPerYear("FOUR_WEEKLY"));
        assertEquals(26, LoonheffingCalculator.periodsPerYear("BIWEEKLY"));
        assertEquals(52, LoonheffingCalculator.periodsPerYear(null));
        assertEquals(52, LoonheffingCalculator.periodsPerYear("EVERY_10_MINUTES"));
    }

    @Test
    void aowAgeDetection() {
        LocalDate pay = LocalDate.parse("2026-06-01");
        assertTrue(LoonheffingCalculator.isBelowAowAge(LocalDate.parse("1990-01-01"), pay, rates));
        assertFalse(LoonheffingCalculator.isBelowAowAge(LocalDate.parse("1950-01-01"), pay, rates));
        assertTrue(LoonheffingCalculator.isBelowAowAge(null, pay, rates), "missing DOB defaults to below AOW");
    }
}
