package com.pm.payrollservice.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
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
    @ElementCollection
    @CollectionTable(name = "payslip_functions",
            joinColumns = @JoinColumn(name = "payslip_id"))
    private List<PayslipFunction> functions;
    @ElementCollection
    @CollectionTable(name = "payslip_timesheets",
            joinColumns = @JoinColumn(name = "payslip_id"))
    private List<PayslipTimesheet> timesheets;
    @Column(precision = 19, scale = 2)
    private BigDecimal totalGrossAmount;
    @Column(precision = 19, scale = 2)
    private BigDecimal wageTaxWithheldTest; //TODO test tax
    @Column(precision = 19, scale = 2)
    private BigDecimal travelExpenses; //TODO travel Expenses
    @Column(precision = 19, scale = 2)
    private BigDecimal totalNetAmount;


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

    public List<PayslipFunction> getFunctions() {
        return functions;
    }

    public void setFunctions(List<PayslipFunction> functions) {
        this.functions = functions;
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


    public List<PayslipTimesheet> getTimesheets() {
        return timesheets;
    }

    public void setTimesheets(List<PayslipTimesheet> timesheets) {
        this.timesheets = timesheets;
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
}
