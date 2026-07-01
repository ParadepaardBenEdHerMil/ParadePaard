package com.pm.userservice;

import com.pm.userservice.config.SecurityConfig;
import com.pm.userservice.controller.AuditLogController;
import com.pm.userservice.dto.AuditLogEntryDTO;
import com.pm.userservice.dto.PagedResponseDTO;
import com.pm.userservice.service.AuditLogService;
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

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuditLogController.class)
@Import(SecurityConfig.class)
class AuditLogControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuditLogService auditLogService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void anonymousAuditLogRecordIsUnauthorized() throws Exception {
        mockMvc.perform(post("/internal/audit-log")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"category":"USER","action":"UPDATED"}
                                """))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(auditLogService);
    }

    @Test
    void authenticatedAuditLogRecordWithoutInternalMutationPermissionIsForbidden() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(userId, companyId, List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/internal/audit-log")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "category":"USER",
                                  "action":"UPDATED",
                                  "entityType":"EMPLOYEE",
                                  "summary":"Changed profile"
                                }
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(auditLogService);
    }

    @Test
    void authenticatedAuditLogRecordWithMutationPermissionReachesController() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(userId, companyId, List.of("CAN_MANAGE_PLANNING"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(auditLogService.record(eq(companyId), eq(userId), org.mockito.ArgumentMatchers.any()))
                .thenReturn(new AuditLogEntryDTO());

        mockMvc.perform(post("/internal/audit-log")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "category":"USER",
                                  "action":"UPDATED",
                                  "entityType":"EMPLOYEE",
                                  "summary":"Changed profile"
                                }
                                """))
                .andExpect(status().isOk());
    }

    @Test
    void listAuditLogWithoutManageCompanyPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/admin/audit-log")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(auditLogService);
    }

    @Test
    void listAuditLogWithManageCompanyPermissionReachesController() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(userId, companyId, List.of("CAN_MANAGE_COMPANY"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(auditLogService.list(eq(companyId), eq(null), eq(null), eq(null), eq(null), eq(null), eq(null), eq(null), eq(0), eq(50)))
                .thenReturn(new PagedResponseDTO<>(List.of(), 0, 50, 0, 0, false, false));

        mockMvc.perform(get("/admin/audit-log")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());
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
}
