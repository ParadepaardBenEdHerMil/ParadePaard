package com.pm.authservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
public class MailerSendEmailSender implements EmailSender {
    private static final Logger log = LoggerFactory.getLogger(MailerSendEmailSender.class);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String apiToken;
    private final String apiUrl;
    private final String fromEmail;

    public MailerSendEmailSender(
            ObjectMapper objectMapper,
            @Value("${mailersend.api-token:}") String apiToken,
            @Value("${mailersend.api-url:https://api.mailersend.com/v1/email}") String apiUrl,
            @Value("${password-reset.from-email:noreply@lambdamanager.com}") String fromEmail
    ) {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        this.objectMapper = objectMapper;
        this.apiToken = apiToken == null ? "" : apiToken.trim();
        this.apiUrl = apiUrl;
        this.fromEmail = fromEmail;
    }

    @Override
    public void sendPasswordResetEmail(String toEmail, String resetUrl, Duration ttl) {
        String minutes = String.valueOf(Math.max(1, ttl.toMinutes()));
        String text = """
                Someone requested a password reset for your LambdaManager account.

                Use this link to reset your password (valid for %s minutes):
                %s

                If you didn't request this, you can ignore this email.
                """.formatted(minutes, resetUrl);

        String html = """
                <p>Someone requested a password reset for your LambdaManager account.</p>
                <p><strong>This link is valid for %s minutes:</strong></p>
                <p><a href="%s">Reset your password</a></p>
                <p>If you didn't request this, you can ignore this email.</p>
                """.formatted(minutes, escapeHtml(resetUrl));

        sendEmail(toEmail, "Reset your LambdaManager password", text, html, "password reset");
    }

    @Override
    public void sendEmployeeOnboardingEmail(String toEmail, String username, String temporaryPassword, String resetUrl, Duration ttl) {
        String minutes = String.valueOf(Math.max(1, ttl.toMinutes()));
        String text = """
                An admin created your LambdaManager account.

                Username:
                %s

                Temporary password:
                %s

                After logging in, you must set a new password. You can also set it immediately using this link (valid for %s minutes):
                %s
                """.formatted(username, temporaryPassword, minutes, resetUrl);

        String html = """
                <p>An admin created your LambdaManager account.</p>
                <p><strong>Username:</strong> %s</p>
                <p><strong>Temporary password:</strong> %s</p>
                <p>After logging in, you must set a new password. You can also set it immediately using this link (valid for %s minutes):</p>
                <p><a href="%s">Set your new password</a></p>
                """.formatted(escapeHtml(username), escapeHtml(temporaryPassword), minutes, escapeHtml(resetUrl));

        sendEmail(toEmail, "Your LambdaManager account is ready", text, html, "onboarding");
    }

    @Override
    public void sendEmployeeAccountSetupEmail(String toEmail, String setupUrl, Duration ttl) {
        String minutes = String.valueOf(Math.max(1, ttl.toMinutes()));
        String text = """
                Your LambdaManager account is ready.

                Use this link to set your password and open your account (valid for %s minutes):
                %s
                """.formatted(minutes, setupUrl);

        String html = """
                <p>Your LambdaManager account is ready.</p>
                <p>Use this link to set your password and open your account (valid for %s minutes):</p>
                <p><a href="%s">Set your password</a></p>
                """.formatted(minutes, escapeHtml(setupUrl));

        sendEmail(toEmail, "Your LambdaManager account is ready", text, html, "account setup");
    }

    private void sendEmail(String toEmail, String subject, String text, String html, String purpose) {
        if (apiToken.isBlank()) {
            throw new IllegalStateException("MAILERSEND_API_TOKEN is required to send " + purpose + " emails");
        }

        try {
            Map<String, Object> payload = Map.of(
                    "from", Map.of("email", fromEmail),
                    "to", List.of(Map.of("email", toEmail)),
                    "subject", subject,
                    "text", text,
                    "html", html
            );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(apiUrl))
                    .timeout(Duration.ofSeconds(20))
                    .header("Authorization", "Bearer " + apiToken)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new RuntimeException("MailerSend rejected " + purpose + " email with status "
                        + response.statusCode() + ": " + response.body());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("MailerSend {} email failed (from={}, to={})", purpose, fromEmail, toEmail, e);
            throw new RuntimeException("Failed to send " + purpose + " email", e);
        } catch (Exception e) {
            log.error("MailerSend {} email failed (from={}, to={})", purpose, fromEmail, toEmail, e);
            throw new RuntimeException("Failed to send " + purpose + " email", e);
        }
    }

    private static String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
