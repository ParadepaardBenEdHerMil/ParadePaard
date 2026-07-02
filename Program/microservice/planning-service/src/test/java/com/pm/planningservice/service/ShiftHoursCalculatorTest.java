package com.pm.planningservice.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PL-2: worked-hours rules for a shift — overnight shifts, breaks, daylight-saving days.
 */
class ShiftHoursCalculatorTest {

    @Test
    void sameDayShiftMinusBreak() {
        // 09:00 -> 17:00 = 8h, minus 30 min break = 7.50
        assertThat(ShiftHoursCalculator.workedHours(
                LocalDateTime.of(2026, 6, 17, 9, 0),
                LocalDateTime.of(2026, 6, 17, 17, 0),
                30))
                .isEqualByComparingTo("7.50");
    }

    @Test
    void overnightShiftCrossingMidnight() {
        // 22:00 -> 06:00 next day = 8h, minus 30 min = 7.50
        assertThat(ShiftHoursCalculator.workedHours(
                LocalDateTime.of(2026, 6, 17, 22, 0),
                LocalDateTime.of(2026, 6, 18, 6, 0),
                30))
                .isEqualByComparingTo("7.50");
    }

    @Test
    void springForwardDstNightIsPaidWallClockHours() {
        // In NL, DST starts 2026-03-29 (clocks jump 02:00 -> 03:00). A 22:00 -> 06:00
        // shift is 8 wall-clock hours; the domain uses LocalDateTime so pay follows the
        // roster, not the 7 physically-elapsed hours. Pin that behaviour.
        assertThat(ShiftHoursCalculator.workedHours(
                LocalDateTime.of(2026, 3, 28, 22, 0),
                LocalDateTime.of(2026, 3, 29, 6, 0),
                0))
                .isEqualByComparingTo("8.00");
    }

    @Test
    void fallBackDstNightIsPaidWallClockHours() {
        // DST ends 2026-10-25 (clocks fall 03:00 -> 02:00). Same wall-clock 8h.
        assertThat(ShiftHoursCalculator.workedHours(
                LocalDateTime.of(2026, 10, 24, 22, 0),
                LocalDateTime.of(2026, 10, 25, 6, 0),
                0))
                .isEqualByComparingTo("8.00");
    }

    @Test
    void breakEqualToOrLongerThanShiftYieldsZeroNotNegative() {
        assertThat(ShiftHoursCalculator.workedHours(
                LocalDateTime.of(2026, 6, 17, 9, 0),
                LocalDateTime.of(2026, 6, 17, 12, 0),
                240)) // 4h break on a 3h shift
                .isEqualByComparingTo("0.00");
    }

    @Test
    void nullBreakTreatedAsZero() {
        assertThat(ShiftHoursCalculator.workedHours(
                LocalDateTime.of(2026, 6, 17, 9, 0),
                LocalDateTime.of(2026, 6, 17, 14, 30),
                null))
                .isEqualByComparingTo("5.50");
    }

    @Test
    void quarterHourRoundingToTwoDecimals() {
        // 09:00 -> 09:10 = 10 min = 0.1666.. h -> 0.17
        assertThat(ShiftHoursCalculator.workedHours(
                LocalDateTime.of(2026, 6, 17, 9, 0),
                LocalDateTime.of(2026, 6, 17, 9, 10),
                0))
                .isEqualByComparingTo("0.17");
    }
}
