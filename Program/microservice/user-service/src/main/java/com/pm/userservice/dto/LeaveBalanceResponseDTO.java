package com.pm.userservice.dto;

import java.util.UUID;

public class LeaveBalanceResponseDTO {
    private UUID userId;
    private int year;
    private int entitledHours;
    private int usedHours;
    private int remainingHours;

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public int getYear() { return year; }
    public void setYear(int year) { this.year = year; }

    public int getEntitledHours() { return entitledHours; }
    public void setEntitledHours(int entitledHours) { this.entitledHours = entitledHours; }

    public int getUsedHours() { return usedHours; }
    public void setUsedHours(int usedHours) { this.usedHours = usedHours; }

    public int getRemainingHours() { return remainingHours; }
    public void setRemainingHours(int remainingHours) { this.remainingHours = remainingHours; }
}
