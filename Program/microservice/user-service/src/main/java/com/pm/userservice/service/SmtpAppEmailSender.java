package com.pm.userservice.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * SMTP implementation of {@link AppEmailSender}. Sends an HTML body plus a derived plain-text
 * alternative and any attachments through the shared SES/SMTP relay ({@code spring.mail.*}).
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
    public void sendHtml(String toEmail, String subject, String htmlBody, List<Attachment> attachments) {
        String html = htmlBody == null ? "" : htmlBody;
        String resolvedSubject = subject == null || subject.isBlank() ? "A message from ParadePaard" : subject;
        boolean hasAttachments = attachments != null && !attachments.isEmpty();
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
            // Plain-text alternative first, then HTML, so clients pick their best fit.
            helper.setText(htmlToPlainText(html), html);
            if (hasAttachments) {
                for (Attachment attachment : attachments) {
                    if (attachment == null || attachment.bytes() == null) {
                        continue;
                    }
                    String contentType = attachment.contentType() == null || attachment.contentType().isBlank()
                            ? "application/octet-stream"
                            : attachment.contentType();
                    helper.addAttachment(
                            attachment.fileName() == null ? "attachment" : attachment.fileName(),
                            new ByteArrayResource(attachment.bytes()),
                            contentType
                    );
                }
            }
            mailSender.send(message);
            // Success = the relay accepted the message for delivery. Logged so a "never arrived"
            // report can be pinned to delivery/spam rather than a send that never happened.
            log.info("App email accepted by relay (from={}, to={}, subject={}, attachments={})",
                    fromEmail, toEmail, resolvedSubject, hasAttachments ? attachments.size() : 0);
        } catch (MessagingException | MailException e) {
            log.error("App email failed (from={}, to={}, subject={})", fromEmail, toEmail, resolvedSubject, e);
            throw new RuntimeException("Failed to send email", e);
        }
    }

    /**
     * Best-effort HTML -> plain text for the alternative part: turns block ends and {@code <br>} into
     * newlines, links into "text (url)", strips remaining tags and unescapes entities.
     */
    static String htmlToPlainText(String html) {
        if (html == null || html.isEmpty()) {
            return "";
        }
        String text = html
                .replaceAll("(?is)<\\s*br\\s*/?>", "\n")
                .replaceAll("(?is)</\\s*(p|div|li|tr|h[1-6])\\s*>", "\n")
                .replaceAll("(?is)<\\s*li[^>]*>", "- ");
        // <a href="url">label</a> -> label (url)
        text = text.replaceAll("(?is)<a[^>]*href=\"([^\"]*)\"[^>]*>(.*?)</a>", "$2 ($1)");
        text = text.replaceAll("(?is)<[^>]+>", "");
        text = text.replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'");
        // Collapse runs of 3+ newlines to 2.
        text = text.replaceAll("\n{3,}", "\n\n");
        return text.trim();
    }
}
