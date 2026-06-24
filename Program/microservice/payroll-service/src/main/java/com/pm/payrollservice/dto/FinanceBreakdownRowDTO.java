package com.pm.payrollservice.dto;

import java.math.BigDecimal;

/** One grouped row of the payroll-cost breakdown (by employee, function, or month). */
public class FinanceBreakdownRowDTO {
    private String label;
    private String groupId;
    private BigDecimal gross;
    private BigDecimal net;
    private BigDecimal loonheffing;
    private BigDecimal employerCost;
    private BigDecimal hours;
    private int payslipCount;

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public String getGroupId() { return groupId; }
    public void setGroupId(String groupId) { this.groupId = groupId; }

    public BigDecimal getGross() { return gross; }
    public void setGross(BigDecimal gross) { this.gross = gross; }

    public BigDecimal getNet() { return net; }
    public void setNet(BigDecimal net) { this.net = net; }

    public BigDecimal getLoonheffing() { return loonheffing; }
    public void setLoonheffing(BigDecimal loonheffing) { this.loonheffing = loonheffing; }

    public BigDecimal getEmployerCost() { return employerCost; }
    public void setEmployerCost(BigDecimal employerCost) { this.employerCost = employerCost; }

    public BigDecimal getHours() { return hours; }
    public void setHours(BigDecimal hours) { this.hours = hours; }

    public int getPayslipCount() { return payslipCount; }
    public void setPayslipCount(int payslipCount) { this.payslipCount = payslipCount; }
}
