package com.pm.timesheetservice.dto;

import java.math.BigDecimal;

public class TimesheetResponseDTO {
    private String timesheetId;

    // Personal Details
    private String userId;
    private String companyId;
    private String name;

    // Date
    private String dateOfIssue;
    private Integer weekNumber;
    private Integer weekBasedYear;

    // Timesheet
    private String function;
    private BigDecimal hoursWorked;
    private BigDecimal travelExpenses;
    private String sourceScheduleEntryId;
    private String sourceShiftId;
    private String sourceProjectId;
    private String projectName;
    private String shiftName;
    private String shiftDate;
    private String shiftStartTime;
    private String shiftEndTime;
    private Integer breakMinutes;
    private BigDecimal travelKilometers;
    private BigDecimal travelRate;

    // Approval workflow
    private String status;
    private String decidedByUserId;
    private String decidedAt;
    private String decisionReason;


    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getDecidedByUserId() {
        return decidedByUserId;
    }

    public void setDecidedByUserId(String decidedByUserId) {
        this.decidedByUserId = decidedByUserId;
    }

    public String getDecidedAt() {
        return decidedAt;
    }

    public void setDecidedAt(String decidedAt) {
        this.decidedAt = decidedAt;
    }

    public String getDecisionReason() {
        return decisionReason;
    }

    public void setDecisionReason(String decisionReason) {
        this.decisionReason = decisionReason;
    }

    public String getTimesheetId() {
        return timesheetId;
    }

    public void setTimesheetId(String timesheetId) {
        this.timesheetId = timesheetId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getCompanyId() {
        return companyId;
    }

    public void setCompanyId(String companyId) {
        this.companyId = companyId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDateOfIssue() {
        return dateOfIssue;
    }

    public void setDateOfIssue(String dateOfIssue) {
        this.dateOfIssue = dateOfIssue;
    }

    public Integer getWeekNumber() {
        return weekNumber;
    }

    public void setWeekNumber(Integer weekNumber) {
        this.weekNumber = weekNumber;
    }

    public Integer getWeekBasedYear() {
        return weekBasedYear;
    }

    public void setWeekBasedYear(Integer weekBasedYear) {
        this.weekBasedYear = weekBasedYear;
    }

    public String getFunction() {
        return function;
    }

    public void setFunction(String function) {
        this.function = function;
    }

    public BigDecimal getHoursWorked() {
        return hoursWorked;
    }

    public void setHoursWorked(BigDecimal hoursWorked) {
        this.hoursWorked = hoursWorked;
    }

    public BigDecimal getTravelExpenses() {
        return travelExpenses;
    }

    public void setTravelExpenses(BigDecimal travelExpenses) {
        this.travelExpenses = travelExpenses;
    }

    public String getSourceScheduleEntryId() {
        return sourceScheduleEntryId;
    }

    public void setSourceScheduleEntryId(String sourceScheduleEntryId) {
        this.sourceScheduleEntryId = sourceScheduleEntryId;
    }

    public String getSourceShiftId() {
        return sourceShiftId;
    }

    public void setSourceShiftId(String sourceShiftId) {
        this.sourceShiftId = sourceShiftId;
    }

    public String getSourceProjectId() {
        return sourceProjectId;
    }

    public void setSourceProjectId(String sourceProjectId) {
        this.sourceProjectId = sourceProjectId;
    }

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }

    public String getShiftName() {
        return shiftName;
    }

    public void setShiftName(String shiftName) {
        this.shiftName = shiftName;
    }

    public String getShiftDate() {
        return shiftDate;
    }

    public void setShiftDate(String shiftDate) {
        this.shiftDate = shiftDate;
    }

    public String getShiftStartTime() {
        return shiftStartTime;
    }

    public void setShiftStartTime(String shiftStartTime) {
        this.shiftStartTime = shiftStartTime;
    }

    public String getShiftEndTime() {
        return shiftEndTime;
    }

    public void setShiftEndTime(String shiftEndTime) {
        this.shiftEndTime = shiftEndTime;
    }

    public Integer getBreakMinutes() {
        return breakMinutes;
    }

    public void setBreakMinutes(Integer breakMinutes) {
        this.breakMinutes = breakMinutes;
    }

    public BigDecimal getTravelKilometers() {
        return travelKilometers;
    }

    public void setTravelKilometers(BigDecimal travelKilometers) {
        this.travelKilometers = travelKilometers;
    }

    public BigDecimal getTravelRate() {
        return travelRate;
    }

    public void setTravelRate(BigDecimal travelRate) {
        this.travelRate = travelRate;
    }
}
