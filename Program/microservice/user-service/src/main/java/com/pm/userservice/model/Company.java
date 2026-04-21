package com.pm.userservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "companies")
public class Company {
    @Id
    private UUID id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(name = "payout_frequency_minutes", nullable = false)
    private Integer payoutFrequencyMinutes = 10080;

    @Column(name = "logo_bytes")
    private byte[] logo;

    @Column(name = "logo_content_type")
    private String logoContentType;

    @Column(name = "timesheet_logging_mode", nullable = false, length = 32)
    private String timesheetLoggingMode = "ADMIN_FINALIZE";

    @Column(name = "travel_claim_mode", nullable = false, length = 32)
    private String travelClaimMode = "REQUIRES_APPROVAL";

    @Lob
    @Column(name = "payroll_tax_templates_json")
    private String payrollTaxTemplatesJson;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getPayoutFrequencyMinutes() {
        return payoutFrequencyMinutes;
    }

    public void setPayoutFrequencyMinutes(Integer payoutFrequencyMinutes) {
        this.payoutFrequencyMinutes = payoutFrequencyMinutes;
    }

    public byte[] getLogo() {
        return logo;
    }

    public void setLogo(byte[] logo) {
        this.logo = logo;
    }

    public String getLogoContentType() {
        return logoContentType;
    }

    public void setLogoContentType(String logoContentType) {
        this.logoContentType = logoContentType;
    }

    public String getTimesheetLoggingMode() {
        return timesheetLoggingMode;
    }

    public void setTimesheetLoggingMode(String timesheetLoggingMode) {
        this.timesheetLoggingMode = timesheetLoggingMode;
    }

    public String getTravelClaimMode() {
        return travelClaimMode;
    }

    public void setTravelClaimMode(String travelClaimMode) {
        this.travelClaimMode = travelClaimMode;
    }

    public String getPayrollTaxTemplatesJson() {
        return payrollTaxTemplatesJson;
    }

    public void setPayrollTaxTemplatesJson(String payrollTaxTemplatesJson) {
        this.payrollTaxTemplatesJson = payrollTaxTemplatesJson;
    }
}
