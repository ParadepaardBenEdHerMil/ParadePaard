package com.pm.contractservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class ContractRequestDTO {
    @NotBlank(message = "userId is required")
    private String userId;

    private String functionId;
    private String functionName;

    // Date
    @NotBlank(message = "startDate is required")
    private String startDate;
    private String endDate;

    @NotBlank(message = "contractType is required")
    private String contractType;
    private BigDecimal grossHourlyWage;
    @NotNull(message = "travelAllowance is required")
    private Boolean travelAllowance;
    private String paymentFrequency;
    private BigDecimal weeklyHours;
    private BigDecimal holidayAllowancePercentage;
    private Integer leaveEntitlementDays;
    private String workLocation;
    private String probationPeriod;
    private String noticePeriod;
    private String collectiveAgreement;
    private String pensionScheme;
    private String sicknessPolicy;
    private String confidentialityClause;

    // Tax/payroll terms resolved from the Horeca rule version at design time.
    private Boolean applyLoonheffingskorting;
    private Boolean pensionApplicable;
    private BigDecimal pensionEmployeePercentage;
    private Boolean specialZvwContribution;
    private BigDecimal zvwEmployeePercentage;

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getFunctionId() {
        return functionId;
    }

    public void setFunctionId(String functionId) {
        this.functionId = functionId;
    }

    public String getFunctionName() {
        return functionName;
    }

    public void setFunctionName(String functionName) {
        this.functionName = functionName;
    }

    public String getStartDate() {
        return startDate;
    }

    public void setStartDate(String startDate) {
        this.startDate = startDate;
    }

    public String getEndDate() {
        return endDate;
    }

    public void setEndDate(String endDate) {
        this.endDate = endDate;
    }

    public String getContractType() {
        return contractType;
    }

    public void setContractType(String contractType) {
        this.contractType = contractType;
    }

    public BigDecimal getGrossHourlyWage() {
        return grossHourlyWage;
    }

    public void setGrossHourlyWage(BigDecimal grossHourlyWage) {
        this.grossHourlyWage = grossHourlyWage;
    }

    public Boolean getTravelAllowance() {
        return travelAllowance;
    }

    public void setTravelAllowance(Boolean travelAllowance) {
        this.travelAllowance = travelAllowance;
    }

    public String getPaymentFrequency() {
        return paymentFrequency;
    }

    public void setPaymentFrequency(String paymentFrequency) {
        this.paymentFrequency = paymentFrequency;
    }

    public BigDecimal getWeeklyHours() {
        return weeklyHours;
    }

    public void setWeeklyHours(BigDecimal weeklyHours) {
        this.weeklyHours = weeklyHours;
    }

    public BigDecimal getHolidayAllowancePercentage() {
        return holidayAllowancePercentage;
    }

    public void setHolidayAllowancePercentage(BigDecimal holidayAllowancePercentage) {
        this.holidayAllowancePercentage = holidayAllowancePercentage;
    }

    public Integer getLeaveEntitlementDays() {
        return leaveEntitlementDays;
    }

    public void setLeaveEntitlementDays(Integer leaveEntitlementDays) {
        this.leaveEntitlementDays = leaveEntitlementDays;
    }

    public String getWorkLocation() {
        return workLocation;
    }

    public void setWorkLocation(String workLocation) {
        this.workLocation = workLocation;
    }

    public String getProbationPeriod() {
        return probationPeriod;
    }

    public void setProbationPeriod(String probationPeriod) {
        this.probationPeriod = probationPeriod;
    }

    public String getNoticePeriod() {
        return noticePeriod;
    }

    public void setNoticePeriod(String noticePeriod) {
        this.noticePeriod = noticePeriod;
    }

    public String getCollectiveAgreement() {
        return collectiveAgreement;
    }

    public void setCollectiveAgreement(String collectiveAgreement) {
        this.collectiveAgreement = collectiveAgreement;
    }

    public String getPensionScheme() {
        return pensionScheme;
    }

    public void setPensionScheme(String pensionScheme) {
        this.pensionScheme = pensionScheme;
    }

    public String getSicknessPolicy() {
        return sicknessPolicy;
    }

    public void setSicknessPolicy(String sicknessPolicy) {
        this.sicknessPolicy = sicknessPolicy;
    }

    public String getConfidentialityClause() {
        return confidentialityClause;
    }

    public void setConfidentialityClause(String confidentialityClause) {
        this.confidentialityClause = confidentialityClause;
    }

    public Boolean getApplyLoonheffingskorting() {
        return applyLoonheffingskorting;
    }

    public void setApplyLoonheffingskorting(Boolean applyLoonheffingskorting) {
        this.applyLoonheffingskorting = applyLoonheffingskorting;
    }

    public Boolean getPensionApplicable() {
        return pensionApplicable;
    }

    public void setPensionApplicable(Boolean pensionApplicable) {
        this.pensionApplicable = pensionApplicable;
    }

    public BigDecimal getPensionEmployeePercentage() {
        return pensionEmployeePercentage;
    }

    public void setPensionEmployeePercentage(BigDecimal pensionEmployeePercentage) {
        this.pensionEmployeePercentage = pensionEmployeePercentage;
    }

    public Boolean getSpecialZvwContribution() {
        return specialZvwContribution;
    }

    public void setSpecialZvwContribution(Boolean specialZvwContribution) {
        this.specialZvwContribution = specialZvwContribution;
    }

    public BigDecimal getZvwEmployeePercentage() {
        return zvwEmployeePercentage;
    }

    public void setZvwEmployeePercentage(BigDecimal zvwEmployeePercentage) {
        this.zvwEmployeePercentage = zvwEmployeePercentage;
    }
}
