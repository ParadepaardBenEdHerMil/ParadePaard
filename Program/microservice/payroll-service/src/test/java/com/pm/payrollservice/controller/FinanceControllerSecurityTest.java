package com.pm.payrollservice.controller;

import com.pm.payrollservice.config.SecurityConfig;
import com.pm.payrollservice.dto.FinanceOverviewDTO;
import com.pm.payrollservice.dto.MarginOverviewDTO;
import com.pm.payrollservice.service.PayrollFinanceService;
import com.pm.payrollservice.service.PayrollMarginService;
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

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpHeaders.CONTENT_DISPOSITION;
import static org.springframework.http.MediaType.parseMediaType;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(FinanceController.class)
@Import(SecurityConfig.class)
class FinanceControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PayrollFinanceService payrollFinanceService;

    @MockitoBean
    private PayrollMarginService payrollMarginService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void anonymousOverviewIsUnauthorized() throws Exception {
        mockMvc.perform(get("/payroll/finance/overview")
                        .param("from", "2025-01-01")
                        .param("to", "2025-01-31"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(payrollFinanceService, payrollMarginService);
    }

    @Test
    void overviewWithoutFinancePermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/payroll/finance/overview")
                        .header("Authorization", "Bearer token")
                        .param("from", "2025-01-01")
                        .param("to", "2025-01-31"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(payrollFinanceService, payrollMarginService);
    }

    @Test
    void overviewWithViewFinancePermissionReachesController() throws Exception {
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), companyId, List.of("CAN_VIEW_PAYROLL_FINANCE"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(payrollFinanceService.overview(companyId, java.time.LocalDate.parse("2025-01-01"), java.time.LocalDate.parse("2025-01-31")))
                .thenReturn(new FinanceOverviewDTO());

        mockMvc.perform(get("/payroll/finance/overview")
                        .header("Authorization", "Bearer token")
                        .param("from", "2025-01-01")
                        .param("to", "2025-01-31"))
                .andExpect(status().isOk());
    }

    @Test
    void marginOverviewWithoutFinancePermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/payroll/finance/margin/overview")
                        .header("Authorization", "Bearer token")
                        .param("from", "2025-01-01")
                        .param("to", "2025-01-31"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(payrollFinanceService, payrollMarginService);
    }

    @Test
    void marginOverviewWithManageFinancePermissionReachesController() throws Exception {
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), companyId, List.of("CAN_MANAGE_PAYROLL_FINANCE"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(payrollMarginService.overview(eq(companyId), eq(java.time.LocalDate.parse("2025-01-01")), eq(java.time.LocalDate.parse("2025-01-31")), eq("token")))
                .thenReturn(new MarginOverviewDTO());

        mockMvc.perform(get("/payroll/finance/margin/overview")
                        .header("Authorization", "Bearer token")
                        .param("from", "2025-01-01")
                        .param("to", "2025-01-31"))
                .andExpect(status().isOk());
    }

    @Test
    void marginExportWithoutFinancePermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/payroll/finance/margin/export")
                        .header("Authorization", "Bearer token")
                        .param("from", "2025-01-01")
                        .param("to", "2025-01-31"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(payrollFinanceService, payrollMarginService);
    }

    @Test
    void marginExportWithViewFinancePermissionReturnsCsv() throws Exception {
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), companyId, List.of("CAN_VIEW_PAYROLL_FINANCE"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(payrollMarginService.exportCsv(eq(companyId), eq(java.time.LocalDate.parse("2025-01-01")), eq(java.time.LocalDate.parse("2025-01-31")), eq("token")))
                .thenReturn("employee,revenue\nAlice,100.00\n");

        mockMvc.perform(get("/payroll/finance/margin/export")
                        .header("Authorization", "Bearer token")
                        .param("from", "2025-01-01")
                        .param("to", "2025-01-31"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(parseMediaType("text/csv")))
                .andExpect(header().string(CONTENT_DISPOSITION, "attachment; filename=\"margin-2025-01-01_2025-01-31.csv\""))
                .andExpect(content().bytes("employee,revenue\nAlice,100.00\n".getBytes(java.nio.charset.StandardCharsets.UTF_8)));
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
