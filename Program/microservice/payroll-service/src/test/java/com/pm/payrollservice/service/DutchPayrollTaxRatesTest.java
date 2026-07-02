package com.pm.payrollservice.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DutchPayrollTaxRatesTest {

    @Test
    void verifiedYearReturnsItsOwnFigures() {
        DutchPayrollTaxRates rates = DutchPayrollTaxRates.forYear(2026);
        assertEquals(2026, rates.year());
        assertTrue(DutchPayrollTaxRates.hasExactYear(2026));
        assertTrue(DutchPayrollTaxRates.knownYears().contains(2026));
    }

    @Test
    void unknownFutureYearFallsBackToLatestKnownYear() {
        // No verified set for 2027 yet: floor of 2027 is 2026.
        DutchPayrollTaxRates rates = DutchPayrollTaxRates.forYear(2027);
        assertEquals(2026, rates.year());
        assertFalse(DutchPayrollTaxRates.hasExactYear(2027));
    }

    @Test
    void yearBeforeAllKnownDataFallsBackToEarliestKnownYear() {
        // 2023 predates the earliest registered year (2024): falls back to it
        // rather than failing, so historical recompute still produces a payslip.
        DutchPayrollTaxRates rates = DutchPayrollTaxRates.forYear(2023);
        assertEquals(2024, rates.year());
        assertFalse(DutchPayrollTaxRates.hasExactYear(2023));
    }

    @Test
    void sameInstanceReturnedForRepeatedExactLookups() {
        assertSame(DutchPayrollTaxRates.forYear(2026), DutchPayrollTaxRates.forYear(2026));
    }

    @Test
    void figuresFor2026MatchTheHandboekBijlage1() {
        DutchPayrollTaxRates r = DutchPayrollTaxRates.forYear(2026);

        var below = r.brackets(true);
        assertEquals(3, below.size());
        assertBracket(below.get(0), "0", "38883", "35.75");
        assertBracket(below.get(1), "38883", "78426", "37.56");
        assertBracket(below.get(2), "78426", null, "49.50");

        var above = r.brackets(false);
        assertEquals(3, above.size());
        assertBracket(above.get(0), "0", "38883", "17.85");
        assertBracket(above.get(1), "38883", "78426", "37.56");
        assertBracket(above.get(2), "78426", null, "49.50");

        var ahk = r.algemeneHeffingskorting(true);
        assertEquals(0, new BigDecimal("3115").compareTo(ahk.maxAmount()));
        assertEquals(0, new BigDecimal("29736").compareTo(ahk.phaseOutStart()));
        assertEquals(0, new BigDecimal("6.398").compareTo(ahk.phaseOutRatePercent()));
        assertEquals(0, new BigDecimal("78426").compareTo(ahk.phaseOutEnd()));

        var ak = r.arbeidskorting(true);
        assertEquals(3, ak.buildUpTiers().size());
        assertTier(ak.buildUpTiers().get(0), "0", "11965", "8.324");
        assertTier(ak.buildUpTiers().get(1), "11965", "25845", "31.009");
        assertTier(ak.buildUpTiers().get(2), "25845", "45592", "1.950");
        assertEquals(0, new BigDecimal("5685").compareTo(ak.maxAmount()));
        assertEquals(0, new BigDecimal("45592").compareTo(ak.phaseOutStart()));
        assertEquals(0, new BigDecimal("6.510").compareTo(ak.phaseOutRatePercent()));
        assertEquals(0, new BigDecimal("132920").compareTo(ak.phaseOutEnd()));

        assertEquals(0, new BigDecimal("4.85").compareTo(r.zvwEmployeeRatePercent()));
        assertEquals(0, new BigDecimal("6.10").compareTo(r.employerZvwRatePercent()));
        assertEquals(0, new BigDecimal("79409.00").compareTo(r.annualMaxContributionWage()));
        assertEquals(67, r.aowAgeYears());
    }

    @Test
    void figuresFor2025MatchTheHandboekAndRatesTables() {
        DutchPayrollTaxRates r = DutchPayrollTaxRates.forYear(2025);

        var below = r.brackets(true);
        assertEquals(3, below.size());
        assertBracket(below.get(0), "0", "38441", "35.82");
        assertBracket(below.get(1), "38441", "76817", "37.48");
        assertBracket(below.get(2), "76817", null, "49.50");

        var above = r.brackets(false);
        assertEquals(3, above.size());
        assertBracket(above.get(0), "0", "38441", "17.92");
        assertBracket(above.get(1), "38441", "76817", "37.48");
        assertBracket(above.get(2), "76817", null, "49.50");

        var ahk = r.algemeneHeffingskorting(true);
        assertEquals(0, new BigDecimal("3068").compareTo(ahk.maxAmount()));
        assertEquals(0, new BigDecimal("28406").compareTo(ahk.phaseOutStart()));
        assertEquals(0, new BigDecimal("6.337").compareTo(ahk.phaseOutRatePercent()));
        assertEquals(0, new BigDecimal("76817").compareTo(ahk.phaseOutEnd()));

        var ak = r.arbeidskorting(true);
        assertEquals(3, ak.buildUpTiers().size());
        assertTier(ak.buildUpTiers().get(0), "0", "12169", "8.053");
        assertTier(ak.buildUpTiers().get(1), "12169", "26288", "30.030");
        assertTier(ak.buildUpTiers().get(2), "26288", "43071", "2.258");
        assertEquals(0, new BigDecimal("5599").compareTo(ak.maxAmount()));
        assertEquals(0, new BigDecimal("43071").compareTo(ak.phaseOutStart()));
        assertEquals(0, new BigDecimal("6.510").compareTo(ak.phaseOutRatePercent()));
        assertEquals(0, new BigDecimal("129078").compareTo(ak.phaseOutEnd()));

        assertEquals(0, new BigDecimal("5.26").compareTo(r.zvwEmployeeRatePercent()));
        assertEquals(0, new BigDecimal("6.51").compareTo(r.employerZvwRatePercent()));
        assertEquals(0, new BigDecimal("10.93").compareTo(r.employerInsurancePremiumPercent()));
        assertEquals(0, new BigDecimal("75864.00").compareTo(r.annualMaxContributionWage()));
        assertEquals(67, r.aowAgeYears());
        assertEquals(0, new BigDecimal("8.40").compareTo(r.defaultPensionEmployeeRatePercent()));
        assertTrue(DutchPayrollTaxRates.hasExactYear(2025));
    }

    @Test
    void figuresFor2024MatchTheHandboekAndRatesTables() {
        DutchPayrollTaxRates r = DutchPayrollTaxRates.forYear(2024);

        var below = r.brackets(true);
        assertEquals(3, below.size());
        assertBracket(below.get(0), "0", "38098", "36.97");
        assertBracket(below.get(1), "38098", "75518", "36.97");
        assertBracket(below.get(2), "75518", null, "49.50");

        var above = r.brackets(false);
        assertEquals(3, above.size());
        assertBracket(above.get(0), "0", "38098", "19.07");
        assertBracket(above.get(1), "38098", "75518", "36.97");
        assertBracket(above.get(2), "75518", null, "49.50");

        var ahk = r.algemeneHeffingskorting(true);
        assertEquals(0, new BigDecimal("3362").compareTo(ahk.maxAmount()));
        assertEquals(0, new BigDecimal("24812").compareTo(ahk.phaseOutStart()));
        assertEquals(0, new BigDecimal("6.630").compareTo(ahk.phaseOutRatePercent()));
        assertEquals(0, new BigDecimal("75518").compareTo(ahk.phaseOutEnd()));

        var ak = r.arbeidskorting(true);
        assertEquals(3, ak.buildUpTiers().size());
        assertTier(ak.buildUpTiers().get(0), "0", "11490", "8.425");
        assertTier(ak.buildUpTiers().get(1), "11490", "24820", "31.433");
        assertTier(ak.buildUpTiers().get(2), "24820", "39957", "2.471");
        assertEquals(0, new BigDecimal("5532").compareTo(ak.maxAmount()));
        assertEquals(0, new BigDecimal("39957").compareTo(ak.phaseOutStart()));
        assertEquals(0, new BigDecimal("6.510").compareTo(ak.phaseOutRatePercent()));
        assertEquals(0, new BigDecimal("124934").compareTo(ak.phaseOutEnd()));

        assertEquals(0, new BigDecimal("5.32").compareTo(r.zvwEmployeeRatePercent()));
        assertEquals(0, new BigDecimal("6.57").compareTo(r.employerZvwRatePercent()));
        assertEquals(0, new BigDecimal("10.50").compareTo(r.employerInsurancePremiumPercent()));
        assertEquals(0, new BigDecimal("71628.00").compareTo(r.annualMaxContributionWage()));
        assertEquals(67, r.aowAgeYears());
        assertEquals(0, new BigDecimal("8.40").compareTo(r.defaultPensionEmployeeRatePercent()));
        assertTrue(DutchPayrollTaxRates.hasExactYear(2024));
    }

    private static void assertBracket(DutchPayrollTaxRates.Bracket b, String from, String upTo, String rate) {
        assertEquals(0, new BigDecimal(from).compareTo(b.from()));
        if (upTo == null) {
            assertNull(b.upTo());
        } else {
            assertEquals(0, new BigDecimal(upTo).compareTo(b.upTo()));
        }
        assertEquals(0, new BigDecimal(rate).compareTo(b.ratePercent()));
    }

    private static void assertTier(DutchPayrollTaxRates.ArbeidskortingTier t, String from, String upTo, String rate) {
        assertEquals(0, new BigDecimal(from).compareTo(t.from()));
        assertEquals(0, new BigDecimal(upTo).compareTo(t.upTo()));
        assertEquals(0, new BigDecimal(rate).compareTo(t.ratePercent()));
    }
}
