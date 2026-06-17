package com.pm.planningservice.dto;

import java.util.List;

public class ClientBillingRatesDTO {
    private List<BillingRateDTO> defaultRates;
    private List<BillingRateDTO> projectRates;
    private List<BillingRateDTO> employeeOverrides;
    private List<BillingRateDTO> projectEmployeeOverrides;

    public List<BillingRateDTO> getDefaultRates() {
        return defaultRates;
    }

    public void setDefaultRates(List<BillingRateDTO> defaultRates) {
        this.defaultRates = defaultRates;
    }

    public List<BillingRateDTO> getProjectRates() {
        return projectRates;
    }

    public void setProjectRates(List<BillingRateDTO> projectRates) {
        this.projectRates = projectRates;
    }

    public List<BillingRateDTO> getEmployeeOverrides() {
        return employeeOverrides;
    }

    public void setEmployeeOverrides(List<BillingRateDTO> employeeOverrides) {
        this.employeeOverrides = employeeOverrides;
    }

    public List<BillingRateDTO> getProjectEmployeeOverrides() {
        return projectEmployeeOverrides;
    }

    public void setProjectEmployeeOverrides(List<BillingRateDTO> projectEmployeeOverrides) {
        this.projectEmployeeOverrides = projectEmployeeOverrides;
    }
}
