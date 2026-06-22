package com.pm.payrollservice.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Company-wide annual roll-up of all employees' loonstaten (verzamelloonstaat).
 * The totals equal the sum of every employee's jaaropgaaf for the year.
 */
public class VerzamelloonstaatDTO {
    private int year;
    private String companyId;
    private String employerName;
    private int employeeCount;

    private BigDecimal totalFiscalWage;
    private BigDecimal totalLoonheffing;
    private BigDecimal totalArbeidskortingApplied;
    private BigDecimal totalEmployeeZvwWithheld;
    private BigDecimal totalEmployerZvwLevy;
    private BigDecimal totalEmployerInsurancePremiums;
    private BigDecimal totalPensionEmployee;
    private BigDecimal totalGross;
    private BigDecimal totalNet;

    private List<JaaropgaafDTO> employees;

    public int getYear() { return year; }
    public void setYear(int year) { this.year = year; }

    public String getCompanyId() { return companyId; }
    public void setCompanyId(String companyId) { this.companyId = companyId; }

    public String getEmployerName() { return employerName; }
    public void setEmployerName(String employerName) { this.employerName = employerName; }

    public int getEmployeeCount() { return employeeCount; }
    public void setEmployeeCount(int employeeCount) { this.employeeCount = employeeCount; }

    public BigDecimal getTotalFiscalWage() { return totalFiscalWage; }
    public void setTotalFiscalWage(BigDecimal totalFiscalWage) { this.totalFiscalWage = totalFiscalWage; }

    public BigDecimal getTotalLoonheffing() { return totalLoonheffing; }
    public void setTotalLoonheffing(BigDecimal totalLoonheffing) { this.totalLoonheffing = totalLoonheffing; }

    public BigDecimal getTotalArbeidskortingApplied() { return totalArbeidskortingApplied; }
    public void setTotalArbeidskortingApplied(BigDecimal totalArbeidskortingApplied) { this.totalArbeidskortingApplied = totalArbeidskortingApplied; }

    public BigDecimal getTotalEmployeeZvwWithheld() { return totalEmployeeZvwWithheld; }
    public void setTotalEmployeeZvwWithheld(BigDecimal totalEmployeeZvwWithheld) { this.totalEmployeeZvwWithheld = totalEmployeeZvwWithheld; }

    public BigDecimal getTotalEmployerZvwLevy() { return totalEmployerZvwLevy; }
    public void setTotalEmployerZvwLevy(BigDecimal totalEmployerZvwLevy) { this.totalEmployerZvwLevy = totalEmployerZvwLevy; }

    public BigDecimal getTotalEmployerInsurancePremiums() { return totalEmployerInsurancePremiums; }
    public void setTotalEmployerInsurancePremiums(BigDecimal totalEmployerInsurancePremiums) { this.totalEmployerInsurancePremiums = totalEmployerInsurancePremiums; }

    public BigDecimal getTotalPensionEmployee() { return totalPensionEmployee; }
    public void setTotalPensionEmployee(BigDecimal totalPensionEmployee) { this.totalPensionEmployee = totalPensionEmployee; }

    public BigDecimal getTotalGross() { return totalGross; }
    public void setTotalGross(BigDecimal totalGross) { this.totalGross = totalGross; }

    public BigDecimal getTotalNet() { return totalNet; }
    public void setTotalNet(BigDecimal totalNet) { this.totalNet = totalNet; }

    public List<JaaropgaafDTO> getEmployees() { return employees; }
    public void setEmployees(List<JaaropgaafDTO> employees) { this.employees = employees; }
}
