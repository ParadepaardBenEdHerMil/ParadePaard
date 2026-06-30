package com.pm.userservice.exception;

/**
 * Thrown when a leave request is asked to make an invalid status transition,
 * e.g. approving or rejecting a request that is no longer PENDING. Maps to
 * HTTP 409 Conflict so a finalized decision cannot be silently overwritten.
 */
public class InvalidLeaveRequestStateException extends RuntimeException {
    public InvalidLeaveRequestStateException(String message) {
        super(message);
    }
}
