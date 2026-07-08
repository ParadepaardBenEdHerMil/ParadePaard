package com.pm.contractservice.dto;

import java.math.BigDecimal;

/**
 * Statutory Dutch minimum hourly wage resolved for a specific contract start date and
 * employee date of birth. This is the single source of truth the frontend reads so the
 * onboarding "suggested minimum" and the horeca rules page never drift from what
 * contract-service actually enforces on contract creation.
 */
public class MinimumWageResponseDTO {

    private String startDate;
    private String dateOfBirth;
    private Integer age;
    /** Null when no wage schedule covers the given start date. */
    private BigDecimal minimumHourlyWage;
    /** ISO date the wage schedule in force took effect (e.g. "2026-07-01"); null when uncovered. */
    private String effectiveFrom;

    public MinimumWageResponseDTO() {
    }

    public MinimumWageResponseDTO(String startDate, String dateOfBirth, Integer age,
                                  BigDecimal minimumHourlyWage, String effectiveFrom) {
        this.startDate = startDate;
        this.dateOfBirth = dateOfBirth;
        this.age = age;
        this.minimumHourlyWage = minimumHourlyWage;
        this.effectiveFrom = effectiveFrom;
    }

    public String getStartDate() {
        return startDate;
    }

    public void setStartDate(String startDate) {
        this.startDate = startDate;
    }

    public String getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(String dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public Integer getAge() {
        return age;
    }

    public void setAge(Integer age) {
        this.age = age;
    }

    public BigDecimal getMinimumHourlyWage() {
        return minimumHourlyWage;
    }

    public void setMinimumHourlyWage(BigDecimal minimumHourlyWage) {
        this.minimumHourlyWage = minimumHourlyWage;
    }

    public String getEffectiveFrom() {
        return effectiveFrom;
    }

    public void setEffectiveFrom(String effectiveFrom) {
        this.effectiveFrom = effectiveFrom;
    }
}
