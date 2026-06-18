package com.pm.planningservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "project_function_billing_rates", indexes = {
        @Index(name = "idx_project_function_billing_rate_project", columnList = "company_id,project_id"),
        @Index(name = "idx_project_function_billing_rate_client", columnList = "company_id,client_company_id")
})
public class ProjectFunctionBillingRate {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "project_function_billing_rate_id", nullable = false)
    private UUID projectFunctionBillingRateId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "client_company_id", nullable = false)
    private UUID clientCompanyId;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "function_name", nullable = false)
    private String functionName;

    @Column(name = "rate_per_hour", nullable = false, precision = 19, scale = 2)
    private BigDecimal ratePerHour;

    @Column(name = "source_client_function_billing_rate_id")
    private UUID sourceClientFunctionBillingRateId;

    @Column(name = "copied_at", nullable = false)
    private LocalDateTime copiedAt;

    @Column(length = 2000)
    private String notes;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "created_by_user_id")
    private UUID createdByUserId;

    @Column(name = "updated_by_user_id")
    private UUID updatedByUserId;

    public UUID getProjectFunctionBillingRateId() {
        return projectFunctionBillingRateId;
    }

    public void setProjectFunctionBillingRateId(UUID projectFunctionBillingRateId) {
        this.projectFunctionBillingRateId = projectFunctionBillingRateId;
    }

    public UUID getCompanyId() {
        return companyId;
    }

    public void setCompanyId(UUID companyId) {
        this.companyId = companyId;
    }

    public UUID getClientCompanyId() {
        return clientCompanyId;
    }

    public void setClientCompanyId(UUID clientCompanyId) {
        this.clientCompanyId = clientCompanyId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public void setProjectId(UUID projectId) {
        this.projectId = projectId;
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

    public UUID getSourceClientFunctionBillingRateId() {
        return sourceClientFunctionBillingRateId;
    }

    public void setSourceClientFunctionBillingRateId(UUID sourceClientFunctionBillingRateId) {
        this.sourceClientFunctionBillingRateId = sourceClientFunctionBillingRateId;
    }

    public LocalDateTime getCopiedAt() {
        return copiedAt;
    }

    public void setCopiedAt(LocalDateTime copiedAt) {
        this.copiedAt = copiedAt;
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

    public UUID getCreatedByUserId() {
        return createdByUserId;
    }

    public void setCreatedByUserId(UUID createdByUserId) {
        this.createdByUserId = createdByUserId;
    }

    public UUID getUpdatedByUserId() {
        return updatedByUserId;
    }

    public void setUpdatedByUserId(UUID updatedByUserId) {
        this.updatedByUserId = updatedByUserId;
    }

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (copiedAt == null) copiedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
