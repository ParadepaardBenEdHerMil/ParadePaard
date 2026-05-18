package com.pm.authservice.service;

import java.time.Duration;

public interface EmailSender {
    void sendPasswordResetEmail(String toEmail, String resetUrl, Duration ttl);

    void sendEmployeeOnboardingEmail(String toEmail, String username, String temporaryPassword, String resetUrl, Duration ttl);

    void sendEmployeeAccountSetupEmail(String toEmail, String setupUrl, Duration ttl);
}
