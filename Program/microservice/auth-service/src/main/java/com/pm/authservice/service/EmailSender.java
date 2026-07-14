package com.pm.authservice.service;

import java.time.Duration;
import java.util.List;

public interface EmailSender {
    void sendPasswordResetEmail(String toEmail, String resetUrl, Duration ttl);

    void sendEmployeeOnboardingEmail(String toEmail, String username, String temporaryPassword, String resetUrl, Duration ttl);

    void sendEmployeeAccountSetupEmail(String toEmail, String setupUrl, Duration ttl);

    /**
     * Notifies an employee that their onboarding submission needs changes. Lists the admin's
     * per-field flags (already formatted as "Section - Field: explanation" lines) and the
     * overall note, plus a fresh setup link so they can log back in and correct the form.
     */
    void sendOnboardingChangesRequestedEmail(String toEmail, String note, List<String> flagLines, String setupUrl, Duration ttl);

    /**
     * Notifies an applicant that their onboarding was rejected. This is final (no link): the
     * account is disabled and can only be reopened by an admin re-enabling it and re-inviting.
     */
    void sendOnboardingRejectedEmail(String toEmail, String reason);
}
