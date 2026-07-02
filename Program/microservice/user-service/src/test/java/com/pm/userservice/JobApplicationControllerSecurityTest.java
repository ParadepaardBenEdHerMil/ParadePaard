package com.pm.userservice;

import com.pm.userservice.config.SecurityConfig;
import com.pm.userservice.controller.JobApplicationController;
import com.pm.userservice.dto.JobApplicationResponseDTO;
import com.pm.userservice.model.JobApplication;
import com.pm.userservice.service.JobApplicationService;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(JobApplicationController.class)
@Import(SecurityConfig.class)
class JobApplicationControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JobApplicationService service;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void getApplicationsWithoutPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/admin/applications")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(service);
    }

    @Test
    void getApplicationsWithViewPermissionReachesController() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), List.of("CAN_VIEW_APPLICATIONS"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(service.getApplications()).thenReturn(List.of());

        mockMvc.perform(get("/admin/applications")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());
    }

    @Test
    void getApplicationWithReviewPermissionReachesController() throws Exception {
        UUID applicationId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), List.of("CAN_REVIEW_APPLICATIONS"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        JobApplicationResponseDTO response = new JobApplicationResponseDTO();
        response.setApplicationId(applicationId.toString());
        response.setStatus("APPLICATION_SUBMITTED");
        when(service.getApplication(applicationId)).thenReturn(response);

        mockMvc.perform(get("/admin/applications/{applicationId}", applicationId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.applicationId").value(applicationId.toString()))
                .andExpect(jsonPath("$.status").value("APPLICATION_SUBMITTED"));
    }

    @Test
    void downloadCvWithoutPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/admin/applications/{applicationId}/cv", UUID.randomUUID())
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(service);
    }

    @Test
    void downloadCvWithViewPermissionReturnsAttachment() throws Exception {
        UUID applicationId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), List.of("CAN_VIEW_APPLICATIONS"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        JobApplication application = new JobApplication();
        application.setCvFileName("resume.pdf");
        application.setCvContentType("application/pdf");
        application.setCvBytes("pdf".getBytes());
        when(service.getApplicationCv(applicationId)).thenReturn(application);

        mockMvc.perform(get("/admin/applications/{applicationId}/cv", applicationId)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"resume.pdf\""))
                .andExpect(content().bytes("pdf".getBytes()));
    }

    @Test
    void denyApplicationWithoutReviewPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), List.of("CAN_VIEW_APPLICATIONS"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/admin/applications/{applicationId}/deny", UUID.randomUUID())
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"reviewNote":"Not a fit"}
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(service);
    }

    @Test
    void denyApplicationWithReviewPermissionReachesController() throws Exception {
        UUID applicationId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(reviewerId, List.of("CAN_REVIEW_APPLICATIONS"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        JobApplicationResponseDTO response = new JobApplicationResponseDTO();
        response.setApplicationId(applicationId.toString());
        response.setStatus("APPLICATION_DENIED");
        when(service.denyApplication(eq(applicationId), any(), eq(reviewerId.toString()))).thenReturn(response);

        mockMvc.perform(post("/admin/applications/{applicationId}/deny", applicationId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"reviewNote":"Not a fit"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPLICATION_DENIED"));
    }

    @Test
    void acceptApplicationWithReviewPermissionReachesController() throws Exception {
        UUID applicationId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(reviewerId, List.of("CAN_REVIEW_APPLICATIONS"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        JobApplicationResponseDTO response = new JobApplicationResponseDTO();
        response.setApplicationId(applicationId.toString());
        response.setStatus("APPLICATION_ACCEPTED");
        when(service.acceptApplication(eq(applicationId), any(), eq(reviewerId.toString()), eq("token")))
                .thenReturn(response);

        mockMvc.perform(post("/admin/applications/{applicationId}/accept", applicationId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"reviewNote":"Proceed"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPLICATION_ACCEPTED"));
    }

    private Jwt jwtWithPermissions(UUID userId, List<String> permissions) {
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
