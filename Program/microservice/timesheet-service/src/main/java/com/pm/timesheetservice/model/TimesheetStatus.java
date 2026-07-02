package com.pm.timesheetservice.model;

/**
 * Approval state of a timesheet.
 *
 * <p>A timesheet is born {@link #PENDING}. A manager with {@code CAN_MANAGE_TIMESHEETS}
 * moves it exactly once to {@link #APPROVED} or {@link #REJECTED}. A finalized decision
 * cannot be silently flipped again (guarded by the service).
 */
public enum TimesheetStatus {
    PENDING,
    APPROVED,
    REJECTED
}
