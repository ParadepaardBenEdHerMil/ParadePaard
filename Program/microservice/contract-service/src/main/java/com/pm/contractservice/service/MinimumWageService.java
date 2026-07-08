package com.pm.contractservice.service;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

/**
 * Thin, dependency-free entry point that exposes the authoritative, date-aware statutory
 * Dutch minimum wage ({@link DutchMinimumWageSchedule}) to the web layer. This is the same
 * schedule {@code ContractService.validateMinimumHourlyWage} enforces, so a wage the
 * frontend suggests from here can never be rejected on contract creation.
 */
@Service
public class MinimumWageService {

    /**
     * @return the statutory minimum hourly wage effective on {@code contractStartDate} for
     *         the employee's age, or empty when no schedule covers that date.
     * @throws IllegalArgumentException if a date is null or the employee is under 15
     *         (surfaced by the controller advice as a clean 400).
     */
    public Optional<BigDecimal> minimumHourlyWage(LocalDate contractStartDate, LocalDate dateOfBirth) {
        return DutchMinimumWageSchedule.minimumHourlyWage(contractStartDate, dateOfBirth);
    }

    /** The date the wage schedule in force on {@code contractStartDate} took effect. */
    public Optional<LocalDate> effectiveDate(LocalDate contractStartDate) {
        return DutchMinimumWageSchedule.effectiveDate(contractStartDate);
    }
}
