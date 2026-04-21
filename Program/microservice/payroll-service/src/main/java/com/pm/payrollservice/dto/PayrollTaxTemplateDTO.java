package com.pm.payrollservice.dto;

import java.math.BigDecimal;

public class PayrollTaxTemplateDTO {
    private String code;
    private String label;
    private String category;
    private String calculationType;
    private BigDecimal configuredValue;
    private Boolean active;
    private Integer sortOrder;
    private String notes;
    private String employeeProfileTrigger;

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getCalculationType() {
        return calculationType;
    }

    public void setCalculationType(String calculationType) {
        this.calculationType = calculationType;
    }

    public BigDecimal getConfiguredValue() {
        return configuredValue;
    }

    public void setConfiguredValue(BigDecimal configuredValue) {
        this.configuredValue = configuredValue;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getEmployeeProfileTrigger() {
        return employeeProfileTrigger;
    }

    public void setEmployeeProfileTrigger(String employeeProfileTrigger) {
        this.employeeProfileTrigger = employeeProfileTrigger;
    }
}
