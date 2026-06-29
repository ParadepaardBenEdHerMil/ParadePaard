package com.pm.planningservice.dto;

import java.util.List;

/** Batch billing-rate resolution request body for POST /planning/billing-rates/resolve. */
public class RateResolveRequestDTO {
    private List<RateResolveItemDTO> items;

    public List<RateResolveItemDTO> getItems() { return items; }
    public void setItems(List<RateResolveItemDTO> items) { this.items = items; }
}
