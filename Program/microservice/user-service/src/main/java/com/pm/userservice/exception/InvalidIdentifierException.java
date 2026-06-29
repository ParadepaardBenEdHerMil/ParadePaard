package com.pm.userservice.exception;

/**
 * Thrown when a Dutch payroll identifier (BSN / IBAN) fails checksum validation
 * during onboarding setup (DV-2 / O-6 / O-8). Mapped to HTTP 400 by the global handler.
 */
public class InvalidIdentifierException extends RuntimeException {
    public InvalidIdentifierException(String message) {
        super(message);
    }
}
