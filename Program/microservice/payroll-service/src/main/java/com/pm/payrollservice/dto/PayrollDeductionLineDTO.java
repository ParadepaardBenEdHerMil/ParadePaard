package com.pm.payrollservice.dto;

import java.math.BigDecimal;

public class PayrollDeductionLineDTO {
    private String id;
    private String code;
    private String label;
    private String category;
    private String calculationType;
    private BigDecimal configuredValue;
    private BigDecimal calculatedAmount;
    private BigDecimal manualAmountOverride;
    private String source;
    private String notes;
    private Integer sortOrder;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

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

    public BigDecimal getCalculatedAmount() {
        return calculatedAmount;
    }

    public void setCalculatedAmount(BigDecimal calculatedAmount) {
        this.calculatedAmount = calculatedAmount;
    }

    public BigDecimal getManualAmountOverride() {
        return manualAmountOverride;
    }

    public void setManualAmountOverride(BigDecimal manualAmountOverride) {
        this.manualAmountOverride = manualAmountOverride;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }
}
