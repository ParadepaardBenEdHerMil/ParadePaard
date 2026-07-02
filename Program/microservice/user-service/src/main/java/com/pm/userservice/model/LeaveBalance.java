package com.pm.userservice.model;

import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Running holiday-hours balance for one employee in one calendar year.
 *
 * <p>{@code entitledHours} is what the employee is granted/accrued for the year
 * (statutory Dutch minimum is 4x the weekly working hours; carry-over from the
 * previous year is added here too). {@code usedHours} is the sum of approved
 * VACATION leave. {@link #getRemainingHours()} is what is still bookable.
 *
 * <p>Only holiday (VACATION) leave draws down this balance; sick, unpaid, parental
 * and other leave do not.
 */
@Entity
@Table(name = "leave_balances",
        uniqueConstraints = @UniqueConstraint(name = "uk_leave_balance_user_year",
                columnNames = {"user_id", "balance_year"}))
public class LeaveBalance {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "company_id")
    private UUID companyId;

    @Column(name = "balance_year", nullable = false)
    private int year;

    @Column(nullable = false)
    private int entitledHours;

    @Column(nullable = false)
    private int usedHours;

    @Column(nullable = false)
    private OffsetDateTime createdAt;

    @Column(nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        this.createdAt = OffsetDateTime.now();
        this.updatedAt = this.createdAt;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }

    public int getRemainingHours() {
        return entitledHours - usedHours;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }

    public int getYear() { return year; }
    public void setYear(int year) { this.year = year; }

    public int getEntitledHours() { return entitledHours; }
    public void setEntitledHours(int entitledHours) { this.entitledHours = entitledHours; }

    public int getUsedHours() { return usedHours; }
    public void setUsedHours(int usedHours) { this.usedHours = usedHours; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
