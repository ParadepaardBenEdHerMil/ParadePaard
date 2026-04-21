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
            @Value("${user.service.base-url:http://localhost:4006}") String userServiceBaseUrl
    ) {
        this.restClient = restClientBuilder
                .baseUrl(userServiceBaseUrl)
                .build();
    }

    public CompanySettingsDTO getCompanySettings(String companyId) {
        return restClient.get()
                .uri("/users/public/company-settings/{companyId}", companyId)
                .retrieve()
                .body(CompanySettingsDTO.class);
    }
}
