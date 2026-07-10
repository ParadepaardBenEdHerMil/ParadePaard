package com.pm.contractservice.dto;

import java.util.List;

/** One dated minimum wage table: the source document plus age-band rates effective from a date. */
public class WageScheduleEntryDTO {

    /** ISO date the table takes effect (e.g. "2026-07-01"). */
    private String effectiveFrom;
    private String documentName;
    private String documentUrl;
    private List<WageRateDTO> rates;

    public WageScheduleEntryDTO() {
    }

    public WageScheduleEntryDTO(String effectiveFrom, String documentName, String documentUrl, List<WageRateDTO> rates) {
        this.effectiveFrom = effectiveFrom;
        this.documentName = documentName;
        this.documentUrl = documentUrl;
        this.rates = rates;
    }

    public String getEffectiveFrom() {
        return effectiveFrom;
    }

    public void setEffectiveFrom(String effectiveFrom) {
        this.effectiveFrom = effectiveFrom;
    }

    public String getDocumentName() {
        return documentName;
    }

    public void setDocumentName(String documentName) {
        this.documentName = documentName;
    }

    public String getDocumentUrl() {
        return documentUrl;
    }

    public void setDocumentUrl(String documentUrl) {
        this.documentUrl = documentUrl;
    }

    public List<WageRateDTO> getRates() {
        return rates;
    }

    public void setRates(List<WageRateDTO> rates) {
        this.rates = rates;
    }
}
