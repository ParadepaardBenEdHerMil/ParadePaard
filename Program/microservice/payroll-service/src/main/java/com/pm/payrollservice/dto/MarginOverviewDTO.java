package com.pm.payrollservice.dto;

import java.math.BigDecimal;

/** Company revenue/margin summary over a date range (shift grain). */
public class MarginOverviewDTO {
    private String from;
    private String to;
    private BigDecimal totalRevenue;
    private BigDecimal totalEmployerCost;
    private BigDecimal totalMargin;
    private BigDecimal marginPercentage;
    private BigDecimal totalHours;
    private int shiftCount;
    private int missingRateCount;
    private int negativeMarginCount;
    private String tag;

    public String getFrom() { return from; }
    public void setFrom(String v) { this.from = v; }
    public String getTo() { return to; }
    public void setTo(String v) { this.to = v; }
    public BigDecimal getTotalRevenue() { return totalRevenue; }
    public void setTotalRevenue(BigDecimal v) { this.totalRevenue = v; }
    public BigDecimal getTotalEmployerCost() { return totalEmployerCost; }
    public void setTotalEmployerCost(BigDecimal v) { this.totalEmployerCost = v; }
    public BigDecimal getTotalMargin() { return totalMargin; }
    public void setTotalMargin(BigDecimal v) { this.totalMargin = v; }
    public BigDecimal getMarginPercentage() { return marginPercentage; }
    public void setMarginPercentage(BigDecimal v) { this.marginPercentage = v; }
    public BigDecimal getTotalHours() { return totalHours; }
    public void setTotalHours(BigDecimal v) { this.totalHours = v; }
    public int getShiftCount() { return shiftCount; }
    public void setShiftCount(int v) { this.shiftCount = v; }
    public int getMissingRateCount() { return missingRateCount; }
    public void setMissingRateCount(int v) { this.missingRateCount = v; }
    public int getNegativeMarginCount() { return negativeMarginCount; }
    public void setNegativeMarginCount(int v) { this.negativeMarginCount = v; }
    public String getTag() { return tag; }
    public void setTag(String v) { this.tag = v; }
}
