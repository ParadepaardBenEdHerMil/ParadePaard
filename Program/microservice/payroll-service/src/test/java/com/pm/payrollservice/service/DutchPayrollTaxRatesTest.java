package com.pm.payrollservice.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
}
