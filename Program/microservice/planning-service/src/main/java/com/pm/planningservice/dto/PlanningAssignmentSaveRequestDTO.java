package com.pm.planningservice.dto;

import com.pm.planningservice.model.ScheduleEntryStatus;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public class PlanningAssignmentSaveRequestDTO {
    @NotNull
    private UUID userId;

    private ScheduleEntryStatus status = ScheduleEntryStatus.ASSIGNED;

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public ScheduleEntryStatus getStatus() {
        return status;
    }

    public void setStatus(ScheduleEntryStatus status) {
        this.status = status;
    }
}
