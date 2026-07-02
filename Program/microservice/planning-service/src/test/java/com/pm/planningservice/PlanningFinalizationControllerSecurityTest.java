package com.pm.planningservice;

import com.pm.planningservice.config.SecurityConfig;
import com.pm.planningservice.controller.PlanningFinalizationController;
import com.pm.planningservice.dto.FinalizePlanningResponseDTO;
import com.pm.planningservice.service.PlanningFinalizationService;
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
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PlanningFinalizationController.class)
@Import(SecurityConfig.class)
class PlanningFinalizationControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PlanningFinalizationService planningFinalizationService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void anonymousFinalizePlanningIsUnauthorized() throws Exception {
        mockMvc.perform(post("/planning/finalization")
                        .contentType(APPLICATION_JSON)
                        .content(validFinalizeBody(UUID.randomUUID())))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(planningFinalizationService);
    }

    @Test
    void finalizePlanningWithoutManagePermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/planning/finalization")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validFinalizeBody(UUID.randomUUID())))
                .andExpect(status().isForbidden());

        verifyNoInteractions(planningFinalizationService);
    }

    @Test
    void finalizePlanningWithManagePermissionUsesAuthenticatedCompanyId() throws Exception {
        UUID authenticatedCompanyId = UUID.randomUUID();
        UUID bodyCompanyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_PLANNING"), authenticatedCompanyId, UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(planningFinalizationService.finalizePlanning(any())).thenReturn(new FinalizePlanningResponseDTO());

        mockMvc.perform(post("/planning/finalization")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validFinalizeBody(bodyCompanyId)))
                .andExpect(status().isOk());

        verify(planningFinalizationService).finalizePlanning(argThat(request ->
                authenticatedCompanyId.equals(request.getCompanyId()) &&
                        Integer.valueOf(26).equals(request.getIsoWeek()) &&
                        Integer.valueOf(2026).equals(request.getWeekBasedYear())
        ));
    }

    private String validFinalizeBody(UUID companyId) {
        return """
                {
                  "companyId": "%s",
                  "isoWeek": 26,
                  "weekBasedYear": 2026
                }
                """.formatted(companyId);
    }

    private Jwt jwtWithPermissions(List<String> permissions, UUID companyId, UUID userId) {
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
