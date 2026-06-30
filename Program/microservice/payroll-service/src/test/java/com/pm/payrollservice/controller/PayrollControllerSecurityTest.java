package com.pm.payrollservice.controller;

import com.pm.payrollservice.config.SecurityConfig;
import com.pm.payrollservice.dto.JaaropgaafDTO;
import com.pm.payrollservice.dto.PagedResponseDTO;
import com.pm.payrollservice.dto.PayslipResponseDTO;
import com.pm.payrollservice.dto.VerzamelloonstaatDTO;
import com.pm.payrollservice.repository.PayslipDocumentRepository;
import com.pm.payrollservice.repository.PayslipRepository;
import com.pm.payrollservice.security.PayrollPermission;
import com.pm.payrollservice.service.JaaropgaafService;
import com.pm.payrollservice.service.PayrollService;
import com.pm.payrollservice.service.PayslipPdfService;
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
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.http.MediaType.APPLICATION_PDF;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PayrollController.class)
@Import(SecurityConfig.class)
class PayrollControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PayrollService payrollService;

    @MockitoBean
    private PayslipRepository payslipRepository;

    @MockitoBean
    private PayslipDocumentRepository payslipDocumentRepository;

    @MockitoBean
    private PayslipPdfService payslipPdfService;

    @MockitoBean
    private JaaropgaafService jaaropgaafService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @MockitoBean(name = "payrollPermission")
    private PayrollPermission payrollPermission;

    @Test
    void anonymousGetPayslipsIsUnauthorized() throws Exception {
        mockMvc.perform(get("/payroll"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(payrollService);
    }

    @Test
    void getPayslipsWithoutViewAllPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/payroll")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(payrollService);
    }

    @Test
    void getPayslipsWithViewAllPermissionReachesController() throws Exception {
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), companyId, List.of("CAN_VIEW_ALL_PAYSLIPS"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(payrollService.getPayslips(companyId)).thenReturn(List.of());

        mockMvc.perform(get("/payroll")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());
    }

    @Test
    void getMyPayslipsWithoutViewPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/payroll/me")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(payrollService);
    }

    @Test
    void getMyPayslipsWithViewPermissionReachesController() throws Exception {
        UUID userId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(userId, UUID.randomUUID(), List.of("CAN_VIEW_PAYSLIPS"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(payrollService.getReleasedPayslipsByUserId(userId)).thenReturn(List.of());

        mockMvc.perform(get("/payroll/me")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());
    }

    @Test
    void getPayslipPdfWithoutPermissionOrOwnershipIsForbidden() throws Exception {
        UUID payslipId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/payroll/{id}", payslipId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(payrollService);
    }

    @Test
    void getPayslipPdfAllowsOwnerWithViewPermission() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        UUID payslipId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(userId, companyId, List.of("CAN_VIEW_PAYSLIPS"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(payrollPermission.isOwner(eq(payslipId), any())).thenReturn(true);
        when(payrollService.generatePayslipPdf(payslipId, companyId)).thenReturn("pdf".getBytes());

        mockMvc.perform(get("/payroll/{id}", payslipId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(APPLICATION_PDF))
                .andExpect(content().bytes("pdf".getBytes()));
    }

    @Test
    void reportPayslipErrorWithoutPermissionOrOwnershipIsForbidden() throws Exception {
        UUID payslipId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/payroll/{id}/report-error", payslipId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"errorDescription":"Mismatch"}
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(payrollService);
    }

    @Test
    void reportPayslipErrorAllowsOwnerWithReportPermission() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        UUID payslipId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(userId, companyId, List.of("CAN_REPORT_PAYSLIP_ERRORS"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(payrollPermission.isOwner(eq(payslipId), any())).thenReturn(true);
        when(payrollService.reportPayslipError(eq(payslipId), eq(companyId), eq("Mismatch"), eq("token")))
                .thenReturn(new PayslipResponseDTO());

        mockMvc.perform(post("/payroll/{id}/report-error", payslipId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"errorDescription":"Mismatch"}
                                """))
                .andExpect(status().isOk());
    }

    @Test
    void createPayslipWithoutManagePermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/payroll")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"userId":"%s"}
                                """.formatted(UUID.randomUUID())))
                .andExpect(status().isForbidden());

        verifyNoInteractions(payrollService);
    }

    @Test
    void getVerzamelloonstaatWithoutViewAllPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/payroll/verzamelloonstaat/{year}", 2025)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(jaaropgaafService);
    }

    @Test
    void getVerzamelloonstaatWithViewAllPermissionReachesController() throws Exception {
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), companyId, List.of("CAN_VIEW_ALL_PAYSLIPS"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(jaaropgaafService.buildVerzamelloonstaat(companyId, 2025)).thenReturn(new VerzamelloonstaatDTO());

        mockMvc.perform(get("/payroll/verzamelloonstaat/{year}", 2025)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());
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
