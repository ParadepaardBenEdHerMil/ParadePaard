package com.pm.planningservice.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public class BillingRateDTO {
    private UUID id;
    private String scope;
    private UUID clientCompanyId;
    private String clientName;
    private UUID projectId;
    private String projectName;
    private UUID userId;
    private String functionName;
    private BigDecimal ratePerHour;
    private BigDecimal comparedRatePerHour;
    private UUID sourceClientFunctionBillingRateId;
    private LocalDateTime effectiveFrom;
    private LocalDateTime effectiveTo;
    private Boolean active;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getScope() {
        return scope;
    }

    public void setScope(String scope) {
        this.scope = scope;
    }

    public UUID getClientCompanyId() {
        return clientCompanyId;
    }

    public void setClientCompanyId(UUID clientCompanyId) {
        this.clientCompanyId = clientCompanyId;
    }

    public String getClientName() {
        return clientName;
    }

    public void setClientName(String clientName) {
        this.clientName = clientName;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public void setProjectId(UUID projectId) {
        this.projectId = projectId;
    }

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getFunctionName() {
        return functionName;
    }

    public void setFunctionName(String functionName) {
        this.functionName = functionName;
    }

    public BigDecimal getRatePerHour() {
        return ratePerHour;
    }

    public void setRatePerHour(BigDecimal ratePerHour) {
        this.ratePerHour = ratePerHour;
    }

    public BigDecimal getComparedRatePerHour() {
        return comparedRatePerHour;
    }

    public void setComparedRatePerHour(BigDecimal comparedRatePerHour) {
        this.comparedRatePerHour = comparedRatePerHour;
    }

    public UUID getSourceClientFunctionBillingRateId() {
        return sourceClientFunctionBillingRateId;
    }

    public void setSourceClientFunctionBillingRateId(UUID sourceClientFunctionBillingRateId) {
        this.sourceClientFunctionBillingRateId = sourceClientFunctionBillingRateId;
    }

    public LocalDateTime getEffectiveFrom() {
        return effectiveFrom;
    }

    public void setEffectiveFrom(LocalDateTime effectiveFrom) {
        this.effectiveFrom = effectiveFrom;
    }

    public LocalDateTime getEffectiveTo() {
        return effectiveTo;
    }

    public void setEffectiveTo(LocalDateTime effectiveTo) {
        this.effectiveTo = effectiveTo;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
