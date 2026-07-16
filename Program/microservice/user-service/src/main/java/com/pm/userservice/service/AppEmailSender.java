package com.pm.userservice.service;

import java.util.List;

/**
 * Outbound email for user-service concerns: applicant decision emails (reject / changes requested)
 * and admin preset emails to shift / project members and individual users. Bodies are rich HTML with
 * optional attachments; a plain-text alternative is derived automatically. Onboarding-flow emails
 * (which need a password-setup link) still come from auth-service.
 */
public interface AppEmailSender {

    /** A file attached to an email. */
    record Attachment(String fileName, String contentType, byte[] bytes) {}

    /**
     * Sends a single HTML email (a plain-text alternative is derived) with optional attachments.
     * Throws when delivery fails so callers can record the outcome.
     */
    void sendHtml(String toEmail, String subject, String htmlBody, List<Attachment> attachments);
}
