package com.pm.userservice;

import com.pm.userservice.config.SecurityConfig;
import com.pm.userservice.controller.PlatformAdminController;
import com.pm.userservice.dto.PlatformCompanyDetailDTO;
import com.pm.userservice.dto.PlatformCompanyListItemDTO;
import com.pm.userservice.dto.PlatformCompanyOnboardingResponseDTO;
import com.pm.userservice.service.UserService;
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
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PlatformAdminController.class)
@Import(SecurityConfig.class)
class PlatformAdminControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void anonymousListCompaniesIsUnauthorized() throws Exception {
        mockMvc.perform(get("/admin/platform/companies"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(userService);
    }

    @Test
    void listCompaniesWithoutPlatformPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/admin/platform/companies")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(userService);
    }

    @Test
    void listCompaniesWithPlatformPermissionReachesController() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_PLATFORM"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        PlatformCompanyListItemDTO dto = new PlatformCompanyListItemDTO();
        dto.setCompanyId("company-1");
        dto.setName("Acme Events");
        when(userService.listPlatformCompanies()).thenReturn(List.of(dto));

        mockMvc.perform(get("/admin/platform/companies")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].companyId").value("company-1"))
                .andExpect(jsonPath("$[0].name").value("Acme Events"));
    }

    @Test
    void getCompanyWithPlatformPermissionReachesController() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_PLATFORM"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        UUID companyId = UUID.randomUUID();
        PlatformCompanyDetailDTO dto = new PlatformCompanyDetailDTO();
        dto.setCompanyId(companyId.toString());
        dto.setName("Acme Events");
        when(userService.getPlatformCompany(companyId)).thenReturn(dto);

        mockMvc.perform(get("/admin/platform/companies/{companyId}", companyId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.companyId").value(companyId.toString()))
                .andExpect(jsonPath("$.name").value("Acme Events"));
    }

    @Test
    void onboardCompanyWithoutPlatformPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/admin/platform/companies/onboard")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validRequestBody()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(userService);
    }

    @Test
    void onboardCompanyWithPlatformPermissionReturnsCreated() throws Exception {
        Jwt jwt = jwtWithPermissions(List.of("CAN_MANAGE_PLATFORM"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        PlatformCompanyOnboardingResponseDTO response = new PlatformCompanyOnboardingResponseDTO();
        response.setCompanyId("company-1");
        response.setCompanyName("Acme Events");
        response.setAdminUserId("user-1");
        response.setAdminEmail("alex@acme.test");
        response.setTemporaryPassword("Generated123");
        when(userService.onboardPlatformCompany(any())).thenReturn(response);

        mockMvc.perform(post("/admin/platform/companies/onboard")
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content(validRequestBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.companyId").value("company-1"))
                .andExpect(jsonPath("$.adminEmail").value("alex@acme.test"));
    }

    private Jwt jwtWithPermissions(List<String> permissions) {
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

    private String validRequestBody() {
        return """
                {
                  "companyName": "Acme Events",
                  "adminFirstNames": "Alex",
                  "adminMiddleNamePrefix": "van",
                  "adminLastName": "Stone",
                  "adminEmail": "alex@acme.test"
                }
                """;
    }
}
