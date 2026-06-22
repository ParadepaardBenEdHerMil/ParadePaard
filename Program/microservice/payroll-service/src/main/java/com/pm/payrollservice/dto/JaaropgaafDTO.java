package com.pm.payrollservice.dto;

import java.math.BigDecimal;

/**
 * Dutch year-end employee statement (jaaropgaaf). All money fields are the sum
 * of the employee's finalized payslips for the calendar year, so the totals
 * reconcile with the periodic loonaangiften. This is the statement the employer
 * gives to the employee for their income-tax return; it is vormvrij (free
 * format) and is not filed directly to the Belastingdienst.
 */
public class JaaropgaafDTO {
    private int year;

    // Employer block
    private String employerName;
    private String employerStreet;
    private String employerPostalCode;
    private String employerCity;
    private String employerCountry;

    // Employee block
    private String userId;
    private String employeeName;
    private String dateOfBirth;
    private String bsn;            // masked unless the caller may view identification
    private boolean bsnMasked;
    private String street;
    private String houseNumber;
    private String houseNumberSuffix;
    private String postalCode;
    private String city;
    private String country;

    // Mandatory amounts (annual sums)
    private BigDecimal fiscalWage;                 // loon voor de loonheffing
    private BigDecimal loonheffing;                // ingehouden loonbelasting/premie volksverzekeringen
    private BigDecimal arbeidskortingApplied;      // verrekende arbeidskorting
    private BigDecimal employeeZvwWithheld;        // ingehouden bijdrage Zvw
    private BigDecimal employerZvwLevy;            // werkgeversheffing Zvw
    private BigDecimal employerInsurancePremiums;  // premies werknemersverzekeringen (employer)
    private boolean loonheffingskortingApplied;
    private String loonheffingskortingFrom;        // earliest period the credit was applied

    // Optional / informational
    private BigDecimal pensionEmployee;            // werknemersdeel pensioenpremie
    private BigDecimal travelReimbursement;
    private BigDecimal hoursWorked;
    private BigDecimal holidayAllowancePercentage;
    private BigDecimal totalGross;
    private BigDecimal totalNet;
    private int payslipCount;

    public int getYear() { return year; }
    public void setYear(int year) { this.year = year; }

    public String getEmployerName() { return employerName; }
    public void setEmployerName(String employerName) { this.employerName = employerName; }

    public String getEmployerStreet() { return employerStreet; }
    public void setEmployerStreet(String employerStreet) { this.employerStreet = employerStreet; }

    public String getEmployerPostalCode() { return employerPostalCode; }
    public void setEmployerPostalCode(String employerPostalCode) { this.employerPostalCode = employerPostalCode; }

    public String getEmployerCity() { return employerCity; }
    public void setEmployerCity(String employerCity) { this.employerCity = employerCity; }

    public String getEmployerCountry() { return employerCountry; }
    public void setEmployerCountry(String employerCountry) { this.employerCountry = employerCountry; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }

    public String getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(String dateOfBirth) { this.dateOfBirth = dateOfBirth; }

    public String getBsn() { return bsn; }
    public void setBsn(String bsn) { this.bsn = bsn; }

    public boolean isBsnMasked() { return bsnMasked; }
    public void setBsnMasked(boolean bsnMasked) { this.bsnMasked = bsnMasked; }

    public String getStreet() { return street; }
    public void setStreet(String street) { this.street = street; }

    public String getHouseNumber() { return houseNumber; }
    public void setHouseNumber(String houseNumber) { this.houseNumber = houseNumber; }

    public String getHouseNumberSuffix() { return houseNumberSuffix; }
    public void setHouseNumberSuffix(String houseNumberSuffix) { this.houseNumberSuffix = houseNumberSuffix; }

    public String getPostalCode() { return postalCode; }
    public void setPostalCode(String postalCode) { this.postalCode = postalCode; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }

    public BigDecimal getFiscalWage() { return fiscalWage; }
    public void setFiscalWage(BigDecimal fiscalWage) { this.fiscalWage = fiscalWage; }

    public BigDecimal getLoonheffing() { return loonheffing; }
    public void setLoonheffing(BigDecimal loonheffing) { this.loonheffing = loonheffing; }

    public BigDecimal getArbeidskortingApplied() { return arbeidskortingApplied; }
    public void setArbeidskortingApplied(BigDecimal arbeidskortingApplied) { this.arbeidskortingApplied = arbeidskortingApplied; }

    public BigDecimal getEmployeeZvwWithheld() { return employeeZvwWithheld; }
    public void setEmployeeZvwWithheld(BigDecimal employeeZvwWithheld) { this.employeeZvwWithheld = employeeZvwWithheld; }

    public BigDecimal getEmployerZvwLevy() { return employerZvwLevy; }
    public void setEmployerZvwLevy(BigDecimal employerZvwLevy) { this.employerZvwLevy = employerZvwLevy; }

    public BigDecimal getEmployerInsurancePremiums() { return employerInsurancePremiums; }
    public void setEmployerInsurancePremiums(BigDecimal employerInsurancePremiums) { this.employerInsurancePremiums = employerInsurancePremiums; }

    public boolean isLoonheffingskortingApplied() { return loonheffingskortingApplied; }
    public void setLoonheffingskortingApplied(boolean loonheffingskortingApplied) { this.loonheffingskortingApplied = loonheffingskortingApplied; }

    public String getLoonheffingskortingFrom() { return loonheffingskortingFrom; }
    public void setLoonheffingskortingFrom(String loonheffingskortingFrom) { this.loonheffingskortingFrom = loonheffingskortingFrom; }

    public BigDecimal getPensionEmployee() { return pensionEmployee; }
    public void setPensionEmployee(BigDecimal pensionEmployee) { this.pensionEmployee = pensionEmployee; }

    public BigDecimal getTravelReimbursement() { return travelReimbursement; }
    public void setTravelReimbursement(BigDecimal travelReimbursement) { this.travelReimbursement = travelReimbursement; }

    public BigDecimal getHoursWorked() { return hoursWorked; }
    public void setHoursWorked(BigDecimal hoursWorked) { this.hoursWorked = hoursWorked; }

    public BigDecimal getHolidayAllowancePercentage() { return holidayAllowancePercentage; }
    public void setHolidayAllowancePercentage(BigDecimal holidayAllowancePercentage) { this.holidayAllowancePercentage = holidayAllowancePercentage; }

    public BigDecimal getTotalGross() { return totalGross; }
    public void setTotalGross(BigDecimal totalGross) { this.totalGross = totalGross; }

    public BigDecimal getTotalNet() { return totalNet; }
    public void setTotalNet(BigDecimal totalNet) { this.totalNet = totalNet; }

    public int getPayslipCount() { return payslipCount; }
    public void setPayslipCount(int payslipCount) { this.payslipCount = payslipCount; }
}
