package com.pm.userservice.service;

import java.util.List;

/**
 * Outbound email for user-service concerns: applicant decision emails (reject /
 * changes requested) and admin preset emails to shift / project members and
 * individual users. Onboarding-flow emails (which need a password-setup link)
 * still live in auth-service.
 */
public interface AppEmailSender {

    /**
     * Sends a single plain-text email (a simple HTML alternative part is derived
     * from the text). Throws when delivery fails so callers can record the outcome.
     */
    void sendPlainText(String toEmail, String subject, String body);

    /**
     * Best-effort bulk send: one message per recipient so recipients never see each
     * other. Never throws; returns the number of messages that were sent successfully.
     */
    int sendPlainTextBulk(List<String> toEmails, String subject, String body);
}
