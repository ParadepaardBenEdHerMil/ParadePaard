package com.pm.payrollservice.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "payslips")
public class Payslip {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Column(name = "gross_base_amount", precision = 19, scale = 4)
    private BigDecimal grossBaseAmount;

    @Column(name = "vacation_hours")
    private BigDecimal vacationHours;

    @Column(name = "vacation_pay_amount", precision = 19, scale = 4)
    private BigDecimal vacationPayAmount;

    @Column(name = "other_special_remuneration", columnDefinition = "text")
    private String otherSpecialRemuneration; // JSON string if needed

    @Column(name = "total_gross", precision = 19, scale = 4)
    private BigDecimal totalGross;

    @Column(name = "pension_base_amount", precision = 19, scale = 4)
    private BigDecimal pensionBaseAmount;

    @Column(name = "wage_tax_withheld", precision = 19, scale = 4)
    private BigDecimal wageTaxWithheld;

    @Column(name = "social_security_withheld", precision = 19, scale = 4)
    private BigDecimal socialSecurityWithheld;

    @Column(name = "heffingskorting_applied")
    private boolean heffingskortingApplied;

    @Column(name = "labor_tax_credit_amount", precision = 19, scale = 4)
    private BigDecimal laborTaxCreditAmount;

    @Column(name = "net_amount", precision = 19, scale = 4)
    private BigDecimal netAmount;

    @Column(name = "payslip_document_id")
    private UUID payslipDocumentId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public LocalDate getPeriodStart() {
        return periodStart;
    }

    public void setPeriodStart(LocalDate periodStart) {
        this.periodStart = periodStart;
    }

    public LocalDate getPeriodEnd() {
        return periodEnd;
    }

    public void setPeriodEnd(LocalDate periodEnd) {
        this.periodEnd = periodEnd;
    }

    public BigDecimal getGrossBaseAmount() {
        return grossBaseAmount;
    }

    public void setGrossBaseAmount(BigDecimal grossBaseAmount) {
        this.grossBaseAmount = grossBaseAmount;
    }

    public BigDecimal getVacationHours() {
        return vacationHours;
    }

    public void setVacationHours(BigDecimal vacationHours) {
        this.vacationHours = vacationHours;
    }

    public BigDecimal getVacationPayAmount() {
        return vacationPayAmount;
    }

    public void setVacationPayAmount(BigDecimal vacationPayAmount) {
        this.vacationPayAmount = vacationPayAmount;
    }

    public String getOtherSpecialRemuneration() {
        return otherSpecialRemuneration;
    }

    public void setOtherSpecialRemuneration(String otherSpecialRemuneration) {
        this.otherSpecialRemuneration = otherSpecialRemuneration;
    }

    public BigDecimal getTotalGross() {
        return totalGross;
    }

    public void setTotalGross(BigDecimal totalGross) {
        this.totalGross = totalGross;
    }

    public BigDecimal getPensionBaseAmount() {
        return pensionBaseAmount;
    }

    public void setPensionBaseAmount(BigDecimal pensionBaseAmount) {
        this.pensionBaseAmount = pensionBaseAmount;
    }

    public BigDecimal getWageTaxWithheld() {
        return wageTaxWithheld;
    }

    public void setWageTaxWithheld(BigDecimal wageTaxWithheld) {
        this.wageTaxWithheld = wageTaxWithheld;
    }

    public BigDecimal getSocialSecurityWithheld() {
        return socialSecurityWithheld;
    }

    public void setSocialSecurityWithheld(BigDecimal socialSecurityWithheld) {
        this.socialSecurityWithheld = socialSecurityWithheld;
    }

    public boolean isHeffingskortingApplied() {
        return heffingskortingApplied;
    }

    public void setHeffingskortingApplied(boolean heffingskortingApplied) {
        this.heffingskortingApplied = heffingskortingApplied;
    }

    public BigDecimal getLaborTaxCreditAmount() {
        return laborTaxCreditAmount;
    }

    public void setLaborTaxCreditAmount(BigDecimal laborTaxCreditAmount) {
        this.laborTaxCreditAmount = laborTaxCreditAmount;
    }

    public BigDecimal getNetAmount() {
        return netAmount;
    }

    public void setNetAmount(BigDecimal netAmount) {
        this.netAmount = netAmount;
    }

    public UUID getPayslipDocumentId() {
        return payslipDocumentId;
    }

    public void setPayslipDocumentId(UUID payslipDocumentId) {
        this.payslipDocumentId = payslipDocumentId;
    }
}
