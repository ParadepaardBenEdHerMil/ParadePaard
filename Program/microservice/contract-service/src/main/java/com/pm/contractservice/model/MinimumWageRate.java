package com.pm.contractservice.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * One row of the date-aware statutory Dutch minimum wage schedule: the hourly rate that
 * applies to employees of at least {@code minimumAge} for contracts starting on or after
 * {@code effectiveFrom}. The service groups these rows by {@code effectiveFrom} into a
 * schedule (see {@code DutchMinimumWageSchedule}). This table is the single source of
 * truth ContractService enforces and the horeca rules page edits.
 */
@Entity
@Table(
        name = "minimum_wage_rates",
        uniqueConstraints = @UniqueConstraint(
                name = "minimum_wage_rates_effective_age_key",
                columnNames = {"effective_from", "minimum_age"}
        )
)
public class MinimumWageRate {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Column(name = "minimum_age", nullable = false)
    private int minimumAge;

    @Column(name = "hourly_rate", nullable = false, precision = 19, scale = 2)
    private BigDecimal hourlyRate;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public LocalDate getEffectiveFrom() {
        return effectiveFrom;
    }

    public void setEffectiveFrom(LocalDate effectiveFrom) {
        this.effectiveFrom = effectiveFrom;
    }

    public int getMinimumAge() {
        return minimumAge;
    }

    public void setMinimumAge(int minimumAge) {
        this.minimumAge = minimumAge;
    }

    public BigDecimal getHourlyRate() {
        return hourlyRate;
    }

    public void setHourlyRate(BigDecimal hourlyRate) {
        this.hourlyRate = hourlyRate;
    }
}
