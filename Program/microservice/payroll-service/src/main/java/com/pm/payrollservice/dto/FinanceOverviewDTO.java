package com.pm.payrollservice.dto;

import java.math.BigDecimal;

/**
 * Company payroll-cost overview for a period, aggregated from finalized payslips.
 * The cost side is computed from real payslip data; client revenue and margin
 * (which depend on billing rates) are a later phase and are not included here.
 */
public class FinanceOverviewDTO {
    private String from;
    private String to;

    private BigDecimal totalGross;
    private BigDecimal totalNet;
    private BigDecimal totalLoonheffing;
    private BigDecimal totalEmployeeDeductions;
    private BigDecimal totalEmployeeZvw;
    private BigDecimal totalEmployerZvw;
    private BigDecimal totalEmployerInsurancePremiums;
    private BigDecimal totalPensionEmployee;
    private BigDecimal totalHolidayAllowance;     // reserved vakantietoeslag (gross x holiday %)
    private BigDecimal totalToBelastingdienst;   // loonheffing + employee Zvw + employer Zvw + premies werknemersverzekeringen
    private BigDecimal totalEmployerCost;         // gross + holiday allowance + employer Zvw + premies werknemersverzekeringen
    private BigDecimal totalHours;

    private int payslipCount;
    private int employeeCount;

    public String getFrom() { return from; }
    public void setFrom(String from) { this.from = from; }

    public String getTo() { return to; }
    public void setTo(String to) { this.to = to; }

    public BigDecimal getTotalGross() { return totalGross; }
    public void setTotalGross(BigDecimal totalGross) { this.totalGross = totalGross; }

    public BigDecimal getTotalNet() { return totalNet; }
    public void setTotalNet(BigDecimal totalNet) { this.totalNet = totalNet; }

    public BigDecimal getTotalLoonheffing() { return totalLoonheffing; }
    public void setTotalLoonheffing(BigDecimal totalLoonheffing) { this.totalLoonheffing = totalLoonheffing; }

    public BigDecimal getTotalEmployeeDeductions() { return totalEmployeeDeductions; }
    public void setTotalEmployeeDeductions(BigDecimal totalEmployeeDeductions) { this.totalEmployeeDeductions = totalEmployeeDeductions; }

    public BigDecimal getTotalEmployeeZvw() { return totalEmployeeZvw; }
    public void setTotalEmployeeZvw(BigDecimal totalEmployeeZvw) { this.totalEmployeeZvw = totalEmployeeZvw; }

    public BigDecimal getTotalEmployerZvw() { return totalEmployerZvw; }
    public void setTotalEmployerZvw(BigDecimal totalEmployerZvw) { this.totalEmployerZvw = totalEmployerZvw; }

    public BigDecimal getTotalEmployerInsurancePremiums() { return totalEmployerInsurancePremiums; }
    public void setTotalEmployerInsurancePremiums(BigDecimal totalEmployerInsurancePremiums) { this.totalEmployerInsurancePremiums = totalEmployerInsurancePremiums; }

    public BigDecimal getTotalPensionEmployee() { return totalPensionEmployee; }
    public void setTotalPensionEmployee(BigDecimal totalPensionEmployee) { this.totalPensionEmployee = totalPensionEmployee; }

    public BigDecimal getTotalHolidayAllowance() { return totalHolidayAllowance; }
    public void setTotalHolidayAllowance(BigDecimal totalHolidayAllowance) { this.totalHolidayAllowance = totalHolidayAllowance; }

    public BigDecimal getTotalToBelastingdienst() { return totalToBelastingdienst; }
    public void setTotalToBelastingdienst(BigDecimal totalToBelastingdienst) { this.totalToBelastingdienst = totalToBelastingdienst; }

    public BigDecimal getTotalEmployerCost() { return totalEmployerCost; }
    public void setTotalEmployerCost(BigDecimal totalEmployerCost) { this.totalEmployerCost = totalEmployerCost; }

    public BigDecimal getTotalHours() { return totalHours; }
    public void setTotalHours(BigDecimal totalHours) { this.totalHours = totalHours; }

    public int getPayslipCount() { return payslipCount; }
    public void setPayslipCount(int payslipCount) { this.payslipCount = payslipCount; }

    public int getEmployeeCount() { return employeeCount; }
    public void setEmployeeCount(int employeeCount) { this.employeeCount = employeeCount; }
}
