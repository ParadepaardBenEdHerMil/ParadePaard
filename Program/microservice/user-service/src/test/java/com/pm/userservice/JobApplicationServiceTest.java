package com.pm.userservice;

import com.pm.userservice.dto.ApplicationDecisionRequestDTO;
import com.pm.userservice.dto.AuthAdminOnboardUserRequestDTO;
import com.pm.userservice.dto.AuthAdminOnboardUserResponseDTO;
import com.pm.userservice.dto.JobApplicationRequestDTO;
import com.pm.userservice.dto.JobApplicationResponseDTO;
import com.pm.userservice.integration.AuthServiceClient;
import com.pm.userservice.model.ApplicationStatus;
import com.pm.userservice.model.JobApplication;
import com.pm.userservice.model.User;
import com.pm.userservice.model.UserStatus;
import com.pm.userservice.repository.JobApplicationRepository;
import com.pm.userservice.repository.UserRepository;
import com.pm.userservice.service.JobApplicationService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JobApplicationServiceTest {
    private final JobApplicationRepository repository = mock(JobApplicationRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final AuthServiceClient authServiceClient = mock(AuthServiceClient.class);
    private final JobApplicationService service = new JobApplicationService(repository, userRepository, authServiceClient);

    @Test
    void submitApplicationStoresSubmittedApplicationWithOptionalCv() throws Exception {
        when(repository.save(any(JobApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));
        MockMultipartFile cv = new MockMultipartFile(
                "cv",
                "resume.pdf",
                "application/pdf",
                "pdf bytes".getBytes(StandardCharsets.UTF_8)
        );

        JobApplicationResponseDTO response = service.submitApplication(applicationRequest(), cv);

        ArgumentCaptor<JobApplication> captor = ArgumentCaptor.forClass(JobApplication.class);
        verify(repository).save(captor.capture());
        JobApplication saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(ApplicationStatus.APPLICATION_SUBMITTED);
        assertThat(saved.getEmail()).isEqualTo("alex@example.com");
        assertThat(saved.getDateOfBirth()).isEqualTo(LocalDate.of(1995, 2, 12));
        assertThat(saved.getCvFileName()).isEqualTo("resume.pdf");
        assertThat(saved.getCvContentType()).isEqualTo("application/pdf");
        assertThat(saved.getCvBytes()).isEqualTo("pdf bytes".getBytes(StandardCharsets.UTF_8));
        assertThat(response.getStatus()).isEqualTo("APPLICATION_SUBMITTED");
    }

    @Test
    void denyApplicationStoresDecisionMetadata() {
        UUID applicationId = UUID.randomUUID();
        JobApplication application = existingApplication(applicationId);
        when(repository.findById(applicationId)).thenReturn(Optional.of(application));
        when(repository.save(any(JobApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));
        ApplicationDecisionRequestDTO decision = new ApplicationDecisionRequestDTO();
        decision.setReviewNote("Not a fit right now");

        JobApplicationResponseDTO response = service.denyApplication(applicationId, decision, "reviewer-1");

        assertThat(application.getStatus()).isEqualTo(ApplicationStatus.APPLICATION_DENIED);
        assertThat(application.getReviewNote()).isEqualTo("Not a fit right now");
        assertThat(application.getReviewedByUserId()).isEqualTo("reviewer-1");
        assertThat(application.getReviewedAt()).isNotNull();
        assertThat(application.getDecisionEmailSent()).isFalse();
        verify(repository).save(application);
        assertThat(response.getStatus()).isEqualTo("APPLICATION_DENIED");
        assertThat(response.getDecisionEmailSent()).isFalse();
    }

    @Test
    void acceptApplicationCreatesPendingSetupUser() {
        UUID applicationId = UUID.randomUUID();
        UUID acceptedUserId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        JobApplication application = existingApplication(applicationId);
        application.setMiddleNamePrefix("van");
        when(repository.findById(applicationId)).thenReturn(Optional.of(application));
        when(repository.save(any(JobApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        AuthAdminOnboardUserResponseDTO authResponse = new AuthAdminOnboardUserResponseDTO();
        authResponse.setUserId(acceptedUserId.toString());
        authResponse.setCompanyId(companyId.toString());
        when(authServiceClient.adminOnboardUser(any(AuthAdminOnboardUserRequestDTO.class), eq("access-token")))
                .thenReturn(authResponse);
        ApplicationDecisionRequestDTO decision = new ApplicationDecisionRequestDTO();
        decision.setReviewNote("Accepted for runner role");

        JobApplicationResponseDTO response = service.acceptApplication(applicationId, decision, "reviewer-2", "access-token");

        ArgumentCaptor<AuthAdminOnboardUserRequestDTO> authRequestCaptor =
                ArgumentCaptor.forClass(AuthAdminOnboardUserRequestDTO.class);
        verify(authServiceClient).adminOnboardUser(authRequestCaptor.capture(), eq("access-token"));
        AuthAdminOnboardUserRequestDTO authRequest = authRequestCaptor.getValue();
        assertThat(authRequest.getEmail()).isEqualTo("alex@example.com");
        assertThat(authRequest.getFirstName()).isEqualTo("Alex Maria");
        assertThat(authRequest.getLastName()).isEqualTo("van Jansen");

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User savedUser = userCaptor.getValue();
        assertThat(savedUser.getUserId()).isEqualTo(acceptedUserId);
        assertThat(savedUser.getStatus()).isEqualTo(UserStatus.PENDING_SETUP);
        assertThat(savedUser.getEmail()).isEqualTo("alex@example.com");
        assertThat(savedUser.getFirstNames()).isEqualTo("Alex Maria");
        assertThat(savedUser.getMiddleNamePrefix()).isEqualTo("van");
        assertThat(savedUser.getLastName()).isEqualTo("Jansen");
        assertThat(savedUser.getMobileNumber()).isEqualTo("+31612345678");
        assertThat(savedUser.getPosition()).isEqualTo("Runner");
        assertThat(savedUser.isWorkedForUsBefore()).isTrue();
        assertThat(savedUser.getCompanyId()).isEqualTo(companyId);

        assertThat(application.getStatus()).isEqualTo(ApplicationStatus.APPLICATION_ACCEPTED);
        assertThat(application.getAcceptedUserId()).isEqualTo(acceptedUserId);
        assertThat(application.getReviewNote()).isEqualTo("Accepted for runner role");
        assertThat(application.getReviewedByUserId()).isEqualTo("reviewer-2");
        assertThat(application.getReviewedAt()).isNotNull();
        assertThat(application.getDecisionEmailSent()).isFalse();
        verify(repository).save(application);
        assertThat(response.getAcceptedUserId()).isEqualTo(acceptedUserId.toString());
        assertThat(response.getDecisionEmailSent()).isFalse();
    }

    private static JobApplicationRequestDTO applicationRequest() {
        JobApplicationRequestDTO request = new JobApplicationRequestDTO();
        request.setFirstNames("Alex Maria");
        request.setPreferredName("Alex");
        request.setMiddleNamePrefix("van");
        request.setLastName("Jansen");
        request.setEmail("alex@example.com");
        request.setPhoneNumber("+31612345678");
        request.setDateOfBirth("1995-02-12");
        request.setGender("Female");
        request.setNationality("Dutch");
        request.setCity("Amsterdam");
        request.setCountry("Netherlands");
        request.setRoleInterest("Runner");
        request.setContractPreference("ON_CALL");
        request.setAvailableFrom("2026-06-01");
        request.setAvailabilityNotes("Weekends");
        request.setWorkedForUsBefore(true);
        request.setExperience("Hospitality");
        request.setLanguages("Dutch, English");
        request.setCertificates("BHV");
        request.setMotivation("I like event work");
        request.setContactConsent(true);
        request.setInformationAccurate(true);
        return request;
    }

    private static JobApplication existingApplication(UUID applicationId) {
        JobApplication application = new JobApplication();
        application.setApplicationId(applicationId);
        application.setFirstNames("Alex Maria");
        application.setPreferredName("Alex");
        application.setLastName("Jansen");
        application.setEmail("alex@example.com");
        application.setPhoneNumber("+31612345678");
        application.setDateOfBirth(LocalDate.of(1995, 2, 12));
        application.setGender("Female");
        application.setRoleInterest("Runner");
        application.setWorkedForUsBefore(true);
        application.setStatus(ApplicationStatus.APPLICATION_SUBMITTED);
        return application;
    }
}
