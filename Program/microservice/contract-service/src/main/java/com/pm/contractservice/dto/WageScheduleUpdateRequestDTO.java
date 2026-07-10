package com.pm.contractservice.dto;

import java.util.List;

/**
 * Create-or-replace one dated minimum wage table. Publishing a new {@code effectiveFrom}
 * adds a new loontabel; using an existing date edits that table in place. All age-band
 * rates for the date are replaced by {@code rates}, and the source document ({@code
 * documentName} / {@code documentUrl}) applies to the whole table.
 */
public class WageScheduleUpdateRequestDTO {

    private String effectiveFrom;
    private String documentName;
    private String documentUrl;
    private List<WageRateDTO> rates;

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
