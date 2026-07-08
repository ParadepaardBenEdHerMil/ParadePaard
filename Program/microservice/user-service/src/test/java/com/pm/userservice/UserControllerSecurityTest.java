package com.pm.userservice;

import com.pm.userservice.config.SecurityConfig;
import com.pm.userservice.controller.UserController;
import com.pm.userservice.dto.CaoUserAssignDTO;
import com.pm.userservice.dto.OnboardingReviewUpdateDTO;
import com.pm.userservice.dto.PagedResponseDTO;
import com.pm.userservice.dto.UserRequestDTO;
import com.pm.userservice.dto.UserResponseDTO;
import com.pm.userservice.security.UserPermission;
import com.pm.userservice.service.UserService;
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
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(UserController.class)
@Import({SecurityConfig.class, com.pm.userservice.security.InternalServiceTokenService.class})
class UserControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @MockitoBean(name = "userPermission")
    private UserPermission userPermission;

    @Test
    void anonymousGetUsersIsUnauthorized() throws Exception {
        mockMvc.perform(get("/users"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(userService);
    }

    @Test
    void getUsersWithoutAdminPermissionIsForbidden() throws Exception {
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of()));

        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(userService);
    }

    @Test
    void getUsersAllowsReviewOnboardingPermission() throws Exception {
        UUID companyId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), companyId, List.of("CAN_REVIEW_ONBOARDING")));
        when(userService.getUsers(companyId)).thenReturn(List.of(userResponse("user-1", "ada@example.com")));

        mockMvc.perform(get("/users")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].userId").value("user-1"))
                .andExpect(jsonPath("$[0].email").value("ada@example.com"));
    }

    @Test
    void searchUsersWithoutPlanningPermissionIsForbidden() throws Exception {
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of()));

        mockMvc.perform(get("/users/search")
                        .header("Authorization", "Bearer token")
                        .param("q", "ada"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(userService);
    }

    @Test
    void searchUsersWithPlanningPermissionReachesController() throws Exception {
        UUID companyId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), companyId, List.of("CAN_MANAGE_PLANNING")));
        when(userService.searchActiveUsers(companyId, "ada", 7)).thenReturn(List.of(userResponse("user-1", "ada@example.com")));

        mockMvc.perform(get("/users/search")
                        .header("Authorization", "Bearer token")
                        .param("q", "ada")
                        .param("limit", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].email").value("ada@example.com"));
    }

    @Test
    void getUsersPageWithViewUsersPermissionReachesController() throws Exception {
        UUID companyId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), companyId, List.of("CAN_VIEW_USERS")));
        when(userService.getUsersPage(companyId, 0, 100, "name", "asc"))
                .thenReturn(new PagedResponseDTO<>(List.of(userResponse("user-1", "ada@example.com")), 0, 100, 1, 1, false, false));

        mockMvc.perform(get("/users/paged")
                        .header("Authorization", "Bearer token")
                        .param("page", "-4")
                        .param("size", "500"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].email").value("ada@example.com"))
                .andExpect(jsonPath("$.size").value(100));
    }

    @Test
    void getUserByIdWithoutPermissionAndNotSelfIsForbidden() throws Exception {
        UUID userId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of()));
        when(userPermission.isSelf(eq(userId), any())).thenReturn(false);

        mockMvc.perform(get("/users/{id}", userId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(userService);
    }

    @Test
    void getUserByIdAllowsSelfAccess() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(userId, companyId, List.of()));
        when(userPermission.isSelf(eq(userId), any())).thenReturn(true);
        when(userService.getUserById(userId, companyId)).thenReturn(userResponse(userId.toString(), "ada@example.com"));

        mockMvc.perform(get("/users/{id}", userId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(userId.toString()))
                .andExpect(jsonPath("$.email").value("ada@example.com"));
    }

    @Test
    void updateUserWithoutPermissionAndNotSelfIsForbidden() throws Exception {
        UUID userId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of()));
        when(userPermission.isSelf(eq(userId), any())).thenReturn(false);

        mockMvc.perform(put("/users/{id}", userId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validUserRequestBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(userService);
    }

    @Test
    void updateUserAllowsSelfAccess() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(userId, companyId, List.of()));
        when(userPermission.isSelf(eq(userId), any())).thenReturn(true);
        when(userService.updateUser(eq(userId), any(UserRequestDTO.class), eq(companyId), any(UUID.class)))
                .thenReturn(userResponse(userId.toString(), "ada@example.com"));

        mockMvc.perform(put("/users/{id}", userId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validUserRequestBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(userId.toString()));
    }

    @Test
    void updateOnboardingReviewWithoutReviewPermissionIsForbidden() throws Exception {
        UUID userId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of()));

        mockMvc.perform(put("/users/{id}/onboarding-review", userId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validOnboardingReviewBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(userService);
    }

    @Test
    void updateOnboardingReviewWithReviewPermissionReachesController() throws Exception {
        UUID actorUserId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        UUID targetUserId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(actorUserId, companyId, List.of("CAN_REVIEW_ONBOARDING")));
        when(userService.updateOnboardingReview(eq(targetUserId), eq(companyId), eq(actorUserId), any(OnboardingReviewUpdateDTO.class)))
                .thenReturn(userResponse(targetUserId.toString(), "ada@example.com"));

        mockMvc.perform(put("/users/{id}/onboarding-review", targetUserId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validOnboardingReviewBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(targetUserId.toString()));
    }

    @Test
    void assignUserCaoWithoutPermissionIsForbidden() throws Exception {
        UUID userId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of()));

        mockMvc.perform(put("/users/{id}/cao", userId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validCaoAssignBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(userService);
    }

    @Test
    void assignUserCaoWithManageUsersPermissionReachesController() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), companyId, List.of("CAN_MANAGE_USERS")));
        when(userService.assignUserCao(eq(userId), eq(companyId), any(CaoUserAssignDTO.class), any(UUID.class)))
                .thenReturn(userResponse(userId.toString(), "ada@example.com"));

        mockMvc.perform(put("/users/{id}/cao", userId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validCaoAssignBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(userId.toString()));
    }

    @Test
    void deleteUserWithoutDeletePermissionIsForbidden() throws Exception {
        UUID userId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of()));

        mockMvc.perform(delete("/users/{id}", userId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(userService);
    }

    @Test
    void deleteUserWithDeletePermissionButSelfIsForbidden() throws Exception {
        UUID userId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(userId, UUID.randomUUID(), List.of("CAN_DELETE_USERS")));
        when(userPermission.isSelf(eq(userId), any())).thenReturn(true);

        mockMvc.perform(delete("/users/{id}", userId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(userService);
    }

    @Test
    void deleteUserWithDeletePermissionAndNotSelfReachesController() throws Exception {
        UUID actorUserId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        UUID targetUserId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(actorUserId, companyId, List.of("CAN_DELETE_USERS")));
        when(userPermission.isSelf(eq(targetUserId), any())).thenReturn(false);

        mockMvc.perform(delete("/users/{id}", targetUserId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isNoContent());
    }

    private Jwt jwtWithPermissions(UUID userId, UUID companyId, List<String> permissions) {
        return Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject(userId.toString())
                .claim("userId", userId.toString())
                .claim("companyId", companyId.toString())
                .claim("permissions", permissions)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(900))
                .build();
    }

    private UserResponseDTO userResponse(String userId, String email) {
        UserResponseDTO dto = new UserResponseDTO();
        dto.setUserId(userId);
        dto.setEmail(email);
        return dto;
    }

    private String validUserRequestBody() {
        return """
                {
                  "email": "ada@example.com",
                  "preferredName": "Ada",
                  "firstNames": "Ada",
                  "lastName": "Lovelace"
                }
                """;
    }

    private String validOnboardingReviewBody() {
        return """
                {
                  "decision": "APPROVED",
                  "note": "Looks good",
                  "checkedSections": {
                    "identity": true
                  }
                }
                """;
    }

    private String validCaoAssignBody() {
        return """
                {
                  "caoId": "11111111-1111-1111-1111-111111111111",
                  "overrides": {
                    "hourlyWage": 16.5
                  }
                }
                """;
    }
}
