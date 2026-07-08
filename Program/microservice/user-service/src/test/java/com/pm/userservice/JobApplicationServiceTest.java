package com.pm.userservice;

import com.pm.userservice.dto.ApplicationDecisionRequestDTO;
import com.pm.userservice.dto.AuthAdminOnboardUserRequestDTO;
import com.pm.userservice.dto.AuthAdminOnboardUserResponseDTO;
import com.pm.userservice.dto.JobApplicationRequestDTO;
import com.pm.userservice.dto.JobApplicationResponseDTO;
import com.pm.userservice.exception.EmailAlreadyExistsException;
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
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

class JobApplicationServiceTest {
    private final JobApplicationRepository repository = mock(JobApplicationRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final AuthServiceClient authServiceClient = mock(AuthServiceClient.class);
    private final JobApplicationService service = new JobApplicationService(repository, userRepository, authServiceClient);

    @Test
    void submitApplicationStoresSubmittedApplicationWithOptionalCv() throws Exception {
        when(repository.save(any(JobApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));
        MockMultipartFile profilePicture = new MockMultipartFile(
                "profilePicture",
                "alex.png",
                "image/png",
                "image bytes".getBytes(StandardCharsets.UTF_8)
        );
        MockMultipartFile cv = new MockMultipartFile(
                "cv",
                "resume.pdf",
                "application/pdf",
                "pdf bytes".getBytes(StandardCharsets.UTF_8)
        );

        JobApplicationResponseDTO response = service.submitApplication(applicationRequest(), profilePicture, cv);

        ArgumentCaptor<JobApplication> captor = ArgumentCaptor.forClass(JobApplication.class);
        verify(repository).save(captor.capture());
        JobApplication saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(ApplicationStatus.APPLICATION_SUBMITTED);
        assertThat(saved.getEmail()).isEqualTo("alex@example.com");
        assertThat(saved.getDateOfBirth()).isEqualTo(LocalDate.of(1995, 2, 12));
        assertThat(saved.getProfilePictureFileName()).isEqualTo("alex.png");
        assertThat(saved.getProfilePictureContentType()).isEqualTo("image/png");
        assertThat(saved.getProfilePictureBytes()).isEqualTo("image bytes".getBytes(StandardCharsets.UTF_8));
        assertThat(saved.getCvFileName()).isEqualTo("resume.pdf");
        assertThat(saved.getCvContentType()).isEqualTo("application/pdf");
        assertThat(saved.getCvBytes()).isEqualTo("pdf bytes".getBytes(StandardCharsets.UTF_8));
        assertThat(saved.getNote()).isEqualTo("Weekends");
        assertThat(response.getStatus()).isEqualTo("APPLICATION_SUBMITTED");
        assertThat(response.isHasProfilePicture()).isTrue();
        assertThat(response.getProfilePictureFileName()).isEqualTo("alex.png");
        assertThat(response.getNote()).isEqualTo("Weekends");
    }

    @Test
    void submitApplicationRejectsMalformedDateOfBirthWithFriendlyMessage() {
        JobApplicationRequestDTO request = applicationRequest();
        request.setDateOfBirth("11/30/2004"); // US-style MM/DD/YYYY, not the expected ISO date
        MockMultipartFile profilePicture = new MockMultipartFile(
                "profilePicture", "alex.png", "image/png", "image bytes".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> service.submitApplication(request, profilePicture, null))
                .isInstanceOf(java.time.format.DateTimeParseException.class)
                .hasMessageContaining("Please enter a valid date of birth");
        verify(repository, never()).save(any());
    }

    @Test
    void submitApplicationRejectsEmailAlreadyUsedByExistingApplication() {
        when(repository.existsByEmailIgnoreCase("alex@example.com"))
                .thenReturn(true);

        MockMultipartFile profilePicture = new MockMultipartFile(
                "profilePicture",
                "alex.png",
                "image/png",
                "image bytes".getBytes(StandardCharsets.UTF_8)
        );

        assertThatThrownBy(() -> service.submitApplication(applicationRequest(), profilePicture, null))
                .isInstanceOf(EmailAlreadyExistsException.class)
                .hasMessage("Email already exists alex@example.com");
        verify(repository, never()).save(any(JobApplication.class));
    }

    @Test
    void submitApplicationRejectsEmailAlreadyUsedByUserAccount() {
        when(userRepository.existsByEmailIgnoreCase("alex@example.com")).thenReturn(true);

        MockMultipartFile profilePicture = new MockMultipartFile(
                "profilePicture",
                "alex.png",
                "image/png",
                "image bytes".getBytes(StandardCharsets.UTF_8)
        );

        assertThatThrownBy(() -> service.submitApplication(applicationRequest(), profilePicture, null))
                .isInstanceOf(EmailAlreadyExistsException.class)
                .hasMessage("Email already exists alex@example.com");
        verify(repository, never()).save(any(JobApplication.class));
    }

    @Test
    void submitApplicationRejectsDuplicateEmailAfterTrimmingWhitespace() {
        JobApplicationRequestDTO request = applicationRequest();
        request.setEmail("  ALEX@example.com  ");
        when(repository.existsByEmailIgnoreCase("ALEX@example.com")).thenReturn(true);

        MockMultipartFile profilePicture = new MockMultipartFile(
                "profilePicture",
                "alex.png",
                "image/png",
                "image bytes".getBytes(StandardCharsets.UTF_8)
        );

        assertThatThrownBy(() -> service.submitApplication(request, profilePicture, null))
                .isInstanceOf(EmailAlreadyExistsException.class)
                .hasMessage("Email already exists ALEX@example.com");
        verify(repository, never()).save(any(JobApplication.class));
    }

    @Test
    void denyApplicationStoresDecisionMetadata() {
        UUID applicationId = UUID.randomUUID();
        JobApplication application = existingApplication(applicationId);
        when(repository.findByApplicationIdForUpdate(applicationId)).thenReturn(Optional.of(application));
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
        application.setProfilePictureBytes("image bytes".getBytes(StandardCharsets.UTF_8));
        application.setProfilePictureContentType("image/png");
        when(repository.findByApplicationIdForUpdate(applicationId)).thenReturn(Optional.of(application));
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
        assertThat(savedUser.getProfilePicture()).isEqualTo("image bytes".getBytes(StandardCharsets.UTF_8));
        assertThat(savedUser.getProfilePictureContentType()).isEqualTo("image/png");

        assertThat(application.getStatus()).isEqualTo(ApplicationStatus.APPLICATION_ACCEPTED);
        assertThat(application.getAcceptedUserId()).isEqualTo(acceptedUserId);
        assertThat(application.getReviewNote()).isEqualTo("Accepted for runner role");
        assertThat(application.getReviewedByUserId()).isEqualTo("reviewer-2");
        assertThat(application.getReviewedAt()).isNotNull();
        assertThat(application.getDecisionEmailSent()).isFalse();
        verify(repository).save(application);
        verify(repository).findByApplicationIdForUpdate(applicationId);
        verify(repository, never()).findById(applicationId);
        assertThat(response.getAcceptedUserId()).isEqualTo(acceptedUserId.toString());
        assertThat(response.getDecisionEmailSent()).isFalse();
    }

    @Test
    void acceptApplicationUsesDefaultCompanyWhenAuthOmitsCompanyId() {
        UUID applicationId = UUID.randomUUID();
        UUID acceptedUserId = UUID.randomUUID();
        JobApplication application = existingApplication(applicationId);
        when(repository.findByApplicationIdForUpdate(applicationId)).thenReturn(Optional.of(application));
        when(repository.save(any(JobApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        AuthAdminOnboardUserResponseDTO authResponse = new AuthAdminOnboardUserResponseDTO();
        authResponse.setUserId(acceptedUserId.toString());
        when(authServiceClient.adminOnboardUser(any(AuthAdminOnboardUserRequestDTO.class), eq("access-token")))
                .thenReturn(authResponse);

        service.acceptApplication(applicationId, null, "reviewer-2", "access-token");

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().getCompanyId())
                .isEqualTo(UUID.fromString("00000000-0000-0000-0000-000000000001"));
    }

    @Test
    void getApplicationThrowsNotFoundResponseWhenMissing() {
        UUID applicationId = UUID.randomUUID();
        when(repository.findById(applicationId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getApplication(applicationId))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex -> {
                    assertThat(ex.getStatusCode()).isEqualTo(NOT_FOUND);
                    assertThat(ex.getReason()).isEqualTo("Application " + applicationId + " not found");
                });
    }

    @Test
    void repeatAcceptReturnsCurrentApplicationWithoutCallingAuthAgain() {
        UUID applicationId = UUID.randomUUID();
        UUID acceptedUserId = UUID.randomUUID();
        JobApplication application = existingApplication(applicationId);
        application.setStatus(ApplicationStatus.APPLICATION_ACCEPTED);
        application.setAcceptedUserId(acceptedUserId);
        when(repository.findByApplicationIdForUpdate(applicationId)).thenReturn(Optional.of(application));

        JobApplicationResponseDTO response = service.acceptApplication(applicationId, null, "reviewer-2", "access-token");

        assertThat(response.getStatus()).isEqualTo("APPLICATION_ACCEPTED");
        assertThat(response.getAcceptedUserId()).isEqualTo(acceptedUserId.toString());
        verifyNoInteractions(authServiceClient, userRepository);
    }

    @Test
    void resendDecisionEmailSendsAcceptedApplicationOnboardingEmailAgain() {
        UUID applicationId = UUID.randomUUID();
        UUID acceptedUserId = UUID.randomUUID();
        JobApplication application = existingApplication(applicationId);
        application.setStatus(ApplicationStatus.APPLICATION_ACCEPTED);
        application.setAcceptedUserId(acceptedUserId);
        application.setDecisionEmailSent(false);
        when(repository.findByApplicationIdForUpdate(applicationId)).thenReturn(Optional.of(application));
        when(repository.save(any(JobApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));

        JobApplicationResponseDTO response = service.resendDecisionEmail(applicationId, "access-token");

        verify(authServiceClient).resendOnboardingEmail(acceptedUserId, "access-token");
        verify(repository).save(application);
        assertThat(application.getDecisionEmailSent()).isTrue();
        assertThat(response.getDecisionEmailSent()).isTrue();
    }

    @Test
    void acceptingDeniedApplicationFailsWithConflict() {
        UUID applicationId = UUID.randomUUID();
        JobApplication application = existingApplication(applicationId);
        application.setStatus(ApplicationStatus.APPLICATION_DENIED);
        when(repository.findByApplicationIdForUpdate(applicationId)).thenReturn(Optional.of(application));

        assertThatThrownBy(() -> service.acceptApplication(applicationId, null, "reviewer-2", "access-token"))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex -> {
                    assertThat(ex.getStatusCode()).isEqualTo(CONFLICT);
                    assertThat(ex.getReason()).isEqualTo("Application " + applicationId + " is already denied");
                });
        verifyNoInteractions(authServiceClient, userRepository);
    }

    @Test
    void repeatDenyReturnsCurrentApplication() {
        UUID applicationId = UUID.randomUUID();
        JobApplication application = existingApplication(applicationId);
        application.setStatus(ApplicationStatus.APPLICATION_DENIED);
        application.setReviewNote("Already denied");
        when(repository.findByApplicationIdForUpdate(applicationId)).thenReturn(Optional.of(application));

        JobApplicationResponseDTO response = service.denyApplication(applicationId, null, "reviewer-1");

        assertThat(response.getStatus()).isEqualTo("APPLICATION_DENIED");
        assertThat(response.getReviewNote()).isEqualTo("Already denied");
    }

    @Test
    void denyingAcceptedApplicationFailsWithConflict() {
        UUID applicationId = UUID.randomUUID();
        JobApplication application = existingApplication(applicationId);
        application.setStatus(ApplicationStatus.APPLICATION_ACCEPTED);
        when(repository.findByApplicationIdForUpdate(applicationId)).thenReturn(Optional.of(application));

        assertThatThrownBy(() -> service.denyApplication(applicationId, null, "reviewer-1"))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex -> {
                    assertThat(ex.getStatusCode()).isEqualTo(CONFLICT);
                    assertThat(ex.getReason()).isEqualTo("Application " + applicationId + " is already accepted");
                });
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
        request.setNote("Weekends");
        request.setWorkedForUsBefore(true);
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
