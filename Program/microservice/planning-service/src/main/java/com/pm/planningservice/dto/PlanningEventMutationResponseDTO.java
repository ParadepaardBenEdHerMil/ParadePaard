package com.pm.planningservice.dto;

import java.util.UUID;

public class PlanningEventMutationResponseDTO {
    private UUID eventId;

    public UUID getEventId() {
        return eventId;
    }

    public void setEventId(UUID eventId) {
        this.eventId = eventId;
    }
}
