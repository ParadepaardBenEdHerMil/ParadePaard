package com.pm.userservice;

import com.pm.userservice.config.SecurityConfig;
import com.pm.userservice.controller.LeaveRequestController;
import com.pm.userservice.dto.LeaveRequestResponseDTO;
import com.pm.userservice.security.UserPermission;
import com.pm.userservice.service.LeaveBalanceService;
import com.pm.userservice.service.LeaveRequestService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(LeaveRequestController.class)
@Import(SecurityConfig.class)
class LeaveRequestControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private LeaveRequestService leaveRequestService;

    @MockitoBean
    private LeaveBalanceService leaveBalanceService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @MockitoBean(name = "userPermission")
    private UserPermission userPermission;

    @Test
    void anonymousApproveRequestIsUnauthorized() throws Exception {
        mockMvc.perform(put("/leave-requests/{requestId}/approve", UUID.randomUUID())
                        .contentType(APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(leaveRequestService);
    }

    @Test
    void approveRequestWithoutApprovePermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(put("/leave-requests/{requestId}/approve", UUID.randomUUID())
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(leaveRequestService);
    }

    @Test
    void approveRequestWithApprovePermissionReachesController() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), List.of("CAN_APPROVE_LEAVE_REQUESTS"), companyId);
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(leaveRequestService.approveLeaveRequest(eq(requestId), eq(companyId), eq("ok")))
                .thenReturn(new LeaveRequestResponseDTO());

        mockMvc.perform(put("/leave-requests/{requestId}/approve", requestId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"reason":"ok"}
                                """))
                .andExpect(status().isOk());
    }

    @Test
    void getUserLeaveRequestsDeniesAuthenticatedNonSelfWithoutAdminPermission() throws Exception {
        UUID userId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(userPermission.isSelf(eq(userId), any())).thenReturn(false);

        mockMvc.perform(get("/users/{userId}/leave-requests", userId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(leaveRequestService);
    }

    @Test
    void getUserLeaveRequestsAllowsSelfWithoutAdminPermission() throws Exception {
        UUID userId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(userId, List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(userPermission.isSelf(eq(userId), any())).thenReturn(true);
        when(leaveRequestService.getUserLeaveRequests(userId)).thenReturn(List.of());

        mockMvc.perform(get("/users/{userId}/leave-requests", userId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());
    }

    @Test
    void getAllLeaveRequestsWithoutViewAllPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/leave-requests")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(leaveRequestService);
    }

    private Jwt jwtWithPermissions(UUID userId, List<String> permissions) {
        return jwtWithPermissions(userId, permissions, null);
    }

    private Jwt jwtWithPermissions(UUID userId, List<String> permissions, UUID companyId) {
        Jwt.Builder builder = Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject(userId.toString())
                .claim("userId", userId.toString())
                .claim("permissions", permissions)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(900));
        if (companyId != null) {
            builder.claim("companyId", companyId.toString());
        }
        return builder.build();
    }
}
