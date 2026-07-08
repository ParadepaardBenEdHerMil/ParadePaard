package com.pm.contractservice.controller;

import com.pm.contractservice.config.SecurityConfig;
import com.pm.contractservice.dto.ContractResponseDTO;
import com.pm.contractservice.security.ContractPermission;
import com.pm.contractservice.service.ContractService;
import com.pm.contractservice.service.FunctionService;
import com.pm.contractservice.service.MinimumWageService;
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
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.http.MediaType.APPLICATION_PDF;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ContractController.class)
@Import(SecurityConfig.class)
class ContractControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ContractService contractService;

    @MockitoBean
    private FunctionService functionService;

    @MockitoBean
    private MinimumWageService minimumWageService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @MockitoBean(name = "contractPermission")
    private ContractPermission contractPermission;

    @Test
    void anonymousGetContractsIsUnauthorized() throws Exception {
        mockMvc.perform(get("/contract"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(contractService);
    }

    @Test
    void getContractsWithoutViewAllPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/contract")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(contractService);
    }

    @Test
    void getContractsWithViewAllPermissionReachesController() throws Exception {
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), companyId, List.of("CAN_VIEW_ALL_CONTRACTS"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(contractService.getContracts(companyId)).thenReturn(List.of());

        mockMvc.perform(get("/contract")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());
    }

    @Test
    void minimumWageIsReachableByAnyAuthenticatedUser() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(minimumWageService.minimumHourlyWage(any(), any()))
                .thenReturn(Optional.of(new BigDecimal("14.99")));

        mockMvc.perform(get("/contract/minimum-wage")
                        .param("startDate", "2026-07-08")
                        .param("dateOfBirth", "2000-01-01")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.minimumHourlyWage").value(14.99))
                .andExpect(jsonPath("$.age").value(26));
    }

    @Test
    void minimumWageIsUnauthorizedForAnonymous() throws Exception {
        mockMvc.perform(get("/contract/minimum-wage")
                        .param("startDate", "2026-07-08")
                        .param("dateOfBirth", "2000-01-01"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(minimumWageService);
    }

    @Test
    void downloadContractPdfWithoutAdminPermissionOrOwnershipIsForbidden() throws Exception {
        UUID contractId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(contractPermission.isOwner(eq(contractId), any())).thenReturn(false);

        mockMvc.perform(get("/contract/{id}/pdf", contractId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(contractService);
    }

    @Test
    void downloadContractPdfAllowsOwnerWithoutAdminPermission() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        UUID contractId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(userId, companyId, List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(contractPermission.isOwner(eq(contractId), any())).thenReturn(true);
        when(contractService.getContractPdf(contractId, companyId)).thenReturn("pdf".getBytes());

        mockMvc.perform(get("/contract/{id}/pdf", contractId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(APPLICATION_PDF))
                .andExpect(content().bytes("pdf".getBytes()));
    }

    @Test
    void sendContractWithoutManagePermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/contract/{id}/send", UUID.randomUUID())
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(contractService);
    }

    @Test
    void finalizeContractByIdWithoutFinalizePermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/contract/{id}/finalize", UUID.randomUUID())
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(contractService);
    }

    @Test
    void signContractWithoutOwnershipIsForbidden() throws Exception {
        UUID contractId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(contractPermission.isOwner(eq(contractId), any())).thenReturn(false);

        mockMvc.perform(post("/contract/{id}/sign", contractId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(contractService);
    }

    @Test
    void signContractAllowsOwnerWithoutRoleAuthority() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        UUID contractId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(userId, companyId, List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(contractPermission.isOwner(eq(contractId), any())).thenReturn(true);
        when(contractService.signContract(eq(contractId), eq(userId), any(), eq("token")))
                .thenReturn(new ContractResponseDTO());

        mockMvc.perform(post("/contract/{id}/sign", contractId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "typedSignatureName": "Imre Janssen",
                                  "agreementCheckboxText": "I agree",
                                  "contractVersion": "2026-05-employment-v1",
                                  "documentHash": "sha256:test"
                                }
                                """))
                .andExpect(status().isOk());
    }

    @Test
    void createFunctionWithoutManageFunctionsPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/contract/function")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(functionService);
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
