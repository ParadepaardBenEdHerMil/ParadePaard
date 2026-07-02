package com.pm.userservice;

import com.pm.userservice.config.SecurityConfig;
import com.pm.userservice.controller.JobApplicationController;
import com.pm.userservice.dto.JobApplicationResponseDTO;
import com.pm.userservice.service.JobApplicationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(JobApplicationController.class)
@Import(SecurityConfig.class)
class UserServiceSecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JobApplicationService service;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void anonymousApplicationSubmissionReachesController() throws Exception {
        JobApplicationResponseDTO response = new JobApplicationResponseDTO();
        response.setStatus("APPLICATION_SUBMITTED");
        when(service.submitApplication(any(), any(), any())).thenReturn(response);

        MockMultipartFile application = new MockMultipartFile(
                "application",
                "",
                MediaType.APPLICATION_JSON_VALUE,
                """
                        {
                          "firstNames": "Alex Maria",
                          "lastName": "Jansen",
                          "email": "alex@example.com",
                          "phoneNumber": "+31612345678",
                          "dateOfBirth": "1995-02-12",
                          "roleInterest": "Runner",
                          "contractPreference": "ON_CALL",
                          "workedForUsBefore": true,
                          "contactConsent": true,
                          "informationAccurate": true
                        }
                        """.getBytes(StandardCharsets.UTF_8)
        );
        MockMultipartFile profilePicture = new MockMultipartFile(
                "profilePicture",
                "alex.png",
                "image/png",
                "image-bytes".getBytes(StandardCharsets.UTF_8)
        );

        mockMvc.perform(multipart("/applications").file(application).file(profilePicture))
                .andExpect(status().isOk());
    }

    @Test
    void anonymousAdminApplicationsRequestIsUnauthorized() throws Exception {
        mockMvc.perform(get("/admin/applications"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void anonymousApplicationSubmissionRejectsNonImageProfilePicture() throws Exception {
        MockMultipartFile application = new MockMultipartFile(
                "application",
                "",
                MediaType.APPLICATION_JSON_VALUE,
                validApplicationJson().getBytes(StandardCharsets.UTF_8)
        );
        MockMultipartFile profilePicture = new MockMultipartFile(
                "profilePicture",
                "alex.pdf",
                "application/pdf",
                "not-an-image".getBytes(StandardCharsets.UTF_8)
        );

        mockMvc.perform(multipart("/applications").file(application).file(profilePicture))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }

    @Test
    void anonymousApplicationSubmissionRejectsOversizedProfilePicture() throws Exception {
        MockMultipartFile application = new MockMultipartFile(
                "application",
                "",
                MediaType.APPLICATION_JSON_VALUE,
                validApplicationJson().getBytes(StandardCharsets.UTF_8)
        );
        MockMultipartFile profilePicture = new MockMultipartFile(
                "profilePicture",
                "alex.png",
                "image/png",
                new byte[2_000_001]
        );

        mockMvc.perform(multipart("/applications").file(application).file(profilePicture))
                .andExpect(status().isPayloadTooLarge());

        verifyNoInteractions(service);
    }

    @Test
    void anonymousApplicationSubmissionRejectsMissingContactConsent() throws Exception {
        MockMultipartFile application = new MockMultipartFile(
                "application",
                "",
                MediaType.APPLICATION_JSON_VALUE,
                validApplicationJson().replace("\"contactConsent\": true", "\"contactConsent\": false")
                        .getBytes(StandardCharsets.UTF_8)
        );
        MockMultipartFile profilePicture = new MockMultipartFile(
                "profilePicture",
                "alex.png",
                "image/png",
                "image-bytes".getBytes(StandardCharsets.UTF_8)
        );

        mockMvc.perform(multipart("/applications").file(application).file(profilePicture))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }

    private static String validApplicationJson() {
        return """
                {
                  "firstNames": "Alex Maria",
                  "lastName": "Jansen",
                  "email": "alex@example.com",
                  "phoneNumber": "+31612345678",
                  "dateOfBirth": "1995-02-12",
                  "roleInterest": "Runner",
                  "contractPreference": "ON_CALL",
                  "workedForUsBefore": true,
                  "contactConsent": true,
                  "informationAccurate": true
                }
                """;
    }
}
