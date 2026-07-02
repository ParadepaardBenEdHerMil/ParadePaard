package com.pm.planningservice;

import com.pm.planningservice.config.SecurityConfig;
import com.pm.planningservice.controller.PlanningViewController;
import com.pm.planningservice.service.EmployeePlanningService;
import com.pm.planningservice.service.PlanningViewService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PlanningViewController.class)
@Import(SecurityConfig.class)
class PlanningViewControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PlanningViewService planningViewService;

    @MockitoBean
    private EmployeePlanningService employeePlanningService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void anonymousPlanningViewRequestIsUnauthorized() throws Exception {
        mockMvc.perform(get("/planning/view"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(planningViewService);
    }

    @Test
    void planningViewWithoutPlanningOrBillingPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/planning/view")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(planningViewService);
    }

    @Test
    void billingRateViewerMayAccessPlanningViewWithoutAllocationDetails() throws Exception {
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_VIEW_BILLING_RATES"), companyId);
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(planningViewService.getPlanningHierarchy(eq(companyId), eq(null), eq(null), eq(null), eq(false)))
                .thenReturn(List.of());

        mockMvc.perform(get("/planning/view")
                        .header("Authorization", "Bearer token")
                        .param("includeAllocationDetails", "false"))
                .andExpect(status().isOk());
    }

    @Test
    void billingRateViewerCannotAccessPlanningAllocations() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of("CAN_VIEW_BILLING_RATES"), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/planning/view")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(planningViewService);
    }

    @Test
    void planningManagerMayAccessPlanningViewWithAllocationDetails() throws Exception {
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_PLANNING"), companyId);
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(planningViewService.getPlanningHierarchy(eq(companyId), eq(null), eq(null), eq(null), eq(true)))
                .thenReturn(List.of());

        mockMvc.perform(get("/planning/view")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());
    }

    private Jwt jwtWithPermissions(List<String> permissions, UUID companyId) {
        return Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject(UUID.randomUUID().toString())
                .claim("userId", UUID.randomUUID().toString())
                .claim("companyId", companyId.toString())
                .claim("permissions", permissions)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(900))
                .build();
    }
}
