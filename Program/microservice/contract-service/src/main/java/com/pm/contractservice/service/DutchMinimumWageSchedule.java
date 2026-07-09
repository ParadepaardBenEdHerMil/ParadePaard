package com.pm.contractservice.service;

import com.pm.contractservice.model.MinimumWageRate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Optional;
import java.util.TreeMap;

/**
 * Date-aware Dutch statutory minimum wage (WML) resolver.
 *
 * <p>Immutable value object built either from the persisted schedule (the single source of
 * truth {@link MinimumWageService} reads) or from the in-code {@link #defaults()} used to
 * seed a fresh database and as a fallback when the table is empty. The resolution logic
 * (floor by start date, then highest matching age band) is unchanged from when the schedule
 * was hardcoded.
 */
final class DutchMinimumWageSchedule {

    /** Age bands, highest first, that every dated table provides. 21 = adult (21+). */
    static final List<Integer> AGE_BANDS = List.of(21, 20, 19, 18, 17, 16, 15);

    private final NavigableMap<LocalDate, Schedule> schedules;

    private DutchMinimumWageSchedule(NavigableMap<LocalDate, Schedule> schedules) {
        this.schedules = schedules;
    }

    Optional<BigDecimal> minimumHourlyWage(LocalDate contractStartDate, LocalDate dateOfBirth) {
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

        Map.Entry<LocalDate, Schedule> scheduleEntry = schedules.floorEntry(contractStartDate);
        if (scheduleEntry == null) {
            return Optional.empty();
        }
        return Optional.of(scheduleEntry.getValue().hourlyRateForAge(age));
    }

    /**
     * The date the wage schedule in force on {@code contractStartDate} took effect (e.g.
     * 2026-07-01). Lets the UI show an honest, date-aware source instead of a fixed label.
     */
    Optional<LocalDate> effectiveDate(LocalDate contractStartDate) {
        if (contractStartDate == null) {
            return Optional.empty();
        }
        Map.Entry<LocalDate, Schedule> scheduleEntry = schedules.floorEntry(contractStartDate);
        return scheduleEntry == null ? Optional.empty() : Optional.of(scheduleEntry.getKey());
    }

    /** Every dated table, ascending by effective date, for the admin read model. */
    NavigableMap<LocalDate, Schedule> schedulesView() {
        return schedules;
    }

    // --- construction ---------------------------------------------------------------

    /** Builds the schedule from persisted rate rows (the source of truth). */
    static DutchMinimumWageSchedule fromRates(Collection<MinimumWageRate> rates) {
        NavigableMap<LocalDate, List<AgeRate>> grouped = new TreeMap<>();
        for (MinimumWageRate rate : rates) {
            grouped.computeIfAbsent(rate.getEffectiveFrom(), date -> new ArrayList<>())
                    .add(new AgeRate(rate.getMinimumAge(), rate.getHourlyRate()));
        }
        NavigableMap<LocalDate, Schedule> schedules = new TreeMap<>();
        grouped.forEach((date, ageRates) -> schedules.put(date, new Schedule(List.copyOf(ageRates))));
        return new DutchMinimumWageSchedule(schedules);
    }

    /** The canonical statutory schedule, used to seed a fresh database and as a fallback. */
    static DutchMinimumWageSchedule defaults() {
        return fromRates(defaultRates());
    }

    /** Fresh, unpersisted seed rows for the canonical statutory WML (2024-01 .. 2026-07). */
    static List<MinimumWageRate> defaultRates() {
        List<MinimumWageRate> rates = new ArrayList<>();
        addTable(rates, LocalDate.of(2024, 1, 1), "13.27", "10.62", "7.96", "6.64", "5.24", "4.58", "3.98");
        addTable(rates, LocalDate.of(2024, 7, 1), "13.68", "10.94", "8.21", "6.84", "5.40", "4.72", "4.10");
        addTable(rates, LocalDate.of(2025, 1, 1), "14.06", "11.25", "8.44", "7.03", "5.55", "4.86", "4.22");
        addTable(rates, LocalDate.of(2025, 7, 1), "14.40", "11.52", "8.64", "7.20", "5.69", "4.98", "4.32");
        addTable(rates, LocalDate.of(2026, 1, 1), "14.71", "12.50", "9.38", "7.82", "6.18", "5.41", "4.69");
        addTable(rates, LocalDate.of(2026, 7, 1), "14.99", "12.74", "9.56", "7.98", "6.30", "5.51", "4.78");
        return rates;
    }

    private static void addTable(
            List<MinimumWageRate> out,
            LocalDate effectiveFrom,
            String adult21,
            String age20,
            String age19,
            String age18,
            String age17,
            String age16,
            String age15
    ) {
        String[] byBand = {adult21, age20, age19, age18, age17, age16, age15};
        for (int i = 0; i < AGE_BANDS.size(); i++) {
            out.add(rate(effectiveFrom, AGE_BANDS.get(i), byBand[i]));
        }
    }

    private static MinimumWageRate rate(LocalDate effectiveFrom, int minimumAge, String hourlyRate) {
        MinimumWageRate row = new MinimumWageRate();
        row.setEffectiveFrom(effectiveFrom);
        row.setMinimumAge(minimumAge);
        row.setHourlyRate(new BigDecimal(hourlyRate));
        return row;
    }

    record Schedule(List<AgeRate> rates) {
        BigDecimal hourlyRateForAge(int age) {
            return rates.stream()
                    .filter(rate -> age >= rate.minimumAge())
                    .max(Comparator.comparingInt(AgeRate::minimumAge))
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Employee must be at least 15 years old for Dutch minimum wage validation"
                    ))
                    .hourlyRate();
        }
    }

    record AgeRate(int minimumAge, BigDecimal hourlyRate) {
    }
}
