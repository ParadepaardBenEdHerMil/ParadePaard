package com.pm.timesheetservice;

import com.pm.timesheetservice.config.SecurityConfig;
import com.pm.timesheetservice.controller.TimesheetController;
import com.pm.timesheetservice.dto.PagedResponseDTO;
import com.pm.timesheetservice.dto.TimesheetRequestDTO;
import com.pm.timesheetservice.dto.TimesheetResponseDTO;
import com.pm.timesheetservice.exception.InvalidTimesheetStateException;
import com.pm.timesheetservice.security.TimesheetPermission;
import com.pm.timesheetservice.service.TimesheetService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TimesheetController.class)
@Import(SecurityConfig.class)
class TimesheetControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TimesheetService timesheetService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @MockitoBean(name = "timesheetPermission")
    private TimesheetPermission timesheetPermission;

    @Test
    void anonymousGetTimesheetsIsUnauthorized() throws Exception {
        mockMvc.perform(get("/timesheet"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(timesheetService);
    }

    @Test
    void getTimesheetsWithoutViewAllPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/timesheet")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(timesheetService);
    }

    @Test
    void getTimesheetsWithViewAllPermissionReachesController() throws Exception {
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), List.of("CAN_VIEW_ALL_TIMESHEETS")));
        when(timesheetService.getTimesheets()).thenReturn(List.of(timesheet("Ada")));

        mockMvc.perform(get("/timesheet")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Ada"));
    }

    @Test
    void getTimesheetsPageWithViewAllPermissionReachesController() throws Exception {
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), List.of("CAN_VIEW_ALL_TIMESHEETS")));
        when(timesheetService.getTimesheetsPage(0, 100)).thenReturn(
                new PagedResponseDTO<>(List.of(timesheet("Ada")), 0, 100, 1, 1, false, false)
        );

        mockMvc.perform(get("/timesheet/paged")
                        .header("Authorization", "Bearer token")
                        .param("page", "-5")
                        .param("size", "999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].name").value("Ada"))
                .andExpect(jsonPath("$.size").value(100));
    }

    @Test
    void getMyTimesheetsWithOwnPermissionReachesController() throws Exception {
        UUID userId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(userId, List.of("CAN_VIEW_OWN_TIMESHEETS")));
        when(timesheetService.getTimesheetsByUserId(userId)).thenReturn(List.of(timesheet("Ada")));

        mockMvc.perform(get("/timesheet/me")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Ada"));
    }

    @Test
    void getMyTimesheetsPageWithViewAllPermissionReachesController() throws Exception {
        UUID userId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(userId, List.of("CAN_VIEW_ALL_TIMESHEETS")));
        when(timesheetService.getTimesheetsByUserIdPage(userId, 0, 1)).thenReturn(
                new PagedResponseDTO<>(List.of(timesheet("Ada")), 0, 1, 1, 1, false, false)
        );

        mockMvc.perform(get("/timesheet/me/paged")
                        .header("Authorization", "Bearer token")
                        .param("page", "0")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].name").value("Ada"));
    }

    @Test
    void getTimesheetByIdWithOwnPermissionButNotOwnerIsForbidden() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID timesheetId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(userId, List.of("CAN_VIEW_OWN_TIMESHEETS")));
        when(timesheetPermission.isOwner(eq(timesheetId), any())).thenReturn(false);

        mockMvc.perform(get("/timesheet/{id}", timesheetId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(timesheetService);
    }

    @Test
    void getTimesheetByIdWithOwnPermissionAndOwnerReachesController() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID timesheetId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(userId, List.of("CAN_VIEW_OWN_TIMESHEETS")));
        when(timesheetPermission.isOwner(eq(timesheetId), any())).thenReturn(true);
        when(timesheetService.getTimesheetById(timesheetId)).thenReturn(timesheet("Ada"));

        mockMvc.perform(get("/timesheet/{id}", timesheetId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Ada"));
    }

    @Test
    void createTimesheetWithManagePermissionReachesController() throws Exception {
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), List.of("CAN_MANAGE_TIMESHEETS")));
        when(timesheetService.createTimesheet(any(TimesheetRequestDTO.class))).thenReturn(timesheet("Ada"));

        mockMvc.perform(post("/timesheet")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validRequestBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Ada"));
    }

    @Test
    void updateTimesheetWithManagePermissionReachesController() throws Exception {
        UUID timesheetId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), List.of("CAN_MANAGE_TIMESHEETS")));
        when(timesheetService.updateTimesheet(eq(timesheetId), any(TimesheetRequestDTO.class))).thenReturn(timesheet("Ada"));

        mockMvc.perform(put("/timesheet/{id}", timesheetId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validRequestBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Ada"));
    }

    @Test
    void deleteTimesheetWithManagePermissionReachesController() throws Exception {
        UUID timesheetId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), List.of("CAN_MANAGE_TIMESHEETS")));

        mockMvc.perform(delete("/timesheet/{id}", timesheetId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isNoContent());
    }

    // ---- TS-3: approve / reject are manager-only and enforce the state machine ----

    @Test
    void approveAnonymousIsUnauthorized() throws Exception {
        mockMvc.perform(post("/timesheet/{id}/approve", UUID.randomUUID()))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(timesheetService);
    }

    @Test
    void approveWithoutManagePermissionIsForbidden() throws Exception {
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), List.of("CAN_VIEW_ALL_TIMESHEETS")));

        mockMvc.perform(post("/timesheet/{id}/approve", UUID.randomUUID())
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(timesheetService);
    }

    @Test
    void rejectWithoutManagePermissionIsForbidden() throws Exception {
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), List.of("CAN_VIEW_ALL_TIMESHEETS")));

        mockMvc.perform(post("/timesheet/{id}/reject", UUID.randomUUID())
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(timesheetService);
    }

    @Test
    void approveWithManagePermissionReachesController() throws Exception {
        UUID timesheetId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), List.of("CAN_MANAGE_TIMESHEETS")));
        when(timesheetService.approveTimesheet(eq(timesheetId), any(), any())).thenReturn(timesheet("Ada"));

        mockMvc.perform(post("/timesheet/{id}/approve", timesheetId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("{\"reason\":\"ok\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Ada"));
    }

    @Test
    void rejectWithManagePermissionReachesController() throws Exception {
        UUID timesheetId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), List.of("CAN_MANAGE_TIMESHEETS")));
        when(timesheetService.rejectTimesheet(eq(timesheetId), any(), any())).thenReturn(timesheet("Ada"));

        mockMvc.perform(post("/timesheet/{id}/reject", timesheetId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("{\"reason\":\"bad hours\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void approveOnFinalizedTimesheetReturnsConflict() throws Exception {
        UUID timesheetId = UUID.randomUUID();
        when(jwtDecoder.decode("token")).thenReturn(jwtWithPermissions(UUID.randomUUID(), List.of("CAN_MANAGE_TIMESHEETS")));
        when(timesheetService.approveTimesheet(eq(timesheetId), any(), any()))
                .thenThrow(new InvalidTimesheetStateException("Timesheet " + timesheetId + " is APPROVED and can no longer be APPROVED"));

        mockMvc.perform(post("/timesheet/{id}/approve", timesheetId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isConflict());
    }

    private Jwt jwtWithPermissions(UUID userId, List<String> permissions) {
        return Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject(userId.toString())
                .claim("userId", userId.toString())
                .claim("permissions", permissions)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(900))
                .build();
    }

    private TimesheetResponseDTO timesheet(String name) {
        TimesheetResponseDTO dto = new TimesheetResponseDTO();
        dto.setTimesheetId(UUID.randomUUID().toString());
        dto.setUserId(UUID.randomUUID().toString());
        dto.setName(name);
        dto.setDateOfIssue("2026-07-01");
        dto.setHoursWorked(new BigDecimal("8.00"));
        return dto;
    }

    private String validRequestBody() {
        return """
                {
                  "userId": "11111111-1111-1111-1111-111111111111",
                  "name": "Ada",
                  "dateOfIssue": "2026-07-01",
                  "hoursWorked": 8.00,
                  "travelExpenses": 0.00
                }
                """;
    }
}
