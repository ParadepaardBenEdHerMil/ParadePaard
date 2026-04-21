package com.pm.userservice.dto;

public class UpdateCompanyRequestDTO {
    private String name;
    private Integer payoutFrequencyMinutes;
    private String timesheetLoggingMode;
    private String travelClaimMode;
    private java.util.List<PayrollTaxTemplateDTO> payrollTaxTemplates;

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

    public java.util.List<PayrollTaxTemplateDTO> getPayrollTaxTemplates() {
        return payrollTaxTemplates;
    }

    public void setPayrollTaxTemplates(java.util.List<PayrollTaxTemplateDTO> payrollTaxTemplates) {
        this.payrollTaxTemplates = payrollTaxTemplates;
    }
}
