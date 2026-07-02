package com.pm.planningservice;

import com.pm.planningservice.config.SecurityConfig;
import com.pm.planningservice.controller.PlanningClientCompanyController;
import com.pm.planningservice.dto.PlanningClientCompanyDTO;
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

@WebMvcTest(PlanningClientCompanyController.class)
@Import(SecurityConfig.class)
class PlanningClientCompanyControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PlanningManagementService planningManagementService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void anonymousListClientCompaniesIsUnauthorized() throws Exception {
        mockMvc.perform(get("/planning/clients"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(planningManagementService);
    }

    @Test
    void listClientCompaniesWithoutManagePlanningPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/planning/clients")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(planningManagementService);
    }

    @Test
    void listClientCompaniesWithManagePlanningPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_PLANNING"), companyId);
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(planningManagementService.listClientCompanies(companyId)).thenReturn(List.of());

        mockMvc.perform(get("/planning/clients")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());

        verify(planningManagementService).listClientCompanies(companyId);
    }

    @Test
    void createClientCompanyWithoutManagePlanningPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/planning/clients")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"name":"Client A"}
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(planningManagementService);
    }

    @Test
    void createClientCompanyWithManagePlanningPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_PLANNING"), companyId);
        PlanningClientCompanyDTO response = new PlanningClientCompanyDTO();
        response.setClientCompanyId(UUID.randomUUID());
        response.setName("Client A");

        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(planningManagementService.createClientCompany(eq(companyId), any(), eq("token")))
                .thenReturn(response);

        mockMvc.perform(post("/planning/clients")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"name":"Client A"}
                                """))
                .andExpect(status().isOk());

        verify(planningManagementService).createClientCompany(eq(companyId), any(), eq("token"));
    }

    @Test
    void deleteClientCompanyWithoutManagePlanningPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(delete("/planning/clients/{clientCompanyId}", UUID.randomUUID())
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(planningManagementService);
    }

    @Test
    void deleteClientCompanyWithManagePlanningPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_PLANNING"), companyId);
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(delete("/planning/clients/{clientCompanyId}", clientCompanyId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isNoContent());

        verify(planningManagementService).deleteClientCompany(companyId, clientCompanyId, "token");
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
