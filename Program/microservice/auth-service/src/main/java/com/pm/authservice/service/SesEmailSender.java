package com.pm.authservice.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

@Service
public class SesEmailSender implements EmailSender {
    private static final Logger log = LoggerFactory.getLogger(SesEmailSender.class);

    private final JavaMailSender mailSender;
    private final String fromEmail;

    public SesEmailSender(
            JavaMailSender mailSender,
            @Value("${email.from-address:noreply@lambdamanager.com}") String fromEmail
    ) {
        this.mailSender = mailSender;
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
    public void sendEmployeeOnboardingEmail(
            String toEmail,
            String username,
            String temporaryPassword,
            String resetUrl,
            Duration ttl
    ) {
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
                """.formatted(
                escapeHtml(username),
                escapeHtml(temporaryPassword),
                minutes,
                escapeHtml(resetUrl)
        );

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

    @Override
    public void sendOnboardingChangesRequestedEmail(String toEmail, String note, List<String> flagLines, String setupUrl, Duration ttl) {
        String minutes = String.valueOf(Math.max(1, ttl.toMinutes()));
        boolean hasNote = note != null && !note.isBlank();

        StringBuilder textFlags = new StringBuilder();
        StringBuilder htmlFlags = new StringBuilder();
        if (flagLines != null && !flagLines.isEmpty()) {
            textFlags.append("The following need to be corrected:\n");
            htmlFlags.append("<p>The following need to be corrected:</p><ul>");
            for (String line : flagLines) {
                if (line == null || line.isBlank()) continue;
                textFlags.append("- ").append(line).append("\n");
                htmlFlags.append("<li>").append(escapeHtml(line)).append("</li>");
            }
            htmlFlags.append("</ul>");
        }

        String noteText = hasNote ? "Note from the reviewer:\n" + note + "\n\n" : "";
        String noteHtml = hasNote ? "<p><strong>Note from the reviewer:</strong><br>" + escapeHtml(note) + "</p>" : "";

        String text = """
                Your onboarding details need a few changes before we can continue.

                %s%s
                Use this link to log back in and update your details (valid for %s minutes):
                %s
                """.formatted(noteText, textFlags, minutes, setupUrl);

        String html = """
                <p>Your onboarding details need a few changes before we can continue.</p>
                %s%s
                <p>Use this link to log back in and update your details (valid for %s minutes):</p>
                <p><a href="%s">Update your details</a></p>
                """.formatted(noteHtml, htmlFlags, minutes, escapeHtml(setupUrl));

        sendEmail(toEmail, "Action needed: update your onboarding details", text, html, "onboarding changes");
    }

    @Override
    public void sendOnboardingRejectedEmail(String toEmail, String reason) {
        boolean hasReason = reason != null && !reason.isBlank();
        String reasonText = hasReason ? "Reason:\n" + reason + "\n\n" : "";
        String reasonHtml = hasReason ? "<p><strong>Reason:</strong><br>" + escapeHtml(reason) + "</p>" : "";

        String text = """
                Thank you for your interest. After review, your onboarding has not been approved at this time.

                %sIf you believe this is a mistake, please contact us.
                """.formatted(reasonText);

        String html = """
                <p>Thank you for your interest. After review, your onboarding has not been approved at this time.</p>
                %s
                <p>If you believe this is a mistake, please contact us.</p>
                """.formatted(reasonHtml);

        sendEmail(toEmail, "Your onboarding was not approved", text, html, "onboarding rejected");
    }

    private void sendEmail(String toEmail, String subject, String text, String html, String purpose) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(
                    message,
                    MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                    StandardCharsets.UTF_8.name()
            );
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(text, html);
            mailSender.send(message);
        } catch (MessagingException | MailException e) {
            log.error("SES {} email failed (from={}, to={})", purpose, fromEmail, toEmail, e);
            throw new RuntimeException("Failed to send " + purpose + " email", e);
        }
    }

    private static String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
