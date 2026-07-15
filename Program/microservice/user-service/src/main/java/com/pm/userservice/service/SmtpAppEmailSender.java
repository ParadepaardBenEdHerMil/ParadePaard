package com.pm.userservice.service;

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
import java.util.List;

/**
 * SMTP implementation of {@link AppEmailSender}. Mirrors auth-service's sender:
 * both text and a minimally-escaped HTML alternative are sent through the shared
 * SES/SMTP relay configured by the {@code spring.mail.*} properties.
 */
@Service
public class SmtpAppEmailSender implements AppEmailSender {
    private static final Logger log = LoggerFactory.getLogger(SmtpAppEmailSender.class);

    private final JavaMailSender mailSender;
    private final String fromEmail;

    public SmtpAppEmailSender(
            JavaMailSender mailSender,
            @Value("${email.from-address:noreply@lambdamanager.com}") String fromEmail
    ) {
        this.mailSender = mailSender;
        this.fromEmail = fromEmail;
    }

    @Override
    public void sendPlainText(String toEmail, String subject, String body) {
        sendOne(toEmail, subject, body);
    }

    @Override
    public int sendPlainTextBulk(List<String> toEmails, String subject, String body) {
        if (toEmails == null || toEmails.isEmpty()) {
            return 0;
        }
        int sent = 0;
        for (String toEmail : toEmails) {
            if (toEmail == null || toEmail.isBlank()) {
                continue;
            }
            try {
                sendOne(toEmail.trim(), subject, body);
                sent++;
            } catch (RuntimeException e) {
                log.error("Preset email to {} failed; continuing with remaining recipients", toEmail, e);
            }
        }
        return sent;
    }

    private void sendOne(String toEmail, String subject, String body) {
        String text = body == null ? "" : body;
        String resolvedSubject = subject == null || subject.isBlank() ? "A message from ParadePaard" : subject;
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(
                    message,
                    MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                    StandardCharsets.UTF_8.name()
            );
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject(resolvedSubject);
            helper.setText(text, toHtml(text));
            mailSender.send(message);
        } catch (MessagingException | MailException e) {
            log.error("App email failed (from={}, to={}, subject={})", fromEmail, toEmail, resolvedSubject, e);
            throw new RuntimeException("Failed to send email", e);
        }
    }

    private static String toHtml(String body) {
        return "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5\">"
                + escapeHtml(body).replace("\n", "<br>")
                + "</div>";
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
