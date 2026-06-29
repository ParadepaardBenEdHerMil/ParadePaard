package com.pm.timesheetservice.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;

public class TimesheetRequestDTO {
    // Personal Details
    @NotBlank(message = "userId is required")
    private String userId;
    @NotBlank(message = "name is required")
    private String name;

    // Date
    @NotBlank(message = "dateOfIssue is required")
    @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}", message = "dateOfIssue must be an ISO date (yyyy-MM-dd)")
    private String dateOfIssue;

    // Timesheet
    private String function;
    // Hours may legitimately be 0.00 (e.g. a travel-only period, see payroll PY-1),
    // but must never be negative.
    @NotNull(message = "hoursWorked is required")
    @DecimalMin(value = "0.0", message = "hoursWorked cannot be negative")
    private BigDecimal hoursWorked;
    @DecimalMin(value = "0.0", message = "travelExpenses cannot be negative")
    private BigDecimal travelExpenses;
    private String sourceScheduleEntryId;
    private String sourceShiftId;
    private String sourceProjectId;
    private String projectName;
    private String shiftName;
    private String shiftDate;
    private String shiftStartTime;
    private String shiftEndTime;
    @Min(value = 0, message = "breakMinutes cannot be negative")
    private Integer breakMinutes;
    @DecimalMin(value = "0.0", message = "travelKilometers cannot be negative")
    private BigDecimal travelKilometers;
    @DecimalMin(value = "0.0", message = "travelRate cannot be negative")
    private BigDecimal travelRate;

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
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
