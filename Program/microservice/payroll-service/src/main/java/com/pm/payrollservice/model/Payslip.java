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

    // Whether the loonheffingskorting (tax credits) is applied for this employee.
    // Drives the loonheffing amount; only one employer may apply it.
    @Column(name = "apply_loonheffingskorting")
    private Boolean applyLoonheffingskorting;

    // ---- Jaaropgaaf / loonstaat components (per period, summed for the year) ----
    @Column(length = 9)
    private String bsn;
    @Column(name = "company_id")
    private UUID companyId;
    // Fiscaal loon (loon voor de loonheffing) = gross minus pre-tax deductions.
    @Column(name = "fiscal_wage", precision = 19, scale = 2)
    private BigDecimal fiscalWage;
    // Verrekende arbeidskorting settled in this period.
    @Column(name = "arbeidskorting_applied", precision = 19, scale = 2)
    private BigDecimal arbeidskortingApplied;
    // Ingehouden bijdrage Zvw (employee), if any.
    @Column(name = "employee_zvw_withheld", precision = 19, scale = 2)
    private BigDecimal employeeZvwWithheld;
    // Werkgeversheffing Zvw (employer levy).
    @Column(name = "employer_zvw_levy", precision = 19, scale = 2)
    private BigDecimal employerZvwLevy;
    // Premies werknemersverzekeringen (employer).
    @Column(name = "employer_insurance_premiums", precision = 19, scale = 2)
    private BigDecimal employerInsurancePremiums;

    @Enumerated(EnumType.STRING)
    @Column(length = 40)
    private PayslipStatus status;

    @Column(length = 2000)
    private String errorDescription;

    private LocalDate availableToUserAt;

    private OffsetDateTime generatedAt;

    private UUID contractId;
    private String contractType;
    private String paymentFrequency;
    private LocalDate contractStartDate;
    private LocalDate contractEndDate;
    @Column(precision = 5, scale = 2)
    private BigDecimal weeklyHours;
    @Column(precision = 5, scale = 2)
    private BigDecimal holidayAllowancePercentage;
    @Column(length = 120)
    private String payPeriodKey;
    private LocalDate payPeriodStart;
    private LocalDate payPeriodEnd;

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

    public Boolean getApplyLoonheffingskorting() {
        return applyLoonheffingskorting;
    }

    public void setApplyLoonheffingskorting(Boolean applyLoonheffingskorting) {
        this.applyLoonheffingskorting = applyLoonheffingskorting;
    }

    public String getBsn() {
        return bsn;
    }

    public void setBsn(String bsn) {
        this.bsn = bsn;
    }

    public UUID getCompanyId() {
        return companyId;
    }

    public void setCompanyId(UUID companyId) {
        this.companyId = companyId;
    }

    public BigDecimal getFiscalWage() {
        return fiscalWage;
    }

    public void setFiscalWage(BigDecimal fiscalWage) {
        this.fiscalWage = fiscalWage;
    }

    public BigDecimal getArbeidskortingApplied() {
        return arbeidskortingApplied;
    }

    public void setArbeidskortingApplied(BigDecimal arbeidskortingApplied) {
        this.arbeidskortingApplied = arbeidskortingApplied;
    }

    public BigDecimal getEmployeeZvwWithheld() {
        return employeeZvwWithheld;
    }

    public void setEmployeeZvwWithheld(BigDecimal employeeZvwWithheld) {
        this.employeeZvwWithheld = employeeZvwWithheld;
    }

    public BigDecimal getEmployerZvwLevy() {
        return employerZvwLevy;
    }

    public void setEmployerZvwLevy(BigDecimal employerZvwLevy) {
        this.employerZvwLevy = employerZvwLevy;
    }

    public BigDecimal getEmployerInsurancePremiums() {
        return employerInsurancePremiums;
    }

    public void setEmployerInsurancePremiums(BigDecimal employerInsurancePremiums) {
        this.employerInsurancePremiums = employerInsurancePremiums;
    }

    public void setGeneratedAt(OffsetDateTime generatedAt) {
        this.generatedAt = generatedAt;
    }

    public UUID getContractId() {
        return contractId;
    }

    public void setContractId(UUID contractId) {
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

    public LocalDate getContractStartDate() {
        return contractStartDate;
    }

    public void setContractStartDate(LocalDate contractStartDate) {
        this.contractStartDate = contractStartDate;
    }

    public LocalDate getContractEndDate() {
        return contractEndDate;
    }

    public void setContractEndDate(LocalDate contractEndDate) {
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

    public LocalDate getPayPeriodStart() {
        return payPeriodStart;
    }

    public void setPayPeriodStart(LocalDate payPeriodStart) {
        this.payPeriodStart = payPeriodStart;
    }

    public LocalDate getPayPeriodEnd() {
        return payPeriodEnd;
    }

    public void setPayPeriodEnd(LocalDate payPeriodEnd) {
        this.payPeriodEnd = payPeriodEnd;
    }
}
