package com.pm.contractservice.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DutchMinimumWageScheduleTest {

    @Test
    void minimumHourlyWage_usesExact2026HalfYearBoundaries() {
        assertThat(DutchMinimumWageSchedule.minimumHourlyWage(
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2000, 1, 1)
        )).hasValue(new BigDecimal("14.71"));

        assertThat(DutchMinimumWageSchedule.minimumHourlyWage(
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2000, 1, 1)
        )).hasValue(new BigDecimal("14.99"));
    }

    @Test
    void minimumHourlyWage_usesYouthRateForNineteenYearOld() {
        assertThat(DutchMinimumWageSchedule.minimumHourlyWage(
                LocalDate.of(2025, 7, 1),
                LocalDate.of(2006, 7, 1)
        )).hasValue(new BigDecimal("8.64"));
    }

    @Test
    void minimumHourlyWage_returnsEmptyBeforeHourlyMinimumWasIntroduced() {
        assertThat(DutchMinimumWageSchedule.minimumHourlyWage(
                LocalDate.of(2023, 12, 31),
                LocalDate.of(2000, 1, 1)
        )).isEmpty();
    }

    @Test
    void minimumHourlyWage_rejectsEmployeesYoungerThanFifteen() {
        assertThatThrownBy(() -> DutchMinimumWageSchedule.minimumHourlyWage(
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2012, 7, 2)
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least 15");
    }
}
