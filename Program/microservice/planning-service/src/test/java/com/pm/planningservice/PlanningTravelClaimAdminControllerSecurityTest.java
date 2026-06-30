package com.pm.planningservice;

import com.pm.planningservice.config.SecurityConfig;
import com.pm.planningservice.controller.PlanningTravelClaimAdminController;
import com.pm.planningservice.dto.EmployeePlanningAssignmentDTO;
import com.pm.planningservice.model.TravelClaimStatus;
import com.pm.planningservice.service.EmployeePlanningService;
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

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.http.MediaType.IMAGE_PNG_VALUE;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PlanningTravelClaimAdminController.class)
@Import(SecurityConfig.class)
class PlanningTravelClaimAdminControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private EmployeePlanningService employeePlanningService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void anonymousPendingClaimsRequestIsUnauthorized() throws Exception {
        mockMvc.perform(get("/planning/travel-claims/pending"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(employeePlanningService);
    }

    @Test
    void pendingClaimsWithoutManageTimesheetsPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/planning/travel-claims/pending")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(employeePlanningService);
    }

    @Test
    void pendingClaimsWithManageTimesheetsPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_TIMESHEETS"), companyId, UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(employeePlanningService.listPendingTravelClaims(companyId)).thenReturn(List.of(new EmployeePlanningAssignmentDTO()));

        mockMvc.perform(get("/planning/travel-claims/pending")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());

        verify(employeePlanningService).listPendingTravelClaims(companyId);
    }

    @Test
    void reviewTravelClaimWithoutManageTimesheetsPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(put("/planning/travel-claims/{scheduleEntryId}/review", UUID.randomUUID())
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validReviewBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(employeePlanningService);
    }

    @Test
    void reviewTravelClaimWithManageTimesheetsPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID scheduleEntryId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_TIMESHEETS"), companyId, userId);
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(employeePlanningService.reviewTravelClaim(
                companyId,
                userId,
                scheduleEntryId,
                TravelClaimStatus.APPROVED,
                null,
                "token"
        )).thenReturn(new EmployeePlanningAssignmentDTO());

        mockMvc.perform(put("/planning/travel-claims/{scheduleEntryId}/review", scheduleEntryId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validReviewBody()))
                .andExpect(status().isOk());

        verify(employeePlanningService).reviewTravelClaim(
                companyId,
                userId,
                scheduleEntryId,
                TravelClaimStatus.APPROVED,
                null,
                "token"
        );
    }

    @Test
    void claimProofWithoutManageTimesheetsPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/planning/travel-claims/{scheduleEntryId}/proof", UUID.randomUUID())
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(employeePlanningService);
    }

    @Test
    void claimProofWithManageTimesheetsPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID scheduleEntryId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_TIMESHEETS"), companyId, UUID.randomUUID());
        byte[] proof = "png".getBytes();

        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(employeePlanningService.getTravelProofForAdmin(companyId, scheduleEntryId))
                .thenReturn(new EmployeePlanningService.ProofImage(proof, IMAGE_PNG_VALUE));

        mockMvc.perform(get("/planning/travel-claims/{scheduleEntryId}/proof", scheduleEntryId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(IMAGE_PNG_VALUE))
                .andExpect(content().bytes(proof));

        verify(employeePlanningService).getTravelProofForAdmin(companyId, scheduleEntryId);
    }

    private String validReviewBody() {
        return """
                {
                  "status": "APPROVED"
                }
                """;
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
