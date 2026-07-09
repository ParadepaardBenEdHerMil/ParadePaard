package com.pm.contractservice.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DutchMinimumWageScheduleTest {

    private final DutchMinimumWageSchedule schedule = DutchMinimumWageSchedule.defaults();

    @Test
    void minimumHourlyWage_usesExact2026HalfYearBoundaries() {
        assertThat(schedule.minimumHourlyWage(
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2000, 1, 1)
        )).hasValue(new BigDecimal("14.71"));

        assertThat(schedule.minimumHourlyWage(
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2000, 1, 1)
        )).hasValue(new BigDecimal("14.99"));
    }

    @Test
    void minimumHourlyWage_usesYouthRateForNineteenYearOld() {
        assertThat(schedule.minimumHourlyWage(
                LocalDate.of(2025, 7, 1),
                LocalDate.of(2006, 7, 1)
        )).hasValue(new BigDecimal("8.64"));
    }

    @Test
    void minimumHourlyWage_returnsEmptyBeforeHourlyMinimumWasIntroduced() {
        assertThat(schedule.minimumHourlyWage(
                LocalDate.of(2023, 12, 31),
                LocalDate.of(2000, 1, 1)
        )).isEmpty();
    }

    @Test
    void minimumHourlyWage_rejectsEmployeesYoungerThanFifteen() {
        assertThatThrownBy(() -> schedule.minimumHourlyWage(
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2012, 7, 2)
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least 15");
    }

    @Test
    void fromRates_overridesTheDefaultsAsTheSourceOfTruth() {
        DutchMinimumWageSchedule edited = DutchMinimumWageSchedule.fromRates(java.util.List.of(
                rate(LocalDate.of(2026, 7, 1), 21, "15.50"),
                rate(LocalDate.of(2026, 7, 1), 15, "5.60")
        ));

        assertThat(edited.minimumHourlyWage(LocalDate.of(2026, 7, 1), LocalDate.of(2000, 1, 1)))
                .hasValue(new BigDecimal("15.50"));
        assertThat(edited.effectiveDate(LocalDate.of(2026, 8, 1))).contains(LocalDate.of(2026, 7, 1));
    }

    private static com.pm.contractservice.model.MinimumWageRate rate(LocalDate effectiveFrom, int age, String hourly) {
        com.pm.contractservice.model.MinimumWageRate row = new com.pm.contractservice.model.MinimumWageRate();
        row.setEffectiveFrom(effectiveFrom);
        row.setMinimumAge(age);
        row.setHourlyRate(new BigDecimal(hourly));
        return row;
    }
}
