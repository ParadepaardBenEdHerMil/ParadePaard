package com.pm.userservice.integration;

import com.pm.userservice.dto.AuthAdminOnboardUserRequestDTO;
import com.pm.userservice.dto.AuthAdminOnboardUserResponseDTO;
import com.pm.userservice.dto.AuthEmailSendResponseDTO;
import com.pm.userservice.dto.AuthRegisterRequestDTO;
import com.pm.userservice.dto.AuthRegisterResponseDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.UUID;

@Service
public class AuthServiceClient {

    private static final Logger log = LoggerFactory.getLogger(AuthServiceClient.class);

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public AuthServiceClient(
            @Value("${auth.service.base-url:http://localhost:4004}") String baseUrl) {
        this.restTemplate = new RestTemplate();
        this.baseUrl = baseUrl;
    }

    public AuthRegisterResponseDTO register(AuthRegisterRequestDTO request) {
        String url = baseUrl + "/auth/register";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<AuthRegisterRequestDTO> entity = new HttpEntity<>(request, headers);

        try {
            return restTemplate.exchange(url, HttpMethod.POST, entity, AuthRegisterResponseDTO.class).getBody();
        } catch (RestClientException e) {
            log.error("Auth service register failed", e);
            throw e;
        }
    }

    public AuthAdminOnboardUserResponseDTO adminOnboardUser(AuthAdminOnboardUserRequestDTO request, String accessToken) {
        String url = baseUrl + "/auth/admin/onboard-user";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (accessToken != null && !accessToken.isBlank()) {
            headers.setBearerAuth(accessToken);
        }

        HttpEntity<AuthAdminOnboardUserRequestDTO> entity = new HttpEntity<>(request, headers);

        try {
            return restTemplate.exchange(url, HttpMethod.POST, entity, AuthAdminOnboardUserResponseDTO.class).getBody();
        } catch (RestClientException e) {
            log.error("Auth service admin onboard failed", e);
            throw e;
        }
    }

    public AuthEmailSendResponseDTO resendOnboardingEmail(UUID userId, String accessToken) {
        String url = baseUrl + "/auth/admin/users/" + userId + "/resend-onboarding-email";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (accessToken != null && !accessToken.isBlank()) {
            headers.setBearerAuth(accessToken);
        }

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            return restTemplate.exchange(url, HttpMethod.POST, entity, AuthEmailSendResponseDTO.class).getBody();
        } catch (RestClientException e) {
            log.error("Auth service resend onboarding email failed", e);
            throw e;
        }
    }
}
