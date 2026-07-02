package com.pm.planningservice;

import com.pm.planningservice.config.SecurityConfig;
import com.pm.planningservice.controller.EmployeePlanningController;
import com.pm.planningservice.dto.EmployeePlanningAssignmentDTO;
import com.pm.planningservice.model.ScheduleEntryStatus;
import com.pm.planningservice.service.EmployeePlanningService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.http.MediaType.IMAGE_PNG_VALUE;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(EmployeePlanningController.class)
@Import(SecurityConfig.class)
class EmployeePlanningControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private EmployeePlanningService employeePlanningService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void anonymousGetMyPlanningIsUnauthorized() throws Exception {
        mockMvc.perform(get("/planning/me"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(employeePlanningService);
    }

    @Test
    void getMyPlanningWithoutPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/planning/me")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(employeePlanningService);
    }

    @Test
    void getMyPlanningWithOwnTimesheetPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_VIEW_OWN_TIMESHEETS"), companyId, userId);
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(employeePlanningService.getMyAssignments(companyId, userId, "upcoming"))
                .thenReturn(List.of(new EmployeePlanningAssignmentDTO()));

        mockMvc.perform(get("/planning/me")
                        .header("Authorization", "Bearer token")
                        .param("scope", "upcoming"))
                .andExpect(status().isOk());

        verify(employeePlanningService).getMyAssignments(companyId, userId, "upcoming");
    }

    @Test
    void getMyAssignmentWithoutPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/planning/me/assignments/{scheduleEntryId}", UUID.randomUUID())
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(employeePlanningService);
    }

    @Test
    void getMyAssignmentWithManagePlanningPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID scheduleEntryId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_PLANNING"), companyId, userId);
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(employeePlanningService.getMyAssignmentDetail(companyId, userId, scheduleEntryId))
                .thenReturn(new EmployeePlanningAssignmentDTO());

        mockMvc.perform(get("/planning/me/assignments/{scheduleEntryId}", scheduleEntryId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());

        verify(employeePlanningService).getMyAssignmentDetail(companyId, userId, scheduleEntryId);
    }

    @Test
    void respondToShiftWithoutPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(put("/planning/me/assignments/{scheduleEntryId}/response", UUID.randomUUID())
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"status":"CONFIRMED"}
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(employeePlanningService);
    }

    @Test
    void respondToShiftWithOwnTimesheetPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID scheduleEntryId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_VIEW_OWN_TIMESHEETS"), companyId, userId);
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(employeePlanningService.respondToAssignment(companyId, userId, scheduleEntryId, ScheduleEntryStatus.CONFIRMED))
                .thenReturn(new EmployeePlanningAssignmentDTO());

        mockMvc.perform(put("/planning/me/assignments/{scheduleEntryId}/response", scheduleEntryId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"status":"CONFIRMED"}
                                """))
                .andExpect(status().isOk());

        verify(employeePlanningService).respondToAssignment(companyId, userId, scheduleEntryId, ScheduleEntryStatus.CONFIRMED);
    }

    @Test
    void submitTravelClaimWithoutPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        MockMultipartFile file = new MockMultipartFile("file", "proof.png", IMAGE_PNG_VALUE, "png".getBytes());

        mockMvc.perform(multipart("/planning/me/assignments/{scheduleEntryId}/travel-claim", UUID.randomUUID())
                        .file(file)
                        .param("kilometers", "12.50")
                        .with(req -> {
                            req.setMethod("POST");
                            return req;
                        })
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(employeePlanningService);
    }

    @Test
    void submitTravelClaimWithOwnTimesheetPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID scheduleEntryId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_VIEW_OWN_TIMESHEETS"), companyId, userId);
        MockMultipartFile file = new MockMultipartFile("file", "proof.png", IMAGE_PNG_VALUE, "png".getBytes());
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(employeePlanningService.saveTravelClaim(companyId, userId, scheduleEntryId, new BigDecimal("12.50"), file))
                .thenReturn(new EmployeePlanningAssignmentDTO());

        mockMvc.perform(multipart("/planning/me/assignments/{scheduleEntryId}/travel-claim", scheduleEntryId)
                        .file(file)
                        .param("kilometers", "12.50")
                        .with(req -> {
                            req.setMethod("POST");
                            return req;
                        })
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());

        verify(employeePlanningService).saveTravelClaim(companyId, userId, scheduleEntryId, new BigDecimal("12.50"), file);
    }

    @Test
    void getTravelProofWithoutPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/planning/me/assignments/{scheduleEntryId}/travel-proof", UUID.randomUUID())
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(employeePlanningService);
    }

    @Test
    void getTravelProofWithOwnTimesheetPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID scheduleEntryId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_VIEW_OWN_TIMESHEETS"), companyId, userId);
        byte[] proof = "png".getBytes();
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(employeePlanningService.getTravelProofForEmployee(companyId, userId, scheduleEntryId))
                .thenReturn(new EmployeePlanningService.ProofImage(proof, IMAGE_PNG_VALUE));

        mockMvc.perform(get("/planning/me/assignments/{scheduleEntryId}/travel-proof", scheduleEntryId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(IMAGE_PNG_VALUE))
                .andExpect(content().bytes(proof));

        verify(employeePlanningService).getTravelProofForEmployee(companyId, userId, scheduleEntryId);
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
