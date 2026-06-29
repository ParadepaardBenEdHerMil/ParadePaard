package com.pm.planningservice.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Result of resolving the billing rate for one shift. {@code source} is one of
 * EMPLOYEE_PROJECT, EMPLOYEE_CLIENT, PROJECT, CLIENT (most-specific first) or
 * MISSING when no rate tier matched (ratePerHour null, missing true).
 */
public class ResolvedRateDTO {
    private UUID projectId;
    private UUID userId;
    private String function;
    private LocalDate date;
    private BigDecimal ratePerHour;
    private String source;
    private UUID clientCompanyId;
    private String clientName;
    private String projectName;
    private boolean missing;

    public UUID getProjectId() { return projectId; }
    public void setProjectId(UUID projectId) { this.projectId = projectId; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getFunction() { return function; }
    public void setFunction(String function) { this.function = function; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public BigDecimal getRatePerHour() { return ratePerHour; }
    public void setRatePerHour(BigDecimal ratePerHour) { this.ratePerHour = ratePerHour; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public UUID getClientCompanyId() { return clientCompanyId; }
    public void setClientCompanyId(UUID clientCompanyId) { this.clientCompanyId = clientCompanyId; }

    public String getClientName() { return clientName; }
    public void setClientName(String clientName) { this.clientName = clientName; }

    public String getProjectName() { return projectName; }
    public void setProjectName(String projectName) { this.projectName = projectName; }

    public boolean isMissing() { return missing; }
    public void setMissing(boolean missing) { this.missing = missing; }
}
