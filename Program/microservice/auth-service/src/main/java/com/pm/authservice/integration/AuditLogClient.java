package com.pm.authservice.integration;

import com.pm.authservice.dto.AuditLogCreateRequestDTO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class AuditLogClient {
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
                baseUrl + "/api/internal/audit-log",
                HttpMethod.POST,
                entity(accessToken, request),
                Void.class
        );
    }

    private HttpEntity<?> entity(String accessToken, Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(accessToken);
        return new HttpEntity<>(body, headers);
    }
}
