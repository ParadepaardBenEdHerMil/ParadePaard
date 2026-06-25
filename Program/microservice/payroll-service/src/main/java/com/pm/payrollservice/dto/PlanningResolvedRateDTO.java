package com.pm.payrollservice.dto;

import java.math.BigDecimal;

/** Mirror of planning-service ResolvedRateDTO (billing-rate resolve response). */
public class PlanningResolvedRateDTO {
    private String projectId;
    private String userId;
    private String function;
    private String date;
    private BigDecimal ratePerHour;
    private String source;
    private String clientCompanyId;
    private String clientName;
    private String projectName;
    private boolean missing;

    public String getProjectId() { return projectId; }
    public void setProjectId(String v) { this.projectId = v; }
    public String getUserId() { return userId; }
    public void setUserId(String v) { this.userId = v; }
    public String getFunction() { return function; }
    public void setFunction(String v) { this.function = v; }
    public String getDate() { return date; }
    public void setDate(String v) { this.date = v; }
    public BigDecimal getRatePerHour() { return ratePerHour; }
    public void setRatePerHour(BigDecimal v) { this.ratePerHour = v; }
    public String getSource() { return source; }
    public void setSource(String v) { this.source = v; }
    public String getClientCompanyId() { return clientCompanyId; }
    public void setClientCompanyId(String v) { this.clientCompanyId = v; }
    public String getClientName() { return clientName; }
    public void setClientName(String v) { this.clientName = v; }
    public String getProjectName() { return projectName; }
    public void setProjectName(String v) { this.projectName = v; }
    public boolean isMissing() { return missing; }
    public void setMissing(boolean v) { this.missing = v; }
}
