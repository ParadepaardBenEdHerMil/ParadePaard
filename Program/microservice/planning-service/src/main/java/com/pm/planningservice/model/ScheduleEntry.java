package com.pm.planningservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.UUID;

@Entity
@Table(
        name = "schedule_entries",
        indexes = {
                @Index(name = "idx_schedule_shift", columnList = "shift_id"),
                @Index(name = "idx_schedule_status", columnList = "status")
        },
        uniqueConstraints = @UniqueConstraint(columnNames = {"shift_id", "user_id"})
)
public class ScheduleEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(nullable = false)
    private UUID scheduleEntryId;

    @Column(nullable = false)
    private UUID shiftId;

    @Column(nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ScheduleEntryStatus status = ScheduleEntryStatus.ASSIGNED;

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

    public ScheduleEntryStatus getStatus() {
        return status;
    }

    public void setStatus(ScheduleEntryStatus status) {
        this.status = status;
    }
}
