package com.pm.contractservice.service;

import com.pm.contractservice.dto.WageScheduleDTO;
import com.pm.contractservice.model.MinimumWageRate;
import com.pm.contractservice.repository.MinimumWageRateRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MinimumWageServiceTest {

    private final MinimumWageRateRepository repository = mock(MinimumWageRateRepository.class);
    private final MinimumWageService service = new MinimumWageService(repository);

    @Test
    void returnsJuly2026AdultMinimumFromTheSeededDefaultsWhenTheTableIsEmpty() {
        assertThat(service.minimumHourlyWage(LocalDate.of(2026, 7, 8), LocalDate.of(2000, 1, 1)))
                .contains(new BigDecimal("14.99"));
    }

    @Test
    void returnsJanuary2026AdultMinimumFromTheSeededDefaultsWhenTheTableIsEmpty() {
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

    @Test
    void persistedRowsOverrideTheDefaultsAndDriveTheEnforcedMinimum() {
        when(repository.findAllByOrderByEffectiveFromAscMinimumAgeAsc()).thenReturn(List.of(
                row(LocalDate.of(2026, 7, 1), 21, "16.00"),
                row(LocalDate.of(2026, 7, 1), 15, "5.90")
        ));

        assertThat(service.minimumHourlyWage(LocalDate.of(2026, 7, 8), LocalDate.of(2000, 1, 1)))
                .contains(new BigDecimal("16.00"));
    }

    @Test
    void getSchedulePresentsTheTablesNewestFirstWithRatesHighAgeFirst() {
        when(repository.findAllByOrderByEffectiveFromAscMinimumAgeAsc()).thenReturn(List.of(
                row(LocalDate.of(2026, 1, 1), 21, "14.71"),
                row(LocalDate.of(2026, 1, 1), 15, "5.15"),
                row(LocalDate.of(2026, 7, 1), 21, "14.99"),
                row(LocalDate.of(2026, 7, 1), 15, "5.30")
        ));

        WageScheduleDTO schedule = service.getSchedule();

        assertThat(schedule.getEntries()).hasSize(2);
        assertThat(schedule.getEntries().get(0).getEffectiveFrom()).isEqualTo("2026-07-01");
        assertThat(schedule.getEntries().get(0).getRates().get(0).getMinimumAge()).isEqualTo(21);
        assertThat(schedule.getEntries().get(0).getRates().get(0).getHourlyRate()).isEqualByComparingTo("14.99");
    }

    private static MinimumWageRate row(LocalDate effectiveFrom, int minimumAge, String hourlyRate) {
        MinimumWageRate rate = new MinimumWageRate();
        rate.setEffectiveFrom(effectiveFrom);
        rate.setMinimumAge(minimumAge);
        rate.setHourlyRate(new BigDecimal(hourlyRate));
        return rate;
    }
}
