package com.pm.timesheetservice.dto;

import java.util.List;

public class AuditLogCreateRequestDTO {
    private String category;
    private String action;
    private String entityType;
    private String entityId;
    private String occurredAt;
    private List<AuditLogMessagePartDTO> messageParts;

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getEntityType() {
        return entityType;
    }

    public void setEntityType(String entityType) {
        this.entityType = entityType;
    }

    public String getEntityId() {
        return entityId;
    }

    public void setEntityId(String entityId) {
        this.entityId = entityId;
    }

    public String getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(String occurredAt) {
        this.occurredAt = occurredAt;
    }

    public List<AuditLogMessagePartDTO> getMessageParts() {
        return messageParts;
    }

    public void setMessageParts(List<AuditLogMessagePartDTO> messageParts) {
        this.messageParts = messageParts;
    }
}
