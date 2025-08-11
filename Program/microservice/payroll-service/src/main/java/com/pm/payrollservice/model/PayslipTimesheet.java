package com.pm.payrollservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Embeddable
public class PayslipTimesheet {
    @Column(nullable = false)
    private UUID timesheetId;
    @Column(nullable = false)
    private LocalDate dateOfIssue;
    @Column(nullable = false)
    private String function;
    @Column(precision = 19, scale = 2, nullable = false)
    private BigDecimal hoursWorked;
    @Column(precision = 19, scale = 2)
    private BigDecimal travelExpenses;

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
}
