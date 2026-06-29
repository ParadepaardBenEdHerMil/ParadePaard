package com.pm.payrollservice.dto;

import java.math.BigDecimal;

/** Revenue/margin grouped by client, project, employee, function or month. */
public class MarginBreakdownRowDTO {
    private String groupId;
    private String label;
    private BigDecimal revenue;
    private BigDecimal employerCost;
    private BigDecimal margin;
    private BigDecimal marginPercentage;
    private BigDecimal hours;
    private int shiftCount;
    private int missingRateCount;
    private int negativeMarginCount;

    public String getGroupId() { return groupId; }
    public void setGroupId(String v) { this.groupId = v; }
    public String getLabel() { return label; }
    public void setLabel(String v) { this.label = v; }
    public BigDecimal getRevenue() { return revenue; }
    public void setRevenue(BigDecimal v) { this.revenue = v; }
    public BigDecimal getEmployerCost() { return employerCost; }
    public void setEmployerCost(BigDecimal v) { this.employerCost = v; }
    public BigDecimal getMargin() { return margin; }
    public void setMargin(BigDecimal v) { this.margin = v; }
    public BigDecimal getMarginPercentage() { return marginPercentage; }
    public void setMarginPercentage(BigDecimal v) { this.marginPercentage = v; }
    public BigDecimal getHours() { return hours; }
    public void setHours(BigDecimal v) { this.hours = v; }
    public int getShiftCount() { return shiftCount; }
    public void setShiftCount(int v) { this.shiftCount = v; }
    public int getMissingRateCount() { return missingRateCount; }
    public void setMissingRateCount(int v) { this.missingRateCount = v; }
    public int getNegativeMarginCount() { return negativeMarginCount; }
    public void setNegativeMarginCount(int v) { this.negativeMarginCount = v; }
}
