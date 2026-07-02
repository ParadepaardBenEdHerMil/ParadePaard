package com.pm.timesheetservice.model;

/**
 * The kind of change recorded on the timesheet audit trail.
 */
public enum TimesheetAuditAction {
    CREATED,
    UPDATED,
    APPROVED,
    REJECTED
}
