package com.pm.planningservice.dto;

import java.util.List;
import java.util.UUID;

public class UserBillingRatesDTO {
    private UUID userId;
    private List<BillingRateDTO> clientOverrides;
    private List<BillingRateDTO> projectOverrides;

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public List<BillingRateDTO> getClientOverrides() {
        return clientOverrides;
    }

    public void setClientOverrides(List<BillingRateDTO> clientOverrides) {
        this.clientOverrides = clientOverrides;
    }

    public List<BillingRateDTO> getProjectOverrides() {
        return projectOverrides;
    }

    public void setProjectOverrides(List<BillingRateDTO> projectOverrides) {
        this.projectOverrides = projectOverrides;
    }
}
