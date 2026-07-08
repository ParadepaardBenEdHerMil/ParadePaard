package com.pm.contractservice.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MinimumWageServiceTest {

    private final MinimumWageService service = new MinimumWageService();

    @Test
    void returnsJuly2026AdultMinimum() {
        assertThat(service.minimumHourlyWage(LocalDate.of(2026, 7, 8), LocalDate.of(2000, 1, 1)))
                .contains(new BigDecimal("14.99"));
    }

    @Test
    void returnsJanuary2026AdultMinimum() {
        assertThat(service.minimumHourlyWage(LocalDate.of(2026, 1, 15), LocalDate.of(2000, 1, 1)))
                .contains(new BigDecimal("14.71"));
    }

    @Test
    void rejectsEmployeesUnderFifteen() {
        assertThatThrownBy(() -> service.minimumHourlyWage(LocalDate.of(2026, 7, 8), LocalDate.of(2015, 1, 1)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void reportsTheEffectiveDateOfTheScheduleInForce() {
        assertThat(service.effectiveDate(LocalDate.of(2026, 7, 8))).contains(LocalDate.of(2026, 7, 1));
        assertThat(service.effectiveDate(LocalDate.of(2026, 1, 15))).contains(LocalDate.of(2026, 1, 1));
    }
}
