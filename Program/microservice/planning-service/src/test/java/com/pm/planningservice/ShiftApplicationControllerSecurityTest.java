package com.pm.planningservice;

import com.pm.planningservice.config.SecurityConfig;
import com.pm.planningservice.controller.ShiftApplicationController;
import com.pm.planningservice.dto.OpenShiftDTO;
import com.pm.planningservice.service.ShiftApplicationService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ShiftApplicationController.class)
@Import(SecurityConfig.class)
class ShiftApplicationControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ShiftApplicationService shiftApplicationService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void anonymousGetOpenShiftsIsUnauthorized() throws Exception {
        mockMvc.perform(get("/planning/open-shifts"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(shiftApplicationService);
    }

    @Test
    void getOpenShiftsWithoutPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/planning/open-shifts")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(shiftApplicationService);
    }

    @Test
    void getOpenShiftsWithOwnTimesheetPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_VIEW_OWN_TIMESHEETS"), companyId, userId);
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(shiftApplicationService.getOpenShifts(companyId, userId))
                .thenReturn(List.of(new OpenShiftDTO()));

        mockMvc.perform(get("/planning/open-shifts")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());

        verify(shiftApplicationService).getOpenShifts(companyId, userId);
    }

    @Test
    void anonymousApplyIsUnauthorized() throws Exception {
        mockMvc.perform(post("/planning/open-shifts/{shiftId}/application", UUID.randomUUID()))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(shiftApplicationService);
    }

    @Test
    void applyWithoutPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/planning/open-shifts/{shiftId}/application", UUID.randomUUID())
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(shiftApplicationService);
    }

    @Test
    void applyWithOwnTimesheetPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID shiftId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_VIEW_OWN_TIMESHEETS"), companyId, userId);
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(shiftApplicationService.apply(companyId, userId, shiftId))
                .thenReturn(new OpenShiftDTO());

        mockMvc.perform(post("/planning/open-shifts/{shiftId}/application", shiftId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());

        verify(shiftApplicationService).apply(companyId, userId, shiftId);
    }

    @Test
    void applyRejectionIsBadRequest() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID shiftId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_VIEW_OWN_TIMESHEETS"), companyId, userId);
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(shiftApplicationService.apply(companyId, userId, shiftId))
                .thenThrow(new IllegalArgumentException("This shift is already fully staffed"));

        mockMvc.perform(post("/planning/open-shifts/{shiftId}/application", shiftId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void withdrawWithoutPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(delete("/planning/open-shifts/{shiftId}/application", UUID.randomUUID())
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(shiftApplicationService);
    }

    @Test
    void withdrawWithOwnTimesheetPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID shiftId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_VIEW_OWN_TIMESHEETS"), companyId, userId);
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(shiftApplicationService.withdraw(companyId, userId, shiftId))
                .thenReturn(new OpenShiftDTO());

        mockMvc.perform(delete("/planning/open-shifts/{shiftId}/application", shiftId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());

        verify(shiftApplicationService).withdraw(companyId, userId, shiftId);
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
