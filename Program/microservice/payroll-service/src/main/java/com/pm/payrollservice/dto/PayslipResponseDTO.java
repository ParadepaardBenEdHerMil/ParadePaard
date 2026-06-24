// PayslipResponseDTO.java
package com.pm.payrollservice.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public class PayslipResponseDTO {
    private String payslipId;

    // Date
    private String dateOfIssue;
    private Integer weekNumber;
    private Integer weekBasedYear;
    private String paymentDate;
    private Integer fiscalYear;

    // Payslip Details
    private String functionName;
    private BigDecimal hourlyWage;
    private BigDecimal totalHoursWorked;
    private BigDecimal totalGrossAmount;
    private BigDecimal wageTaxWithheldTest;
    private BigDecimal wageTaxWithheldAmount;
    private BigDecimal travelExpenses;
    private BigDecimal totalEmployeeDeductions;
    private BigDecimal totalNetAmount;
    private String status;
    private String availableToUserAt;
    private String generatedAt;
    private String errorDescription;
    private String contractId;
    private String contractType;
    private String paymentFrequency;
    private String contractStartDate;
    private String contractEndDate;
    private BigDecimal weeklyHours;
    private BigDecimal holidayAllowancePercentage;
    private String payPeriodKey;
    private String payPeriodStart;
    private String payPeriodEnd;
    private java.util.List<PayrollDeductionLineDTO> deductionLines;


    // Personal Details
    private String userId;
    private String name;
    private String dateOfBirth;
    private String startDate;
    private String streetName;
    private String houseNumber;
    private String houseNumberSuffix;
    private String postalCode;
    private String city;
    private String country;

    public String getPayslipId() {
        return payslipId;
    }

    public String getDateOfBirth() {
        return dateOfBirth;
    }

    public String getStartDate() {
        return startDate;
    }

    public void setStartDate(String startDate) {
        this.startDate = startDate;
    }

    public void setPayslipId(String payslipId) {
        this.payslipId = payslipId;
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

    public String getPaymentDate() {
        return paymentDate;
    }

    public void setPaymentDate(String paymentDate) {
        this.paymentDate = paymentDate;
    }

    public Integer getFiscalYear() {
        return fiscalYear;
    }

    public void setFiscalYear(Integer fiscalYear) {
        this.fiscalYear = fiscalYear;
    }

    public BigDecimal getTotalGrossAmount() {
        return totalGrossAmount;
    }

    public void setTotalGrossAmount(BigDecimal totalGrossAmount) {
        this.totalGrossAmount = totalGrossAmount;
    }

    public BigDecimal getWageTaxWithheldTest() {
        return wageTaxWithheldTest;
    }

    public void setWageTaxWithheldTest(BigDecimal wageTaxWithheldTest) {
        this.wageTaxWithheldTest = wageTaxWithheldTest;
    }

    public BigDecimal getWageTaxWithheldAmount() {
        return wageTaxWithheldAmount;
    }

    public void setWageTaxWithheldAmount(BigDecimal wageTaxWithheldAmount) {
        this.wageTaxWithheldAmount = wageTaxWithheldAmount;
    }

    public BigDecimal getTotalNetAmount() {
        return totalNetAmount;
    }

    public void setTotalNetAmount(BigDecimal totalNetAmount) {
        this.totalNetAmount = totalNetAmount;
    }

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

    public String getDateOfBirth(LocalDate dateOfBirth) {
        return this.dateOfBirth;
    }

    public void setDateOfBirth(String dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public String getStreetName() {
        return streetName;
    }

    public void setStreetName(String streetName) {
        this.streetName = streetName;
    }

    public String getHouseNumber() {
        return houseNumber;
    }

    public void setHouseNumber(String houseNumber) {
        this.houseNumber = houseNumber;
    }

    public String getHouseNumberSuffix() {
        return houseNumberSuffix;
    }

    public void setHouseNumberSuffix(String houseNumberSuffix) {
        this.houseNumberSuffix = houseNumberSuffix;
    }

    public String getPostalCode() {
        return postalCode;
    }

    public void setPostalCode(String postalCode) {
        this.postalCode = postalCode;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
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

    public BigDecimal getTravelExpenses() {
        return travelExpenses;
    }

    public void setTravelExpenses(BigDecimal travelExpenses) {
        this.travelExpenses = travelExpenses;
    }

    public BigDecimal getTotalEmployeeDeductions() {
        return totalEmployeeDeductions;
    }

    public void setTotalEmployeeDeductions(BigDecimal totalEmployeeDeductions) {
        this.totalEmployeeDeductions = totalEmployeeDeductions;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getAvailableToUserAt() {
        return availableToUserAt;
    }

    public void setAvailableToUserAt(String availableToUserAt) {
        this.availableToUserAt = availableToUserAt;
    }

    public String getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(String generatedAt) {
        this.generatedAt = generatedAt;
    }

    public String getErrorDescription() {
        return errorDescription;
    }

    public void setErrorDescription(String errorDescription) {
        this.errorDescription = errorDescription;
    }

    public String getContractId() {
        return contractId;
    }

    public void setContractId(String contractId) {
        this.contractId = contractId;
    }

    public String getContractType() {
        return contractType;
    }

    public void setContractType(String contractType) {
        this.contractType = contractType;
    }

    public String getPaymentFrequency() {
        return paymentFrequency;
    }

    public void setPaymentFrequency(String paymentFrequency) {
        this.paymentFrequency = paymentFrequency;
    }

    public String getContractStartDate() {
        return contractStartDate;
    }

    public void setContractStartDate(String contractStartDate) {
        this.contractStartDate = contractStartDate;
    }

    public String getContractEndDate() {
        return contractEndDate;
    }

    public void setContractEndDate(String contractEndDate) {
        this.contractEndDate = contractEndDate;
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

    public String getPayPeriodKey() {
        return payPeriodKey;
    }

    public void setPayPeriodKey(String payPeriodKey) {
        this.payPeriodKey = payPeriodKey;
    }

    public String getPayPeriodStart() {
        return payPeriodStart;
    }

    public void setPayPeriodStart(String payPeriodStart) {
        this.payPeriodStart = payPeriodStart;
    }

    public String getPayPeriodEnd() {
        return payPeriodEnd;
    }

    public void setPayPeriodEnd(String payPeriodEnd) {
        this.payPeriodEnd = payPeriodEnd;
    }

    public java.util.List<PayrollDeductionLineDTO> getDeductionLines() {
        return deductionLines;
    }

    public void setDeductionLines(java.util.List<PayrollDeductionLineDTO> deductionLines) {
        this.deductionLines = deductionLines;
    }
}
