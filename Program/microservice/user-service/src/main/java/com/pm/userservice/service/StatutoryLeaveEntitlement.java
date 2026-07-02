package com.pm.userservice.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Computes an employee's annual statutory holiday entitlement in hours.
 *
 * <p>Dutch law (art. 7:634 BW) sets the minimum paid holiday at four times the weekly
 * working hours per year: {@code entitlement = 4 x weeklyHours}. A 38-hour week therefore
 * yields 152 hours; a 20-hour week yields 80 hours.
 *
 * <p>When the weekly hours are unknown (not yet captured for the employee) a documented
 * full-time fallback is used so a balance can still be created.
 */
public final class StatutoryLeaveEntitlement {

    /** Fallback annual entitlement when weekly hours are unknown: a full-time (38h) year. */
    public static final int DEFAULT_FULL_TIME_HOURS = 152;

    /** NL statutory multiplier: minimum holiday = 4 x the weekly working hours. */
    private static final BigDecimal STATUTORY_WEEKS_PER_YEAR = BigDecimal.valueOf(4);

    private StatutoryLeaveEntitlement() {
    }

    public static int annualHoursFor(BigDecimal weeklyHours) {
        if (weeklyHours == null || weeklyHours.signum() <= 0) {
            return DEFAULT_FULL_TIME_HOURS;
        }
        return weeklyHours.multiply(STATUTORY_WEEKS_PER_YEAR)
                .setScale(0, RoundingMode.HALF_UP)
                .intValueExact();
    }
}
