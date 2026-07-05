package com.pm.planningservice.integration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
public class UserDirectoryRestClient implements UserDirectoryClient {
    private final RestClient restClient;

    public UserDirectoryRestClient(
            @Value("${user.service.base-url:http://localhost:4006}") String userServiceBaseUrl,
            @Value("${internal.service.token:}") String internalServiceToken) {
        RestClient.Builder builder = RestClient.builder().baseUrl(userServiceBaseUrl);
        // S1: authenticate this service-to-service call to user-service's /public endpoint.
        if (internalServiceToken != null && !internalServiceToken.isBlank()) {
            builder.defaultHeader("X-Internal-Service-Token", internalServiceToken.trim());
        }
        this.restClient = builder.build();
    }

    @Override
    public Map<UUID, String> getDisplayNamesByUserIds(Set<UUID> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<String, String> response = restClient.post()
                .uri("/users/public/display-names")
                .body(userIds.stream().map(UUID::toString).toList())
                .retrieve()
                .onStatus(HttpStatusCode::isError, (request, rawResponse) -> {
                    throw new IllegalArgumentException("Could not resolve user display names");
                })
                .body(new ParameterizedTypeReference<Map<String, String>>() {});

        if (response == null || response.isEmpty()) {
            return Collections.emptyMap();
        }

        return response.entrySet().stream()
                .filter(entry -> entry.getKey() != null && entry.getValue() != null && !entry.getValue().isBlank())
                .collect(Collectors.toMap(
                        entry -> UUID.fromString(entry.getKey()),
                        Map.Entry::getValue
                ));
    }
}
