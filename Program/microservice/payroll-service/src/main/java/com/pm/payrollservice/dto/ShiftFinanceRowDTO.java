package com.pm.payrollservice.dto;

import java.math.BigDecimal;

/** Per-shift revenue/cost/margin row (ESTIMATED compute-on-read). */
public class ShiftFinanceRowDTO {
    private String timesheetId;
    private String userId;
    private String projectId;
    private String projectName;
    private String clientCompanyId;
    private String clientName;
    private String function;
    private String shiftDate;
    private BigDecimal hours;
    private BigDecimal hourlyWage;
    private BigDecimal grossWage;
    private BigDecimal holidayAllowance;
    private BigDecimal employerZvw;
    private BigDecimal employerInsurancePremiums;
    private BigDecimal totalEmployerCost;
    private BigDecimal ratePerHour;
    private BigDecimal clientRevenue;
    private BigDecimal margin;
    private BigDecimal marginPercentage;
    private String marginStatus;
    private String rateSource;
    private String tag;

    public String getTimesheetId() { return timesheetId; }
    public void setTimesheetId(String v) { this.timesheetId = v; }
    public String getUserId() { return userId; }
    public void setUserId(String v) { this.userId = v; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String v) { this.projectId = v; }
    public String getProjectName() { return projectName; }
    public void setProjectName(String v) { this.projectName = v; }
    public String getClientCompanyId() { return clientCompanyId; }
    public void setClientCompanyId(String v) { this.clientCompanyId = v; }
    public String getClientName() { return clientName; }
    public void setClientName(String v) { this.clientName = v; }
    public String getFunction() { return function; }
    public void setFunction(String v) { this.function = v; }
    public String getShiftDate() { return shiftDate; }
    public void setShiftDate(String v) { this.shiftDate = v; }
    public BigDecimal getHours() { return hours; }
    public void setHours(BigDecimal v) { this.hours = v; }
    public BigDecimal getHourlyWage() { return hourlyWage; }
    public void setHourlyWage(BigDecimal v) { this.hourlyWage = v; }
    public BigDecimal getGrossWage() { return grossWage; }
    public void setGrossWage(BigDecimal v) { this.grossWage = v; }
    public BigDecimal getHolidayAllowance() { return holidayAllowance; }
    public void setHolidayAllowance(BigDecimal v) { this.holidayAllowance = v; }
    public BigDecimal getEmployerZvw() { return employerZvw; }
    public void setEmployerZvw(BigDecimal v) { this.employerZvw = v; }
    public BigDecimal getEmployerInsurancePremiums() { return employerInsurancePremiums; }
    public void setEmployerInsurancePremiums(BigDecimal v) { this.employerInsurancePremiums = v; }
    public BigDecimal getTotalEmployerCost() { return totalEmployerCost; }
    public void setTotalEmployerCost(BigDecimal v) { this.totalEmployerCost = v; }
    public BigDecimal getRatePerHour() { return ratePerHour; }
    public void setRatePerHour(BigDecimal v) { this.ratePerHour = v; }
    public BigDecimal getClientRevenue() { return clientRevenue; }
    public void setClientRevenue(BigDecimal v) { this.clientRevenue = v; }
    public BigDecimal getMargin() { return margin; }
    public void setMargin(BigDecimal v) { this.margin = v; }
    public BigDecimal getMarginPercentage() { return marginPercentage; }
    public void setMarginPercentage(BigDecimal v) { this.marginPercentage = v; }
    public String getMarginStatus() { return marginStatus; }
    public void setMarginStatus(String v) { this.marginStatus = v; }
    public String getRateSource() { return rateSource; }
    public void setRateSource(String v) { this.rateSource = v; }
    public String getTag() { return tag; }
    public void setTag(String v) { this.tag = v; }
}
