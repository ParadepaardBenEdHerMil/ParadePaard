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
        // 2024 predates the earliest registered year (2026): falls back to it
        // rather than failing, so historical recompute still produces a payslip.
        DutchPayrollTaxRates rates = DutchPayrollTaxRates.forYear(2024);
        assertEquals(2026, rates.year());
        assertFalse(DutchPayrollTaxRates.hasExactYear(2024));
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
