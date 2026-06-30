package com.pm.planningservice;

import com.pm.planningservice.config.SecurityConfig;
import com.pm.planningservice.controller.BillingRateController;
import com.pm.planningservice.dto.BillingRateDTO;
import com.pm.planningservice.dto.ClientBillingRatesDTO;
import com.pm.planningservice.dto.ResolvedRateDTO;
import com.pm.planningservice.dto.UserBillingRatesDTO;
import com.pm.planningservice.service.BillingRateService;
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

@WebMvcTest(BillingRateController.class)
@Import(SecurityConfig.class)
class BillingRateControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private BillingRateService billingRateService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void anonymousListClientBillingRatesIsUnauthorized() throws Exception {
        mockMvc.perform(get("/planning/billing-rates/clients/{clientCompanyId}", UUID.randomUUID()))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(billingRateService);
    }

    @Test
    void listClientBillingRatesWithoutBillingPermissionsIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of(), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/planning/billing-rates/clients/{clientCompanyId}", UUID.randomUUID())
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(billingRateService);
    }

    @Test
    void listClientBillingRatesWithViewPermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_VIEW_BILLING_RATES"), companyId, UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(billingRateService.listClientBillingRates(companyId, clientCompanyId))
                .thenReturn(new ClientBillingRatesDTO());

        mockMvc.perform(get("/planning/billing-rates/clients/{clientCompanyId}", clientCompanyId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());

        verify(billingRateService).listClientBillingRates(companyId, clientCompanyId);
    }

    @Test
    void listUserBillingRatesWithManagePermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_BILLING_RATES"), companyId, UUID.randomUUID());
        UserBillingRatesDTO response = new UserBillingRatesDTO();
        response.setUserId(userId);

        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(billingRateService.listUserBillingRates(companyId, userId)).thenReturn(response);

        mockMvc.perform(get("/planning/billing-rates/users/{userId}", userId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());

        verify(billingRateService).listUserBillingRates(companyId, userId);
    }

    @Test
    void saveClientDefaultRateWithoutManagePermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of("CAN_VIEW_BILLING_RATES"), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/planning/billing-rates/clients/{clientCompanyId}/defaults", UUID.randomUUID())
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validBillingRateBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(billingRateService);
    }

    @Test
    void saveClientDefaultRateWithManagePermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_BILLING_RATES"), companyId, userId);
        BillingRateDTO response = new BillingRateDTO();
        response.setId(UUID.randomUUID());

        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(billingRateService.saveClientDefaultRate(eq(companyId), eq(userId), eq(clientCompanyId), any()))
                .thenReturn(response);

        mockMvc.perform(post("/planning/billing-rates/clients/{clientCompanyId}/defaults", clientCompanyId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validBillingRateBody()))
                .andExpect(status().isOk());

        verify(billingRateService).saveClientDefaultRate(eq(companyId), eq(userId), eq(clientCompanyId), any());
    }

    @Test
    void resolveRatesAnonymousIsUnauthorized() throws Exception {
        mockMvc.perform(post("/planning/billing-rates/resolve")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"items":[]}
                                """))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(billingRateService);
    }

    @Test
    void resolveRatesAllowsAuthenticatedUserWithoutBillingPermissions() throws Exception {
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of(), companyId, UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(billingRateService.resolveRates(eq(companyId), any())).thenReturn(List.of(new ResolvedRateDTO()));

        mockMvc.perform(post("/planning/billing-rates/resolve")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"items":[]}
                                """))
                .andExpect(status().isOk());

        verify(billingRateService).resolveRates(eq(companyId), any());
    }

    @Test
    void deleteBillingRateWithoutManagePermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of("CAN_VIEW_BILLING_RATES"), UUID.randomUUID(), UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(delete("/planning/billing-rates/clients/{clientCompanyId}/{scope}/{rateId}",
                        UUID.randomUUID(), "CLIENT", UUID.randomUUID())
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(billingRateService);
    }

    @Test
    void deleteBillingRateWithManagePermissionIsAllowed() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();
        UUID rateId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_BILLING_RATES"), companyId, UUID.randomUUID());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(delete("/planning/billing-rates/clients/{clientCompanyId}/{scope}/{rateId}",
                        clientCompanyId, "CLIENT", rateId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isNoContent());

        verify(billingRateService).deleteBillingRate(companyId, clientCompanyId, "CLIENT", rateId);
    }

    private String validBillingRateBody() {
        return """
                {
                  "functionName": "Chef",
                  "ratePerHour": 42.50
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
