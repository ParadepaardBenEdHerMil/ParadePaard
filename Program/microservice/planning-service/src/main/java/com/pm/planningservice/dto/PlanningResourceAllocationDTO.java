package com.pm.planningservice.dto;

import com.pm.planningservice.model.ScheduleEntryStatus;

import java.time.LocalDateTime;
import java.util.UUID;

public class PlanningResourceAllocationDTO {
    private UUID scheduleEntryId;
    private UUID shiftId;
    private UUID userId;
    private String userDisplayName;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String functionName;
    private ScheduleEntryStatus status;

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

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getUserDisplayName() {
        return userDisplayName;
    }

    public void setUserDisplayName(String userDisplayName) {
        this.userDisplayName = userDisplayName;
    }

    public LocalDateTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalDateTime startTime) {
        this.startTime = startTime;
    }

    public LocalDateTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalDateTime endTime) {
        this.endTime = endTime;
    }

    public String getFunctionName() {
        return functionName;
    }

    public void setFunctionName(String functionName) {
        this.functionName = functionName;
    }

    public ScheduleEntryStatus getStatus() {
        return status;
    }

    public void setStatus(ScheduleEntryStatus status) {
        this.status = status;
    }
}
