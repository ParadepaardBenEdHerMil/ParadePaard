package com.pm.planningservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "shift_applications",
        indexes = {
                @Index(name = "idx_shift_application_shift", columnList = "shift_id"),
                @Index(name = "idx_shift_application_user", columnList = "user_id")
        },
        uniqueConstraints = @UniqueConstraint(columnNames = {"shift_id", "user_id"})
)
public class ShiftApplication {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(nullable = false)
    private UUID shiftApplicationId;

    @Column(nullable = false)
    private UUID shiftId;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private LocalDateTime appliedAt;

    public UUID getShiftApplicationId() {
        return shiftApplicationId;
    }

    public void setShiftApplicationId(UUID shiftApplicationId) {
        this.shiftApplicationId = shiftApplicationId;
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

    public LocalDateTime getAppliedAt() {
        return appliedAt;
    }

    public void setAppliedAt(LocalDateTime appliedAt) {
        this.appliedAt = appliedAt;
    }
}
