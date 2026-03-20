package com.pm.planningservice.dto;

import java.util.UUID;

public class PlanningShiftMutationResponseDTO {
    private UUID shiftId;
    private UUID eventId;

    public UUID getShiftId() {
        return shiftId;
    }

    public void setShiftId(UUID shiftId) {
        this.shiftId = shiftId;
    }

    public UUID getEventId() {
        return eventId;
    }

    public void setEventId(UUID eventId) {
        this.eventId = eventId;
    }
}
