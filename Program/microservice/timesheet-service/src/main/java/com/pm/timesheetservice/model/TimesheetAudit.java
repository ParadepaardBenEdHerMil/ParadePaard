package com.pm.timesheetservice.model;

import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Append-only audit entry describing a single change to a timesheet:
 * who did what, when, the status transition, and an optional reason.
 * One row is written per create / update / approve / reject.
 */
@Entity
@Table(name = "timesheet_audit")
public class TimesheetAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(nullable = false)
    private UUID id;

    @Column(nullable = false)
    private UUID timesheetId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TimesheetAuditAction action;

    /** The authenticated user that performed the action (null for system/import). */
    private UUID actorUserId;

    @Enumerated(EnumType.STRING)
    private TimesheetStatus fromStatus;

    @Enumerated(EnumType.STRING)
    private TimesheetStatus toStatus;

    @Column(length = 1000)
    private String reason;

    @Column(nullable = false)
    private OffsetDateTime at;

    public TimesheetAudit() {
    }

    public TimesheetAudit(UUID timesheetId, TimesheetAuditAction action, UUID actorUserId,
                          TimesheetStatus fromStatus, TimesheetStatus toStatus, String reason,
                          OffsetDateTime at) {
        this.timesheetId = timesheetId;
        this.action = action;
        this.actorUserId = actorUserId;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.reason = reason;
        this.at = at;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getTimesheetId() { return timesheetId; }
    public void setTimesheetId(UUID timesheetId) { this.timesheetId = timesheetId; }

    public TimesheetAuditAction getAction() { return action; }
    public void setAction(TimesheetAuditAction action) { this.action = action; }

    public UUID getActorUserId() { return actorUserId; }
    public void setActorUserId(UUID actorUserId) { this.actorUserId = actorUserId; }

    public TimesheetStatus getFromStatus() { return fromStatus; }
    public void setFromStatus(TimesheetStatus fromStatus) { this.fromStatus = fromStatus; }

    public TimesheetStatus getToStatus() { return toStatus; }
    public void setToStatus(TimesheetStatus toStatus) { this.toStatus = toStatus; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public OffsetDateTime getAt() { return at; }
    public void setAt(OffsetDateTime at) { this.at = at; }
}
