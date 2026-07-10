package com.pm.contractservice.service;

import com.pm.contractservice.dto.WageRateDTO;
import com.pm.contractservice.dto.WageScheduleDTO;
import com.pm.contractservice.dto.WageScheduleEntryDTO;
import com.pm.contractservice.dto.WageScheduleUpdateRequestDTO;
import com.pm.contractservice.model.MinimumWageRate;
import com.pm.contractservice.repository.MinimumWageRateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;

/**
 * Exposes and maintains the authoritative, date-aware statutory Dutch minimum wage
 * ({@link DutchMinimumWageSchedule}) backed by the persisted {@code minimum_wage_rates}
 * table. This is the same schedule {@code ContractService.validateMinimumHourlyWage}
 * enforces, so a wage the frontend suggests from here can never be rejected on contract
 * creation, and editing the schedule here immediately changes what the backend enforces.
 *
 * <p>When the table is empty (before the seeder runs, or in a pure unit test) it falls back
 * to the in-code {@link DutchMinimumWageSchedule#defaults()} so resolution always works.
 */
@Service
public class MinimumWageService {

    private final MinimumWageRateRepository repository;

    public MinimumWageService(MinimumWageRateRepository repository) {
        this.repository = repository;
    }

    private DutchMinimumWageSchedule schedule() {
        List<MinimumWageRate> rows = repository.findAllByOrderByEffectiveFromAscMinimumAgeAsc();
        return rows.isEmpty() ? DutchMinimumWageSchedule.defaults() : DutchMinimumWageSchedule.fromRates(rows);
    }

    /**
     * @return the statutory minimum hourly wage effective on {@code contractStartDate} for
     *         the employee's age, or empty when no schedule covers that date.
     * @throws IllegalArgumentException if a date is null or the employee is under 15
     *         (surfaced by the controller advice as a clean 400).
     */
    public Optional<BigDecimal> minimumHourlyWage(LocalDate contractStartDate, LocalDate dateOfBirth) {
        return schedule().minimumHourlyWage(contractStartDate, dateOfBirth);
    }

    /** The date the wage schedule in force on {@code contractStartDate} took effect. */
    public Optional<LocalDate> effectiveDate(LocalDate contractStartDate) {
        return schedule().effectiveDate(contractStartDate);
    }

    /** The full editable schedule (every dated table + its source document), newest first. */
    @Transactional(readOnly = true)
    public WageScheduleDTO getSchedule() {
        List<MinimumWageRate> rows = repository.findAllByOrderByEffectiveFromAscMinimumAgeAsc();
        if (rows.isEmpty()) {
            rows = DutchMinimumWageSchedule.defaultRates();
        }
        // Group by effective date, newest first; each group is one dated loontabel.
        Map<LocalDate, List<MinimumWageRate>> byDate = new TreeMap<>(Comparator.reverseOrder());
        for (MinimumWageRate row : rows) {
            byDate.computeIfAbsent(row.getEffectiveFrom(), date -> new ArrayList<>()).add(row);
        }
        List<WageScheduleEntryDTO> entries = new ArrayList<>();
        byDate.forEach((date, group) -> {
            List<WageRateDTO> rateDtos = group.stream()
                    .sorted(Comparator.comparingInt(MinimumWageRate::getMinimumAge).reversed())
                    .map(row -> new WageRateDTO(row.getMinimumAge(), row.getHourlyRate()))
                    .toList();
            MinimumWageRate any = group.get(0);
            entries.add(new WageScheduleEntryDTO(date.toString(), any.getDocumentName(), any.getDocumentUrl(), rateDtos));
        });
        return new WageScheduleDTO(entries);
    }

    /**
     * Creates a new dated wage table, or replaces an existing one with the same effective
     * date. All age-band rates for that date are replaced by {@code request.rates}.
     */
    @Transactional
    public WageScheduleDTO updateSchedule(WageScheduleUpdateRequestDTO request) {
        LocalDate effectiveFrom = parseEffectiveFrom(request.getEffectiveFrom());
        List<WageRateDTO> rates = request.getRates();
        if (rates == null || rates.isEmpty()) {
            throw new IllegalArgumentException("At least one wage rate is required.");
        }

        // Seed the canonical schedule first so editing a single date never leaves the
        // enforced schedule with only the one table the admin just saved.
        seedDefaultsIfEmpty();

        String documentName = blankToNull(request.getDocumentName());
        String documentUrl = blankToNull(request.getDocumentUrl());

        List<MinimumWageRate> toSave = new ArrayList<>();
        for (WageRateDTO rate : rates) {
            if (rate.getMinimumAge() == null || rate.getHourlyRate() == null) {
                throw new IllegalArgumentException("Each wage rate needs a minimum age and an hourly rate.");
            }
            if (rate.getMinimumAge() < 15) {
                throw new IllegalArgumentException("Minimum age cannot be below 15.");
            }
            if (rate.getHourlyRate().signum() < 0) {
                throw new IllegalArgumentException("Hourly rate cannot be negative.");
            }
            MinimumWageRate row = new MinimumWageRate();
            row.setEffectiveFrom(effectiveFrom);
            row.setMinimumAge(rate.getMinimumAge());
            row.setHourlyRate(rate.getHourlyRate());
            row.setDocumentName(documentName);
            row.setDocumentUrl(documentUrl);
            toSave.add(row);
        }

        // Replace the table for this effective date (delete-then-insert), flushing the
        // delete before the insert so the (effective_from, minimum_age) unique key holds.
        repository.deleteByEffectiveFrom(effectiveFrom);
        repository.flush();
        repository.saveAll(toSave);
        return getSchedule();
    }

    /** Populates the canonical statutory schedule once, on first startup. */
    @Transactional
    public void seedDefaultsIfEmpty() {
        if (repository.count() == 0) {
            repository.saveAll(DutchMinimumWageSchedule.defaultRates());
        }
    }

    private static LocalDate parseEffectiveFrom(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("effectiveFrom is required (ISO date YYYY-MM-DD).");
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("effectiveFrom must be an ISO date (YYYY-MM-DD).");
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
