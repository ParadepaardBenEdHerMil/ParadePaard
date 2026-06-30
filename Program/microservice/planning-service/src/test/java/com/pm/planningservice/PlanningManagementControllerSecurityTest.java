package com.pm.planningservice;

import com.pm.planningservice.config.SecurityConfig;
import com.pm.planningservice.controller.PlanningManagementController;
import com.pm.planningservice.dto.PlanningAssignmentMutationResponseDTO;
import com.pm.planningservice.dto.PlanningLocationDTO;
import com.pm.planningservice.dto.PlanningProjectMutationResponseDTO;
import com.pm.planningservice.dto.PlanningShiftMutationResponseDTO;
import com.pm.planningservice.service.PlanningManagementService;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PlanningManagementController.class)
@Import(SecurityConfig.class)
class PlanningManagementControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PlanningManagementService planningManagementService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void anonymousListLocationsIsUnauthorized() throws Exception {
        mockMvc.perform(get("/planning/locations"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(planningManagementService);
    }

    @Test
    void listLocationsWithoutManagePlanningPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/planning/locations")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(planningManagementService);
    }

    @Test
    void listLocationsWithManagePlanningPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_PLANNING"), companyId, UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(planningManagementService.listLocations(companyId, clientCompanyId)).thenReturn(List.of(new PlanningLocationDTO()));

        mockMvc.perform(get("/planning/locations")
                        .header("Authorization", "Bearer token")
                        .param("clientCompanyId", clientCompanyId.toString()))
                .andExpect(status().isOk());

        verify(planningManagementService).listLocations(companyId, clientCompanyId);
    }

    @Test
    void createLocationWithoutManagePlanningPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/planning/locations")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validLocationBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(planningManagementService);
    }

    @Test
    void createLocationWithManagePlanningPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_PLANNING"), companyId, UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(planningManagementService.createLocation(eq(companyId), any(), eq("token")))
                .thenReturn(new PlanningLocationDTO());

        mockMvc.perform(post("/planning/locations")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validLocationBody()))
                .andExpect(status().isOk());

        verify(planningManagementService).createLocation(eq(companyId), any(), eq("token"));
    }

    @Test
    void createProjectWithoutManagePlanningPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/planning/projects")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validProjectBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(planningManagementService);
    }

    @Test
    void createProjectWithManagePlanningPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_PLANNING"), companyId, userId);
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(planningManagementService.createProject(eq(companyId), eq(userId), any(), eq("token")))
                .thenReturn(new PlanningProjectMutationResponseDTO());

        mockMvc.perform(post("/planning/projects")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validProjectBody()))
                .andExpect(status().isOk());

        verify(planningManagementService).createProject(eq(companyId), eq(userId), any(), eq("token"));
    }

    @Test
    void createShiftWithoutManagePlanningPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/planning/projects/{projectId}/shifts", UUID.randomUUID())
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validShiftBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(planningManagementService);
    }

    @Test
    void createShiftWithManagePlanningPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_PLANNING"), companyId, UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(planningManagementService.createShift(eq(companyId), eq(projectId), any(), eq("token")))
                .thenReturn(new PlanningShiftMutationResponseDTO());

        mockMvc.perform(post("/planning/projects/{projectId}/shifts", projectId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validShiftBody()))
                .andExpect(status().isOk());

        verify(planningManagementService).createShift(eq(companyId), eq(projectId), any(), eq("token"));
    }

    @Test
    void createAssignmentWithoutManagePlanningPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/planning/shifts/{shiftId}/assignments", UUID.randomUUID())
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validAssignmentBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(planningManagementService);
    }

    @Test
    void createAssignmentWithManagePlanningPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID shiftId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_PLANNING"), companyId, UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(planningManagementService.createAssignment(eq(companyId), eq(shiftId), any(), eq("token")))
                .thenReturn(new PlanningAssignmentMutationResponseDTO());

        mockMvc.perform(post("/planning/shifts/{shiftId}/assignments", shiftId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validAssignmentBody()))
                .andExpect(status().isOk());

        verify(planningManagementService).createAssignment(eq(companyId), eq(shiftId), any(), eq("token"));
    }

    @Test
    void deleteLocationWithoutManagePlanningPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(delete("/planning/locations/{locationId}", UUID.randomUUID())
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(planningManagementService);
    }

    @Test
    void deleteLocationWithManagePlanningPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID locationId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_PLANNING"), companyId, UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(delete("/planning/locations/{locationId}", locationId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isNoContent());

        verify(planningManagementService).deleteLocation(companyId, locationId, "token");
    }

    private String validLocationBody() {
        return """
                {
                  "name": "Kitchen",
                  "streetName": "Main",
                  "houseNumber": "1",
                  "postalCode": "1234AB",
                  "city": "Amsterdam"
                }
                """;
    }

    private String validProjectBody() {
        return """
                {
                  "name": "Summer Event",
                  "startDate": "2026-07-01",
                  "endDate": "2026-07-02"
                }
                """;
    }

    private String validShiftBody() {
        return """
                {
                  "startTime": "2026-07-01T09:00:00",
                  "endTime": "2026-07-01T17:00:00",
                  "functionName": "Chef"
                }
                """;
    }

    private String validAssignmentBody() {
        return """
                {
                  "userId": "%s"
                }
                """.formatted(UUID.randomUUID());
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
