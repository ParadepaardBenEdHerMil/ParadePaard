package com.pm.userservice.validation;

import com.pm.userservice.exception.InvalidFileUploadException;

import java.util.Set;

/**
 * AP-3: hardens the public job-application intake against malware and huge-file abuse.
 * The application form is unauthenticated, so an attacker can post arbitrary files; only
 * a small set of document/image types within a size cap is accepted.
 */
public final class JobApplicationUploadValidator {

    static final long MAX_CV_BYTES = 5L * 1024 * 1024;          // 5 MB
    static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;       // 5 MB

    static final Set<String> ALLOWED_CV_TYPES = Set.of(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/png", "image/jpeg", "image/webp");

    private JobApplicationUploadValidator() {
    }

    /** Validate a CV upload. No-op when absent (CV is optional). */
    public static void validateCv(String contentType, long sizeBytes) {
        validate("CV", contentType, sizeBytes, ALLOWED_CV_TYPES, MAX_CV_BYTES);
    }

    /** Validate a profile-picture upload. No-op when absent. */
    public static void validateProfilePicture(String contentType, long sizeBytes) {
        validate("Profile picture", contentType, sizeBytes, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES);
    }

    private static void validate(String label, String contentType, long sizeBytes,
                                 Set<String> allowedTypes, long maxBytes) {
        if (sizeBytes <= 0) {
            return; // nothing uploaded
        }
        String normalized = contentType == null ? "" : contentType.trim().toLowerCase();
        if (!allowedTypes.contains(normalized)) {
            throw new InvalidFileUploadException(
                    label + " must be one of " + allowedTypes + " (was: " + contentType + ")");
        }
        if (sizeBytes > maxBytes) {
            throw new InvalidFileUploadException(
                    label + " exceeds the " + (maxBytes / (1024 * 1024)) + " MB limit");
        }
    }
}
