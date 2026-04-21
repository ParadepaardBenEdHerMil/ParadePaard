// PayslipRequestDTO.java
package com.pm.payrollservice.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

public class PayslipRequestDTO {
    @NotBlank(message = "userId is required")
    private String userId;
    private String dateOfIssue; // expect ISO yyyy-MM-dd
    private String functionName;
    private BigDecimal hourlyWage;
    @JsonAlias("hoursWorked")
    private BigDecimal totalHoursWorked; // total hours for the period
    private BigDecimal wageTaxWithheldTest;
    private BigDecimal wageTaxWithheldAmount;
    private BigDecimal travelExpenses;
    private String status;
    private String errorDescription;
    private java.util.List<PayrollDeductionLineDTO> deductionLines;

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getDateOfIssue() {
        return dateOfIssue;
    }

    public void setDateOfIssue(String dateOfIssue) {
        this.dateOfIssue = dateOfIssue;
    }

    public String getFunctionName() {
        return functionName;
    }

    public void setFunctionName(String functionName) {
        this.functionName = functionName;
    }

    public BigDecimal getHourlyWage() {
        return hourlyWage;
    }

    public void setHourlyWage(BigDecimal hourlyWage) {
        this.hourlyWage = hourlyWage;
    }

    public BigDecimal getTotalHoursWorked() {
        return totalHoursWorked;
    }

    public void setTotalHoursWorked(BigDecimal totalHoursWorked) {
        this.totalHoursWorked = totalHoursWorked;
    }

    public BigDecimal getWageTaxWithheldTest() {
        return wageTaxWithheldTest;
    }

    public void setWageTaxWithheldTest(BigDecimal wageTaxWithheldTest) {
        this.wageTaxWithheldTest = wageTaxWithheldTest;
    }

    public BigDecimal getTravelExpenses() {
        return travelExpenses;
    }

    public void setTravelExpenses(BigDecimal travelExpenses) {
        this.travelExpenses = travelExpenses;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getErrorDescription() {
        return errorDescription;
    }

    public void setErrorDescription(String errorDescription) {
        this.errorDescription = errorDescription;
    }

    public java.util.List<PayrollDeductionLineDTO> getDeductionLines() {
        return deductionLines;
    }

    public void setDeductionLines(java.util.List<PayrollDeductionLineDTO> deductionLines) {
        this.deductionLines = deductionLines;
    }

    public BigDecimal getWageTaxWithheldAmount() {
        return wageTaxWithheldAmount;
    }

    public void setWageTaxWithheldAmount(BigDecimal wageTaxWithheldAmount) {
        this.wageTaxWithheldAmount = wageTaxWithheldAmount;
    }
}
