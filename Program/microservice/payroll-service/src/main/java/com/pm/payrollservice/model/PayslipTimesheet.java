package com.pm.payrollservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Embeddable
public class PayslipTimesheet {
    private UUID functionId;
    private UUID timesheetId;
    private LocalDate dateOfIssue;
    private String functionName;
    @Column(precision = 19, scale = 2)
    private BigDecimal hoursWorked;
    @Column(precision = 19, scale = 2)
    private BigDecimal hourlyWage;
    @Column(precision = 19, scale = 2)
    private BigDecimal travelExpenses;

    public UUID getFunctionId() {
        return functionId;
    }

    public void setFunctionId(UUID functionId) {
        this.functionId = functionId;
    }

    public UUID getTimesheetId() {
        return timesheetId;
    }

    public void setTimesheetId(UUID timesheetId) {
        this.timesheetId = timesheetId;
    }

    public LocalDate getDateOfIssue() {
        return dateOfIssue;
    }

    public void setDateOfIssue(LocalDate dateOfIssue) {
        this.dateOfIssue = dateOfIssue;
    }

    public String getFunctionName() {
        return functionName;
    }

    public void setFunctionName(String functionName) {
        this.functionName = functionName;
    }

    public BigDecimal getHoursWorked() {
        return hoursWorked;
    }

    public void setHoursWorked(BigDecimal hoursWorked) {
        this.hoursWorked = hoursWorked;
    }

    public BigDecimal getHourlyWage() {
        return hourlyWage;
    }

    public void setHourlyWage(BigDecimal hourlyWage) {
        this.hourlyWage = hourlyWage;
    }

    public BigDecimal getTravelExpenses() {
        return travelExpenses;
    }

    public void setTravelExpenses(BigDecimal travelExpenses) {
        this.travelExpenses = travelExpenses;
    }
}
