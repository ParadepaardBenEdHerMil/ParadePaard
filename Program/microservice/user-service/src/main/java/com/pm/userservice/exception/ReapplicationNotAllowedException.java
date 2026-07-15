package com.pm.userservice.exception;

/**
 * Thrown when a new application is refused because reapplications are turned off for the company
 * or the applicant has been individually blocked. Carries a deliberately generic, applicant-facing
 * message so it never reveals which of the two reasons applied.
 */
public class ReapplicationNotAllowedException extends RuntimeException {
    public ReapplicationNotAllowedException(String message) {
        super(message);
    }
}
