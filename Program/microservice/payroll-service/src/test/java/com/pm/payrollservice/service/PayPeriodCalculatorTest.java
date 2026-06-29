package com.pm.payrollservice.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PY-7b: period-boundary maths for every supported pay frequency.
 *
 * <p>Off-by-a-day period bounds mis-assign hours and double/skip pay, so each frequency's
 * start/end/key is pinned to an independent reference vector (from the checklist), including
 * the cases most likely to break: the ISO week-based-year boundary (a Jan date that belongs
 * to the previous year's W53), leap-year February, and both biweekly anchor parities.
 */
class PayPeriodCalculatorTest {
    private final PayPeriodCalculator calculator = new PayPeriodCalculator();

    @ParameterizedTest(name = "{0} anchored at {1} -> {2}..{3} key {4}")
    @CsvSource({
            // frequency, anchor, expectedStart, expectedEnd, expectedKey
            "WEEKLY,   2026-01-01, 2025-12-29, 2026-01-04, WEEKLY:2026-W1",   // year-start, W1 spans Dec
            "WEEKLY,   2026-06-17, 2026-06-15, 2026-06-21, WEEKLY:2026-W25",  // mid-year
            "WEEKLY,   2027-01-01, 2026-12-28, 2027-01-03, WEEKLY:2026-W53",  // belongs to prev week-based-year
            "WEEKLY,   2026-05-12, 2026-05-11, 2026-05-17, WEEKLY:2026-W20",
            "BIWEEKLY, 2026-01-14, 2026-01-12, 2026-01-25, BIWEEKLY:2026-01-12:2026-01-25", // odd ISO week
            "BIWEEKLY, 2026-01-07, 2025-12-29, 2026-01-11, BIWEEKLY:2025-12-29:2026-01-11", // even ISO week
            "MONTHLY,  2026-01-31, 2026-01-01, 2026-01-31, MONTHLY:2026-01",
            "MONTHLY,  2026-05-12, 2026-05-01, 2026-05-31, MONTHLY:2026-05",
            "MONTHLY,  2028-02-15, 2028-02-01, 2028-02-29, MONTHLY:2028-02",  // leap February
            "DAILY,    2026-01-15, 2026-01-15, 2026-01-15, DAILY:2026-01-15",
    })
    void periodFor_matchesReferenceVector(String frequency, String anchor,
                                          String expectedStart, String expectedEnd, String expectedKey) {
        PayPeriod period = calculator.periodFor(frequency, LocalDate.parse(anchor));

        assertThat(period.start()).isEqualTo(LocalDate.parse(expectedStart));
        assertThat(period.end()).isEqualTo(LocalDate.parse(expectedEnd));
        assertThat(period.key()).isEqualTo(expectedKey);
    }

    @Test
    void blankOrNullFrequency_defaultsToWeekly() {
        LocalDate anchor = LocalDate.of(2026, 5, 12);

        assertThat(calculator.periodFor(null, anchor).key()).isEqualTo("WEEKLY:2026-W20");
        assertThat(calculator.periodFor("  ", anchor).key()).isEqualTo("WEEKLY:2026-W20");
    }

    @Test
    void frequencyIsCaseInsensitiveAndTrimmed() {
        LocalDate anchor = LocalDate.of(2026, 1, 31);

        assertThat(calculator.periodFor("  monthly ", anchor).key()).isEqualTo("MONTHLY:2026-01");
    }

    @Test
    void devOnlyFrequenciesCollapseToSingleDay() {
        // EVERY_5/10_MINUTES are dev-only (PY-19); their period is a single day, so they only
        // prove the pipeline fires live and never exercise real period boundaries.
        LocalDate anchor = LocalDate.of(2026, 1, 15);

        PayPeriod five = calculator.periodFor("EVERY_5_MINUTES", anchor);
        assertThat(five.start()).isEqualTo(anchor);
        assertThat(five.end()).isEqualTo(anchor);
        assertThat(five.key()).isEqualTo("EVERY_5_MINUTES:2026-01-15");

        PayPeriod ten = calculator.periodFor("EVERY_10_MINUTES", anchor);
        assertThat(ten.start()).isEqualTo(anchor);
        assertThat(ten.end()).isEqualTo(anchor);
        assertThat(ten.key()).isEqualTo("EVERY_10_MINUTES:2026-01-15");
    }
}
