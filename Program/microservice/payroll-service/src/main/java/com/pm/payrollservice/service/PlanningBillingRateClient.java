package com.pm.payrollservice.service;

import com.pm.payrollservice.dto.PlanningResolvedRateDTO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

/**
 * Calls planning-service's per-shift billing-rate resolve endpoint. The caller's
 * bearer token is forwarded so planning scopes the resolve to the same company.
 */
@Service
public class PlanningBillingRateClient {
    private final RestClient restClient;

    public PlanningBillingRateClient(
            RestClient.Builder restClientBuilder,
            @Value("${planning.service.base-url:http://localhost:4010}") String planningBaseUrl) {
        this.restClient = restClientBuilder.baseUrl(planningBaseUrl).build();
    }

    /** items: maps of projectId, userId, function, date (yyyy-MM-dd); results align by index. */
    public List<PlanningResolvedRateDTO> resolveRates(String bearerToken, List<Map<String, Object>> items) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        return restClient.post()
                .uri("/planning/billing-rates/resolve")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken)
                .body(Map.of("items", items))
                .retrieve()
                .body(new ParameterizedTypeReference<List<PlanningResolvedRateDTO>>() {});
    }
}
