package com.pm.userservice.exception;

/**
 * Raised when a public upload (CV or profile picture) violates the allowed
 * content-type or size limits. Mapped to HTTP 400 Bad Request.
 */
public class InvalidFileUploadException extends RuntimeException {
    public InvalidFileUploadException(String message) {
        super(message);
    }
}
