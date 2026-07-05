package com.pm.payrollservice.service;

import com.pm.payrollservice.dto.CompanySettingsDTO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class CompanySettingsClient {
    private final RestClient restClient;

    public CompanySettingsClient(
            RestClient.Builder restClientBuilder,
            @Value("${user.service.base-url:http://localhost:4006}") String userServiceBaseUrl,
            @Value("${internal.service.token:}") String internalServiceToken
    ) {
        RestClient.Builder builder = restClientBuilder.baseUrl(userServiceBaseUrl);
        // S1: authenticate this service-to-service call to user-service's /public endpoint.
        if (internalServiceToken != null && !internalServiceToken.isBlank()) {
            builder.defaultHeader("X-Internal-Service-Token", internalServiceToken.trim());
        }
        this.restClient = builder.build();
    }

    public CompanySettingsDTO getCompanySettings(String companyId) {
        return restClient.get()
                .uri("/users/public/company-settings/{companyId}", companyId)
                .retrieve()
                .body(CompanySettingsDTO.class);
    }
}
