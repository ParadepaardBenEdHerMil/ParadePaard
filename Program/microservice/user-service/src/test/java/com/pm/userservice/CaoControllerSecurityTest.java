package com.pm.userservice;

import com.pm.userservice.config.SecurityConfig;
import com.pm.userservice.controller.CaoController;
import com.pm.userservice.dto.CaoTemplateDTO;
import com.pm.userservice.service.CaoService;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CaoController.class)
@Import(SecurityConfig.class)
class CaoControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CaoService caoService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void anonymousGetCaoTemplatesIsUnauthorized() throws Exception {
        mockMvc.perform(get("/cao"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(caoService);
    }

    @Test
    void getCaoTemplatesWithoutManageCompanyPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/cao")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(caoService);
    }

    @Test
    void getCaoTemplatesWithManageCompanyPermissionReachesController() throws Exception {
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), companyId, List.of("CAN_MANAGE_COMPANY"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(caoService.getCaoTemplates(companyId)).thenReturn(List.of());

        mockMvc.perform(get("/cao")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());
    }

    @Test
    void getCaoTemplateByIdAllowsReviewOnboardingPermission() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID caoId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), companyId, List.of("CAN_REVIEW_ONBOARDING"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        CaoTemplateDTO dto = new CaoTemplateDTO();
        dto.setCaoId(caoId.toString());
        dto.setName("Hospitality 2026");
        when(caoService.getCaoTemplateById(caoId, companyId)).thenReturn(dto);

        mockMvc.perform(get("/cao/{caoId}", caoId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caoId").value(caoId.toString()))
                .andExpect(jsonPath("$.name").value("Hospitality 2026"));
    }

    @Test
    void createCaoTemplateWithManageCompanyPermissionReachesController() throws Exception {
        UUID companyId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), companyId, List.of("CAN_MANAGE_COMPANY"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        CaoTemplateDTO dto = new CaoTemplateDTO();
        dto.setName("Hospitality 2026");
        when(caoService.createCaoTemplate(eq(companyId), any())).thenReturn(dto);

        mockMvc.perform(post("/cao")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Hospitality 2026",
                                  "sector": "Hospitality"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Hospitality 2026"));
    }

    @Test
    void createCaoTemplateWithoutCompanyClaimReturnsUnauthorized() throws Exception {
        Jwt jwt = jwtWithoutCompanyId(List.of("CAN_MANAGE_COMPANY"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/cao")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Hospitality 2026"
                                }
                                """))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(caoService);
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

    private Jwt jwtWithoutCompanyId(List<String> permissions) {
        UUID userId = UUID.randomUUID();
        return Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject(userId.toString())
                .claim("userId", userId.toString())
                .claim("permissions", permissions)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(900))
                .build();
    }
}
