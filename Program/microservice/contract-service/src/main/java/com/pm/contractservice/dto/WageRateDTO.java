package com.pm.contractservice.dto;

import java.math.BigDecimal;

/** A single age band's hourly rate within one dated minimum wage table. */
public class WageRateDTO {

    /** Lowest age (inclusive) this rate applies to; 21 represents the adult (21+) band. */
    private Integer minimumAge;
    private BigDecimal hourlyRate;

    public WageRateDTO() {
    }

    public WageRateDTO(Integer minimumAge, BigDecimal hourlyRate) {
        this.minimumAge = minimumAge;
        this.hourlyRate = hourlyRate;
    }

    public Integer getMinimumAge() {
        return minimumAge;
    }

    public void setMinimumAge(Integer minimumAge) {
        this.minimumAge = minimumAge;
    }

    public BigDecimal getHourlyRate() {
        return hourlyRate;
    }

    public void setHourlyRate(BigDecimal hourlyRate) {
        this.hourlyRate = hourlyRate;
    }
}
