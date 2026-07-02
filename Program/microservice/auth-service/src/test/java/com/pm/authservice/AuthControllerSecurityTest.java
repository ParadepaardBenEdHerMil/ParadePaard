package com.pm.authservice;

import com.pm.authservice.config.SecurityConfig;
import com.pm.authservice.controller.AuthController;
import com.pm.authservice.dto.AuthResponseDTO;
import com.pm.authservice.dto.RoleResponseDTO;
import com.pm.authservice.dto.UserRolesResponseDTO;
import com.pm.authservice.service.AuthService;
import com.pm.authservice.service.PasswordResetService;
import io.jsonwebtoken.JwtException;
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
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import(SecurityConfig.class)
class AuthControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private PasswordResetService passwordResetService;

    @MockitoBean
    private JwtUtil jwtUtil;

    @Test
    void anonymousListRolesIsForbidden() throws Exception {
        mockMvc.perform(get("/admin/roles"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(authService);
    }

    @Test
    void forgedBearerTokenCannotAccessProtectedRoute() throws Exception {
        doThrow(new JwtException("bad token")).when(jwtUtil).validateToken("fake-token");

        mockMvc.perform(get("/admin/roles")
                        .header("Authorization", "Bearer fake-token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(authService);
    }

    @Test
    void listRolesWithoutRolePermissionIsForbidden() throws Exception {
        stubAuthenticatedUser(List.of());

        mockMvc.perform(get("/admin/roles")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(authService);
    }

    @Test
    void listRolesWithAssignRolesPermissionReachesController() throws Exception {
        stubAuthenticatedUser(List.of("CAN_ASSIGN_ROLES"));

        RoleResponseDTO dto = new RoleResponseDTO();
        dto.setId("role-1");
        dto.setName("Manager");
        when(authService.getRoles(any())).thenReturn(List.of(dto));

        mockMvc.perform(get("/admin/roles")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("role-1"))
                .andExpect(jsonPath("$[0].name").value("Manager"));
    }

    @Test
    void switchPlatformCompanyScopeWithoutPermissionIsForbidden() throws Exception {
        stubAuthenticatedUser(List.of());

        mockMvc.perform(post("/platform/company-scope")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "companyId": "11111111-1111-1111-1111-111111111111"
                                }
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(authService);
    }

    @Test
    void switchPlatformCompanyScopeWithPlatformPermissionReachesController() throws Exception {
        stubAuthenticatedUser(List.of("CAN_MANAGE_PLATFORM"));

        AuthResponseDTO response = new AuthResponseDTO();
        response.setCompanyId("11111111-1111-1111-1111-111111111111");
        response.setUserId(UUID.randomUUID().toString());
        when(authService.switchPlatformCompanyScope(any(), eq(UUID.fromString("11111111-1111-1111-1111-111111111111"))))
                .thenReturn(org.springframework.http.ResponseEntity.ok(response));

        mockMvc.perform(post("/platform/company-scope")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "companyId": "11111111-1111-1111-1111-111111111111"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.companyId").value("11111111-1111-1111-1111-111111111111"));
    }

    @Test
    void setUserRolesWithoutPermissionIsForbidden() throws Exception {
        UUID userId = UUID.randomUUID();
        stubAuthenticatedUser(List.of());

        mockMvc.perform(put("/admin/users/{id}/roles", userId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validUpdateUserRolesBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(authService);
    }

    @Test
    void setUserRolesWithAssignRolesPermissionReachesController() throws Exception {
        UUID userId = UUID.randomUUID();
        stubAuthenticatedUser(List.of("CAN_ASSIGN_ROLES"));

        mockMvc.perform(put("/admin/users/{id}/roles", userId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validUpdateUserRolesBody()))
                .andExpect(status().isNoContent());
    }

    @Test
    void disableUserAllowsReviewOnboardingPermission() throws Exception {
        UUID userId = UUID.randomUUID();
        stubAuthenticatedUser(List.of("CAN_REVIEW_ONBOARDING"));

        mockMvc.perform(put("/admin/users/{id}/disable", userId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isNoContent());
    }

    @Test
    void enableUserWithoutManageUsersPermissionIsForbidden() throws Exception {
        UUID userId = UUID.randomUUID();
        stubAuthenticatedUser(List.of("CAN_REVIEW_ONBOARDING"));

        mockMvc.perform(put("/admin/users/{id}/enable", userId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(authService);
    }

    @Test
    void enableUserWithManageUsersPermissionReachesController() throws Exception {
        UUID userId = UUID.randomUUID();
        stubAuthenticatedUser(List.of("CAN_MANAGE_USERS"));

        mockMvc.perform(put("/admin/users/{id}/enable", userId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isNoContent());
    }

    @Test
    void createRoleWithCreateRolePermissionReturnsCreated() throws Exception {
        stubAuthenticatedUser(List.of("CAN_CREATE_ROLE"));

        RoleResponseDTO response = new RoleResponseDTO();
        response.setId("role-1");
        response.setName("MANAGER");
        response.setPermissions(List.of("CAN_VIEW_USERS"));
        when(authService.createRole(any(), any())).thenReturn(response);

        mockMvc.perform(post("/admin/roles")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validCreateRoleBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("role-1"))
                .andExpect(jsonPath("$.name").value("MANAGER"));
    }

    @Test
    void getUserRolesAllowsViewUsersPermission() throws Exception {
        UUID targetUserId = UUID.randomUUID();
        stubAuthenticatedUser(List.of("CAN_VIEW_USERS"));

        UserRolesResponseDTO response = new UserRolesResponseDTO();
        response.setUserId(targetUserId.toString());
        response.setRoles(List.of("USER"));
        when(authService.getUserRoles(any(), any())).thenReturn(List.of(response));

        mockMvc.perform(get("/admin/users/roles")
                        .header("Authorization", "Bearer token")
                        .param("ids", targetUserId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].userId").value(targetUserId.toString()))
                .andExpect(jsonPath("$[0].roles[0]").value("USER"));
    }

    @Test
    void getAllPermissionsAllowsEditRolesPermission() throws Exception {
        stubAuthenticatedUser(List.of("CAN_EDIT_ROLES"));
        when(authService.getAllPermissionNames()).thenReturn(List.of("CAN_VIEW_USERS", "CAN_MANAGE_USERS"));

        mockMvc.perform(get("/admin/permissions")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("CAN_VIEW_USERS"))
                .andExpect(jsonPath("$[1]").value("CAN_MANAGE_USERS"));
    }

    @Test
    void deleteUserAccountWithDeleteUsersPermissionReachesController() throws Exception {
        UUID userId = UUID.randomUUID();
        stubAuthenticatedUser(List.of("CAN_DELETE_USERS"));

        mockMvc.perform(delete("/admin/users/{id}", userId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isNoContent());
    }

    private void stubAuthenticatedUser(List<String> permissions) {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        Claims claims = mock(Claims.class);

        doNothing().when(jwtUtil).validateToken("token");
        when(jwtUtil.extractEmail("token")).thenReturn("admin@example.com");
        when(jwtUtil.extractClaims("token")).thenReturn(claims);
        when(jwtUtil.extractPermissions("token")).thenReturn(permissions);
        when(claims.get("userId", String.class)).thenReturn(userId.toString());
        when(claims.get("companyId", String.class)).thenReturn(companyId.toString());
    }

    private String validUpdateUserRolesBody() {
        return """
                {
                  "roles": ["USER"]
                }
                """;
    }

    private String validCreateRoleBody() {
        return """
                {
                  "name": "MANAGER",
                  "permissions": ["CAN_VIEW_USERS"],
                  "color": "#123456"
                }
                """;
    }
}
