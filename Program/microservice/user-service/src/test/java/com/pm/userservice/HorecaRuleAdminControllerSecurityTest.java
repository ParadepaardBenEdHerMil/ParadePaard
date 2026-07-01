package com.pm.userservice;

import com.pm.userservice.config.SecurityConfig;
import com.pm.userservice.controller.HorecaRuleAdminController;
import com.pm.userservice.dto.HorecaJobPresetUpdateDTO;
import com.pm.userservice.dto.HorecaRulePublishRequestDTO;
import com.pm.userservice.dto.HorecaRuleSectionUpdateDTO;
import com.pm.userservice.dto.HorecaRuleVersionDTO;
import com.pm.userservice.service.HorecaRuleService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(HorecaRuleAdminController.class)
@Import(SecurityConfig.class)
class HorecaRuleAdminControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private HorecaRuleService horecaRuleService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void anonymousGetCurrentRulesIsUnauthorized() throws Exception {
        mockMvc.perform(get("/admin/horeca-rules/current"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(horecaRuleService);
    }

    @Test
    void getCurrentRulesWithoutManageCompanyPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/admin/horeca-rules/current")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(horecaRuleService);
    }

    @Test
    void getCurrentRulesWithManageCompanyPermissionReachesController() throws Exception {
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), companyId, List.of("CAN_MANAGE_COMPANY"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        HorecaRuleVersionDTO response = ruleVersion(companyId, "DRAFT");
        when(horecaRuleService.getCurrentRules(companyId)).thenReturn(response);

        mockMvc.perform(get("/admin/horeca-rules/current")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.companyId").value(companyId.toString()))
                .andExpect(jsonPath("$.status").value("DRAFT"));
    }

    @Test
    void updateSectionWithManageCompanyPermissionReachesController() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(userId, companyId, List.of("CAN_MANAGE_COMPANY"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        HorecaRuleVersionDTO response = ruleVersion(companyId, "DRAFT");
        when(horecaRuleService.updateSection(
                eq(companyId),
                eq(userId),
                eq(com.pm.userservice.model.HorecaRuleSection.WAGE_RULES),
                any(HorecaRuleSectionUpdateDTO.class)
        )).thenReturn(response);

        mockMvc.perform(put("/admin/horeca-rules/sections/WAGE_RULES")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "items": []
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.companyId").value(companyId.toString()));
    }

    @Test
    void updateJobPresetsWithManageCompanyPermissionReachesController() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(userId, companyId, List.of("CAN_MANAGE_COMPANY"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        HorecaRuleVersionDTO response = ruleVersion(companyId, "DRAFT");
        when(horecaRuleService.updateJobPresets(eq(companyId), eq(userId), any(HorecaJobPresetUpdateDTO.class)))
                .thenReturn(response);

        mockMvc.perform(put("/admin/horeca-rules/job-presets")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "jobPresets": []
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.companyId").value(companyId.toString()));
    }

    @Test
    void publishCurrentDraftWithManageCompanyPermissionReachesController() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(userId, companyId, List.of("CAN_MANAGE_COMPANY"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        HorecaRuleVersionDTO response = ruleVersion(companyId, "PUBLISHED");
        response.setEffectiveFrom("2026-08-01");

        when(horecaRuleService.publishCurrentDraft(
                eq(companyId),
                eq(userId),
                any(HorecaRulePublishRequestDTO.class),
                eq("token")
        )).thenReturn(response);

        mockMvc.perform(post("/admin/horeca-rules/publish")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "effectiveFrom": "2026-08-01",
                                  "versionLabel": "August update",
                                  "reason": "Refresh"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.effectiveFrom").value("2026-08-01"));
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

    private HorecaRuleVersionDTO ruleVersion(UUID companyId, String status) {
        HorecaRuleVersionDTO dto = new HorecaRuleVersionDTO();
        dto.setVersionId(UUID.randomUUID().toString());
        dto.setCompanyId(companyId.toString());
        dto.setStatus(status);
        dto.setVersionLabel("Hospitality rules");
        return dto;
    }
}
