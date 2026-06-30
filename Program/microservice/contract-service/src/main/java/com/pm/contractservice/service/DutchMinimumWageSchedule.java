package com.pm.contractservice.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Period;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Optional;
import java.util.TreeMap;

final class DutchMinimumWageSchedule {

    private static final NavigableMap<LocalDate, Schedule> SCHEDULES = schedules();

    private DutchMinimumWageSchedule() {
    }

    static Optional<BigDecimal> minimumHourlyWage(LocalDate contractStartDate, LocalDate dateOfBirth) {
        if (contractStartDate == null) {
            throw new IllegalArgumentException("contract start date is required to validate minimum wage");
        }
        if (dateOfBirth == null) {
            throw new IllegalArgumentException("dateOfBirth is required to validate minimum wage");
        }

        int age = Period.between(dateOfBirth, contractStartDate).getYears();
        if (age < 15) {
            throw new IllegalArgumentException("Employee must be at least 15 years old for Dutch minimum wage validation");
        }

        Map.Entry<LocalDate, Schedule> scheduleEntry = SCHEDULES.floorEntry(contractStartDate);
        if (scheduleEntry == null) {
            return Optional.empty();
        }
        return Optional.of(scheduleEntry.getValue().hourlyRateForAge(age));
    }

    private static NavigableMap<LocalDate, Schedule> schedules() {
        NavigableMap<LocalDate, Schedule> schedules = new TreeMap<>();
        schedules.put(LocalDate.of(2024, 1, 1), schedule("13.27", "10.62", "7.96", "6.64", "5.24", "4.58", "3.98"));
        schedules.put(LocalDate.of(2024, 7, 1), schedule("13.68", "10.94", "8.21", "6.84", "5.40", "4.72", "4.10"));
        schedules.put(LocalDate.of(2025, 1, 1), schedule("14.06", "11.25", "8.44", "7.03", "5.55", "4.86", "4.22"));
        schedules.put(LocalDate.of(2025, 7, 1), schedule("14.40", "11.52", "8.64", "7.20", "5.69", "4.98", "4.32"));
        schedules.put(LocalDate.of(2026, 1, 1), schedule("14.71", "12.50", "9.38", "7.82", "6.18", "5.41", "4.69"));
        schedules.put(LocalDate.of(2026, 7, 1), schedule("14.99", "12.74", "9.56", "7.98", "6.30", "5.51", "4.78"));
        return schedules;
    }

    private static Schedule schedule(
            String adult21,
            String age20,
            String age19,
            String age18,
            String age17,
            String age16,
            String age15
    ) {
        return new Schedule(List.of(
                new AgeRate(21, new BigDecimal(adult21)),
                new AgeRate(20, new BigDecimal(age20)),
                new AgeRate(19, new BigDecimal(age19)),
                new AgeRate(18, new BigDecimal(age18)),
                new AgeRate(17, new BigDecimal(age17)),
                new AgeRate(16, new BigDecimal(age16)),
                new AgeRate(15, new BigDecimal(age15))
        ));
    }

    private record Schedule(List<AgeRate> rates) {
        private BigDecimal hourlyRateForAge(int age) {
            return rates.stream()
                    .filter(rate -> age >= rate.minimumAge())
                    .max(Comparator.comparingInt(AgeRate::minimumAge))
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Employee must be at least 15 years old for Dutch minimum wage validation"
                    ))
                    .hourlyRate();
        }
    }

    private record AgeRate(int minimumAge, BigDecimal hourlyRate) {
    }
}
