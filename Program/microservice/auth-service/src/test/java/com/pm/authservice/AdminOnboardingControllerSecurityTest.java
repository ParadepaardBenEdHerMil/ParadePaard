package com.pm.authservice;

import com.pm.authservice.config.SecurityConfig;
import com.pm.authservice.controller.AdminOnboardingController;
import com.pm.authservice.dto.AdminEmailSendResponseDTO;
import com.pm.authservice.dto.AdminOnboardUserRequestDTO;
import com.pm.authservice.dto.AdminOnboardUserResponseDTO;
import com.pm.authservice.service.AdminOnboardingService;
import com.pm.authservice.util.JwtUtil;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
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
    private AdminOnboardingService adminOnboardingService;

    @MockitoBean
    private JwtUtil jwtUtil;

    @Test
    void anonymousOnboardUserIsForbidden() throws Exception {
        mockMvc.perform(post("/admin/onboard-user")
                        .contentType(APPLICATION_JSON)
                        .content(validRequestBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(adminOnboardingService);
    }

    @Test
    void onboardUserWithoutPermissionIsForbidden() throws Exception {
        stubAuthenticatedUser(List.of());

        mockMvc.perform(post("/admin/onboard-user")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validRequestBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(adminOnboardingService);
    }

    @Test
    void onboardUserWithPermissionReachesController() throws Exception {
        stubAuthenticatedUser(List.of("CAN_ONBOARD_USERS"));

        AdminOnboardUserResponseDTO response = new AdminOnboardUserResponseDTO();
        response.setUserId(UUID.randomUUID().toString());
        response.setEmail("new.user@example.com");
        response.setUsername("new.user");
        response.setTemporaryPassword("Temp123456");
        response.setOnboardingEmailSent(true);

        when(adminOnboardingService.onboardUser(any(AdminOnboardUserRequestDTO.class), any()))
                .thenReturn(response);

        mockMvc.perform(post("/admin/onboard-user")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validRequestBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("new.user"))
                .andExpect(jsonPath("$.onboardingEmailSent").value(true));
    }

    @Test
    void resendOnboardingEmailWithoutPermissionIsForbidden() throws Exception {
        stubAuthenticatedUser(List.of());

        mockMvc.perform(post("/admin/users/{userId}/resend-onboarding-email", UUID.randomUUID())
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(adminOnboardingService);
    }

    @Test
    void resendOnboardingEmailWithPermissionReachesController() throws Exception {
        stubAuthenticatedUser(List.of("CAN_ONBOARD_USERS"));

        UUID userId = UUID.randomUUID();
        AdminEmailSendResponseDTO response = new AdminEmailSendResponseDTO();
        response.setUserId(userId.toString());
        response.setEmail("new.user@example.com");
        response.setEmailSent(true);

        when(adminOnboardingService.resendOnboardingEmail(eq(userId), any()))
                .thenReturn(response);

        mockMvc.perform(post("/admin/users/{userId}/resend-onboarding-email", userId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("new.user@example.com"))
                .andExpect(jsonPath("$.emailSent").value(true));
    }

    private void stubAuthenticatedUser(List<String> permissions) {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        Claims claims = mock(Claims.class);

        when(jwtUtil.extractClaims("token")).thenReturn(claims);
        when(jwtUtil.extractEmail("token")).thenReturn("admin@example.com");
        when(jwtUtil.extractPermissions("token")).thenReturn(permissions);
        when(claims.get("userId", String.class)).thenReturn(userId.toString());
        when(claims.get("companyId", String.class)).thenReturn(companyId.toString());
    }

    private String validRequestBody() {
        return """
                {
                  "email": "new.user@example.com",
                  "firstName": "Ada",
                  "lastName": "Lovelace"
                }
                """;
    }
}
