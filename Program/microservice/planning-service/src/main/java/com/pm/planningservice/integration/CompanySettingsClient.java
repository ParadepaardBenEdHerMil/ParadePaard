package com.pm.planningservice.integration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.UUID;

@Component
public class CompanySettingsClient {
    private final RestClient restClient;

    public CompanySettingsClient(
            @Value("${user.service.base-url:http://localhost:4006}") String userServiceBaseUrl,
            @Value("${internal.service.token:}") String internalServiceToken) {
        RestClient.Builder builder = RestClient.builder().baseUrl(userServiceBaseUrl);
        // S1: authenticate this service-to-service call to user-service's /public endpoint.
        if (internalServiceToken != null && !internalServiceToken.isBlank()) {
            builder.defaultHeader("X-Internal-Service-Token", internalServiceToken.trim());
        }
        this.restClient = builder.build();
    }

    public CompanySettingsDTO getCompanySettings(UUID companyId) {
        return restClient.get()
                .uri("/users/public/company-settings/{companyId}", companyId)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (request, response) -> {
                    throw new IllegalArgumentException("Could not resolve company settings for company " + companyId);
                })
                .body(CompanySettingsDTO.class);
    }
}
