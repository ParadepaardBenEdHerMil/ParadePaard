package com.pm.userservice.exception;

/**
 * Raised when approving a holiday leave request would exceed the employee's
 * remaining leave balance for that year. Mapped to HTTP 409 Conflict.
 */
public class InsufficientLeaveBalanceException extends RuntimeException {
    public InsufficientLeaveBalanceException(String message) {
        super(message);
    }
}
