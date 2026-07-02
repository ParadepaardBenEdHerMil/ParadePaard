package com.pm.timesheetservice.exception;

/**
 * Raised when a timesheet decision is attempted from an illegal state,
 * e.g. approving or rejecting a timesheet that is no longer PENDING.
 * Mapped to HTTP 409 Conflict.
 */
public class InvalidTimesheetStateException extends RuntimeException {
    public InvalidTimesheetStateException(String message) {
        super(message);
    }
}
