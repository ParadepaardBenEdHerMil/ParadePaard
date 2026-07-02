package com.pm.userservice.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * NL statutory holiday minimum: entitlement = 4 x weekly hours per year.
 */
class StatutoryLeaveEntitlementTest {

    @Test
    void fullTimeThirtyEightHours() {
        assertThat(StatutoryLeaveEntitlement.annualHoursFor(new BigDecimal("38"))).isEqualTo(152);
    }

    @Test
    void fortyHourWeek() {
        assertThat(StatutoryLeaveEntitlement.annualHoursFor(new BigDecimal("40"))).isEqualTo(160);
    }

    @Test
    void thirtySixHourWeek() {
        assertThat(StatutoryLeaveEntitlement.annualHoursFor(new BigDecimal("36"))).isEqualTo(144);
    }

    @Test
    void partTimeTwentyHours() {
        assertThat(StatutoryLeaveEntitlement.annualHoursFor(new BigDecimal("20"))).isEqualTo(80);
    }

    @Test
    void fractionalHoursRoundHalfUp() {
        // 4 x 24.5 = 98
        assertThat(StatutoryLeaveEntitlement.annualHoursFor(new BigDecimal("24.5"))).isEqualTo(98);
        // 4 x 18.375 = 73.5 -> 74
        assertThat(StatutoryLeaveEntitlement.annualHoursFor(new BigDecimal("18.375"))).isEqualTo(74);
    }

    @Test
    void nullOrZeroFallsBackToFullTimeDefault() {
        assertThat(StatutoryLeaveEntitlement.annualHoursFor(null))
                .isEqualTo(StatutoryLeaveEntitlement.DEFAULT_FULL_TIME_HOURS);
        assertThat(StatutoryLeaveEntitlement.annualHoursFor(BigDecimal.ZERO))
                .isEqualTo(StatutoryLeaveEntitlement.DEFAULT_FULL_TIME_HOURS);
    }
}
