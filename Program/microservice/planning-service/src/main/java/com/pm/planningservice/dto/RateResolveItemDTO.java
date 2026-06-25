package com.pm.planningservice.dto;

import java.time.LocalDate;
import java.util.UUID;

/** One shift to resolve a billing rate for (company is taken from auth). */
public class RateResolveItemDTO {
    private UUID projectId;
    private UUID userId;
    private String function;
    private LocalDate date;

    public UUID getProjectId() { return projectId; }
    public void setProjectId(UUID projectId) { this.projectId = projectId; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getFunction() { return function; }
    public void setFunction(String function) { this.function = function; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }
}
