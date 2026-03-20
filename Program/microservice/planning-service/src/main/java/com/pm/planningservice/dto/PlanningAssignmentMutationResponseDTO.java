package com.pm.planningservice.dto;

import java.util.UUID;

public class PlanningAssignmentMutationResponseDTO {
    private UUID scheduleEntryId;
    private UUID shiftId;

    public UUID getScheduleEntryId() {
        return scheduleEntryId;
    }

    public void setScheduleEntryId(UUID scheduleEntryId) {
        this.scheduleEntryId = scheduleEntryId;
    }

    public UUID getShiftId() {
        return shiftId;
    }

    public void setShiftId(UUID shiftId) {
        this.shiftId = shiftId;
    }
}
