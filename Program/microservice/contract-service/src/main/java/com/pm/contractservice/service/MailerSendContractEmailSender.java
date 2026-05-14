package com.pm.contractservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pm.contractservice.exception.ContractEmailDeliveryException;
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
public class MailerSendContractEmailSender implements ContractEmailSender {
    private static final Logger log = LoggerFactory.getLogger(MailerSendContractEmailSender.class);

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String apiToken;
    private final String apiUrl;
    private final String fromEmail;

    public MailerSendContractEmailSender(
            ObjectMapper objectMapper,
            @Value("${mailersend.api-token:}") String apiToken,
            @Value("${mailersend.api-url:https://api.mailersend.com/v1/email}") String apiUrl,
            @Value("${contract.email.from-email:noreply@lambdamanager.com}") String fromEmail
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
    public void sendContractReadyEmail(String toEmail, String employeeName, String contractUrl) {
        String greetingName = employeeName == null || employeeName.isBlank() ? "there" : employeeName.trim();
        String text = """
                Hi %s,

                Your ParadePaard contract is ready to review and sign.

                Open your employment details page to view, download, and sign the contract:
                %s
                """.formatted(greetingName, contractUrl);

        String html = """
                <p>Hi %s,</p>
                <p>Your ParadePaard contract is ready to review and sign.</p>
                <p><a href="%s">Open your employment details</a></p>
                """.formatted(escapeHtml(greetingName), escapeHtml(contractUrl));

        sendEmail(toEmail, "Your ParadePaard contract is ready", text, html);
    }

    private void sendEmail(String toEmail, String subject, String text, String html) {
        if (apiToken.isBlank()) {
            throw new ContractEmailDeliveryException("MAILERSEND_API_TOKEN is required to send contract emails");
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
                throw new ContractEmailDeliveryException("MailerSend rejected contract email with status "
                        + response.statusCode() + ": " + response.body());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("MailerSend contract email failed (from={}, to={})", fromEmail, toEmail, e);
            throw new ContractEmailDeliveryException("Failed to send contract email", e);
        } catch (ContractEmailDeliveryException e) {
            log.error("MailerSend contract email failed (from={}, to={})", fromEmail, toEmail, e);
            throw e;
        } catch (Exception e) {
            log.error("MailerSend contract email failed (from={}, to={})", fromEmail, toEmail, e);
            throw new ContractEmailDeliveryException("Failed to send contract email", e);
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
