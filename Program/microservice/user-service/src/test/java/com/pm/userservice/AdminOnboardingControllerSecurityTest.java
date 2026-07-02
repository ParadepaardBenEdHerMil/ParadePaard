package com.pm.userservice;

import com.pm.userservice.config.SecurityConfig;
import com.pm.userservice.controller.AdminOnboardingController;
import com.pm.userservice.dto.AdminOnboardingRequestDTO;
import com.pm.userservice.dto.AdminOnboardingResponseDTO;
import com.pm.userservice.service.OnboardingService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminOnboardingController.class)
@Import(SecurityConfig.class)
class AdminOnboardingControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private OnboardingService onboardingService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void anonymousAdminOnboardingIsUnauthorized() throws Exception {
        mockMvc.perform(post("/admin/onboarding")
                        .contentType(APPLICATION_JSON)
                        .content(validRequestBody()))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(onboardingService);
    }

    @Test
    void adminOnboardingWithoutPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/admin/onboarding")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validRequestBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(onboardingService);
    }

    @Test
    void adminOnboardingWithPermissionReachesController() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of("CAN_ONBOARD_USERS"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        AdminOnboardingResponseDTO response = new AdminOnboardingResponseDTO();
        response.setUserId(UUID.randomUUID().toString());
        response.setContractId(UUID.randomUUID().toString());
        response.setUsername("new.user@example.com");
        response.setTemporaryPassword("Temp123!");

        when(onboardingService.adminOnboard(any(AdminOnboardingRequestDTO.class), eq("token")))
                .thenReturn(response);

        mockMvc.perform(post("/admin/onboarding")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validRequestBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("new.user@example.com"))
                .andExpect(jsonPath("$.temporaryPassword").value("Temp123!"));
    }

    @Test
    void adminOnboardingWithPermissionRejectsInvalidBody() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of("CAN_ONBOARD_USERS"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/admin/onboarding")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "",
                                  "firstNames": "Ada"
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(onboardingService);
    }

    private Jwt jwtWithPermissions(List<String> permissions) {
        UUID userId = UUID.randomUUID();
        return Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject(userId.toString())
                .claim("userId", userId.toString())
                .claim("permissions", permissions)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(900))
                .build();
    }

    private String validRequestBody() {
        return """
                {
                  "email": "new.user@example.com",
                  "firstNames": "Ada",
                  "preferredName": "Ada",
                  "lastName": "Lovelace",
                  "workedForUsBefore": false,
                  "position": "Chef",
                  "startDate": "2026-07-01",
                  "endDate": "2026-12-31",
                  "contractType": "TEMPORARY",
                  "grossHourlyWage": 16.50,
                  "paymentFrequency": "WEEKLY",
                  "travelAllowance": true
                }
                """;
    }
}
