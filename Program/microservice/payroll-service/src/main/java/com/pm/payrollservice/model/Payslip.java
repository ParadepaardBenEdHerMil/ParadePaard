package com.pm.payrollservice.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "payslips")
public class Payslip {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(nullable = false)
    private UUID payslipId;

    // Date
    @Column(nullable = false)
    private LocalDate dateOfIssue;
    private Integer weekNumber;
    private Integer weekBasedYear;

    // Payslip Details
    @Column
    private String functionName;
    @Column(precision = 19, scale = 2)
    private BigDecimal hourlyWage;
    @Column(precision = 19, scale = 2)
    private BigDecimal totalHoursWorked;
    @Column(precision = 19, scale = 2)
    private BigDecimal totalGrossAmount;
    @Column(precision = 19, scale = 2)
    private BigDecimal wageTaxWithheldTest; //TODO test tax
    @Column(precision = 19, scale = 2)
    private BigDecimal travelExpenses; //TODO travel Expenses
    @Column(precision = 19, scale = 2)
    private BigDecimal totalEmployeeDeductions;
    @Column(precision = 19, scale = 2)
    private BigDecimal totalNetAmount;

    @Column(name = "deduction_lines_json", columnDefinition = "TEXT")
    private String deductionLinesJson;

    @Enumerated(EnumType.STRING)
    @Column(length = 40)
    private PayslipStatus status;

    @Column(length = 2000)
    private String errorDescription;

    private LocalDate availableToUserAt;

    private OffsetDateTime generatedAt;


    // Personal Details
    @Column(nullable = false)
    private UUID userId;
    private String name;
    private LocalDate dateOfBirth;
    private LocalDate startDate;
    private String streetName;
    private String houseNumber;
    private String houseNumberSuffix;
    private String postalCode;
    private String city;
    private String country;

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public UUID getPayslipId() {
        return payslipId;
    }

    public void setPayslipId(UUID payslipId) {
        this.payslipId = payslipId;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public LocalDate getDateOfIssue() {
        return dateOfIssue;
    }

    public void setDateOfIssue(LocalDate dateOfIssue) {
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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
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

    public PayslipStatus getStatus() {
        return status;
    }

    public void setStatus(PayslipStatus status) {
        this.status = status;
    }

    public String getErrorDescription() {
        return errorDescription;
    }

    public void setErrorDescription(String errorDescription) {
        this.errorDescription = errorDescription;
    }

    public LocalDate getAvailableToUserAt() {
        return availableToUserAt;
    }

    public void setAvailableToUserAt(LocalDate availableToUserAt) {
        this.availableToUserAt = availableToUserAt;
    }

    public OffsetDateTime getGeneratedAt() {
        return generatedAt;
    }

    public String getDeductionLinesJson() {
        return deductionLinesJson;
    }

    public void setDeductionLinesJson(String deductionLinesJson) {
        this.deductionLinesJson = deductionLinesJson;
    }

    public void setGeneratedAt(OffsetDateTime generatedAt) {
        this.generatedAt = generatedAt;
    }
}
