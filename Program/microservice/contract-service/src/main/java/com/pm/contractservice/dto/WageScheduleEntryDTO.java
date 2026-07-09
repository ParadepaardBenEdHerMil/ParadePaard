package com.pm.contractservice.dto;

import java.util.List;

/** One dated minimum wage table: the age-band rates effective from a given date. */
public class WageScheduleEntryDTO {

    /** ISO date the table takes effect (e.g. "2026-07-01"). */
    private String effectiveFrom;
    private List<WageRateDTO> rates;

    public WageScheduleEntryDTO() {
    }

    public WageScheduleEntryDTO(String effectiveFrom, List<WageRateDTO> rates) {
        this.effectiveFrom = effectiveFrom;
        this.rates = rates;
    }

    public String getEffectiveFrom() {
        return effectiveFrom;
    }

    public void setEffectiveFrom(String effectiveFrom) {
        this.effectiveFrom = effectiveFrom;
    }

    public List<WageRateDTO> getRates() {
        return rates;
    }

    public void setRates(List<WageRateDTO> rates) {
        this.rates = rates;
    }
}
