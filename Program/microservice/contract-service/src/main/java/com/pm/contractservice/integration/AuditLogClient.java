package com.pm.contractservice.integration;

import com.pm.contractservice.dto.AuditLogCreateRequestDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class AuditLogClient {
    private static final Logger log = LoggerFactory.getLogger(AuditLogClient.class);

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public AuditLogClient(@Value("${user.service.base-url:http://localhost:4006}") String baseUrl) {
        this.restTemplate = new RestTemplate();
        this.baseUrl = baseUrl;
    }

    public void record(String accessToken, AuditLogCreateRequestDTO request) {
        if (accessToken == null || accessToken.isBlank() || request == null) {
            return;
        }
        restTemplate.exchange(
                // Direct service-to-service call to user-service; the "/api" prefix only
                // exists at the gateway (which strips it), so it must NOT be included here.
                baseUrl + "/internal/audit-log",
                HttpMethod.POST,
                entity(accessToken, request),
                Void.class
        );
    }

    private HttpEntity<?> entity(String accessToken, Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (accessToken != null && !accessToken.isBlank()) {
            headers.setBearerAuth(accessToken);
        } else {
            log.warn("No access token provided for audit log call");
        }
        return new HttpEntity<>(body, headers);
    }
}
