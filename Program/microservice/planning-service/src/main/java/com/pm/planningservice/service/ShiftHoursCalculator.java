package com.pm.planningservice.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;

/**
 * Computes payable worked hours for a shift from its start/end wall-clock times
 * minus unpaid break minutes. Extracted from the timesheet export so the rules can
 * be unit-tested directly (PL-2): overnight shifts that cross midnight, break
 * handling, and daylight-saving days.
 *
 * <p><b>Time model:</b> start/end are {@link LocalDateTime} (business wall-clock,
 * Europe/Amsterdam). Hours are therefore the wall-clock difference. This is the
 * intended payroll behaviour: an employee scheduled 22:00–06:00 is paid 8 wall-clock
 * hours regardless of a DST transition that night. A shift whose break meets or
 * exceeds its length yields 0 (never negative).
 */
public final class ShiftHoursCalculator {

    private ShiftHoursCalculator() {
    }

    public static BigDecimal workedHours(LocalDateTime startTime, LocalDateTime endTime, Integer breakMinutes) {
        if (startTime == null || endTime == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        long unpaidBreak = Math.max(0, breakMinutes == null ? 0 : breakMinutes);
        long totalMinutes = Duration.between(startTime, endTime).toMinutes() - unpaidBreak;
        if (totalMinutes < 0) {
            totalMinutes = 0;
        }
        return BigDecimal.valueOf(totalMinutes)
                .divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
    }
}
