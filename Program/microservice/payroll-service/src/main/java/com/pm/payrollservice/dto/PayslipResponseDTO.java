// PayslipResponseDTO.java
package com.pm.payrollservice.dto;

import com.pm.payrollservice.model.PayslipFunction;
import com.pm.payrollservice.model.PayslipTimesheet;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public class PayslipResponseDTO {
    private String payslipId;

    // Date
    private String dateOfIssue;
    private Integer weekNumber;
    private Integer weekBasedYear;

    // Payslip Details
    private List<PayslipFunction> functions;
    private List<PayslipTimesheet> timesheet;
    private BigDecimal totalGrossAmount;
    private BigDecimal wageTaxWithheldTest;
    private BigDecimal totalNetAmount;


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

    public List<PayslipFunction> getFunctions() {
        return functions;
    }

    public void setFunctions(List<PayslipFunction> functions) {
        this.functions = functions;
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

    public List<PayslipTimesheet> getTimesheet() {
        return timesheet;
    }

    public void setTimesheet(List<PayslipTimesheet> timesheet) {
        this.timesheet = timesheet;
    }
}
