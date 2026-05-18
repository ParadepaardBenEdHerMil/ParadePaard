package com.pm.userservice.service;

import com.pm.userservice.dto.ApplicationDecisionRequestDTO;
import com.pm.userservice.dto.AuthAdminOnboardUserRequestDTO;
import com.pm.userservice.dto.AuthAdminOnboardUserResponseDTO;
import com.pm.userservice.dto.JobApplicationRequestDTO;
import com.pm.userservice.dto.JobApplicationResponseDTO;
import com.pm.userservice.exception.EmailAlreadyExistsException;
import com.pm.userservice.integration.AuthServiceClient;
import com.pm.userservice.mapper.JobApplicationMapper;
import com.pm.userservice.model.ApplicationStatus;
import com.pm.userservice.model.JobApplication;
import com.pm.userservice.model.User;
import com.pm.userservice.model.UserStatus;
import com.pm.userservice.repository.JobApplicationRepository;
import com.pm.userservice.repository.UserRepository;
import org.apache.commons.lang3.StringUtils;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class JobApplicationService {

    private static final UUID DEFAULT_COMPANY_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final JobApplicationRepository repository;
    private final UserRepository userRepository;
    private final AuthServiceClient authServiceClient;

    public JobApplicationService(JobApplicationRepository repository,
                                 UserRepository userRepository,
                                 AuthServiceClient authServiceClient) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.authServiceClient = authServiceClient;
    }

    @Transactional
    public JobApplicationResponseDTO submitApplication(JobApplicationRequestDTO request, MultipartFile cv) throws IOException {
        validateUniqueApplicationEmail(request);
        JobApplication application = JobApplicationMapper.toNewEntity(request);
        if (cv != null && !cv.isEmpty()) {
            application.setCvFileName(cv.getOriginalFilename());
            application.setCvContentType(cv.getContentType());
            application.setCvBytes(cv.getBytes());
        }
        return JobApplicationMapper.toDTO(repository.save(application));
    }

    private void validateUniqueApplicationEmail(JobApplicationRequestDTO request) {
        String email = StringUtils.trimToEmpty(request.getEmail());
        request.setEmail(email);
        if (repository.existsByEmailIgnoreCase(email) || userRepository.existsByEmailIgnoreCase(email)) {
            throw new EmailAlreadyExistsException("Email already exists " + email);
        }
    }

    @Transactional(readOnly = true)
    public List<JobApplicationResponseDTO> getApplications() {
        return repository.findAll(Sort.by(Sort.Direction.DESC, "submittedAt"))
                .stream()
                .map(JobApplicationMapper::toDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public JobApplicationResponseDTO getApplication(UUID applicationId) {
        return JobApplicationMapper.toDTO(findApplication(applicationId));
    }

    @Transactional(readOnly = true)
    public JobApplication getApplicationCv(UUID applicationId) {
        return findApplication(applicationId);
    }

    @Transactional
    public JobApplicationResponseDTO denyApplication(UUID applicationId,
                                                     ApplicationDecisionRequestDTO request,
                                                     String reviewerUserId) {
        JobApplication application = findApplicationForDecision(applicationId);
        if (application.getStatus() == ApplicationStatus.APPLICATION_DENIED) {
            return JobApplicationMapper.toDTO(application);
        }
        if (application.getStatus() == ApplicationStatus.APPLICATION_ACCEPTED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Application " + applicationId + " is already accepted"
            );
        }
        application.setStatus(ApplicationStatus.APPLICATION_DENIED);
        applyDecisionMetadata(application, request, reviewerUserId);
        return JobApplicationMapper.toDTO(repository.save(application));
    }

    @Transactional
    public JobApplicationResponseDTO acceptApplication(UUID applicationId,
                                                       ApplicationDecisionRequestDTO request,
                                                       String reviewerUserId,
                                                       String accessToken) {
        JobApplication application = findApplicationForDecision(applicationId);
        if (application.getStatus() == ApplicationStatus.APPLICATION_ACCEPTED) {
            return JobApplicationMapper.toDTO(application);
        }
        if (application.getStatus() == ApplicationStatus.APPLICATION_DENIED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Application " + applicationId + " is already denied"
            );
        }

        AuthAdminOnboardUserResponseDTO authResponse = authServiceClient.adminOnboardUser(
                buildAuthRequest(application),
                accessToken
        );
        if (authResponse == null || StringUtils.isBlank(authResponse.getUserId())) {
            throw new IllegalStateException("Auth service did not return a userId");
        }

        UUID acceptedUserId = UUID.fromString(authResponse.getUserId().trim());
        userRepository.save(buildPendingSetupUser(application, authResponse, acceptedUserId));

        application.setAcceptedUserId(acceptedUserId);
        application.setStatus(ApplicationStatus.APPLICATION_ACCEPTED);
        applyDecisionMetadata(application, request, reviewerUserId);
        application.setDecisionEmailSent(Boolean.TRUE.equals(authResponse.getOnboardingEmailSent()));
        return JobApplicationMapper.toDTO(repository.save(application));
    }

    @Transactional
    public JobApplicationResponseDTO resendDecisionEmail(UUID applicationId, String accessToken) {
        JobApplication application = findApplicationForDecision(applicationId);
        if (application.getStatus() != ApplicationStatus.APPLICATION_ACCEPTED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Application " + applicationId + " is not accepted"
            );
        }
        if (application.getAcceptedUserId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Application " + applicationId + " has no accepted user"
            );
        }

        authServiceClient.resendOnboardingEmail(application.getAcceptedUserId(), accessToken);
        application.setDecisionEmailSent(true);
        return JobApplicationMapper.toDTO(repository.save(application));
    }

    private JobApplication findApplication(UUID applicationId) {
        return repository.findById(applicationId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Application " + applicationId + " not found"
                ));
    }

    private JobApplication findApplicationForDecision(UUID applicationId) {
        return repository.findByApplicationIdForUpdate(applicationId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Application " + applicationId + " not found"
                ));
    }

    private static void applyDecisionMetadata(JobApplication application,
                                              ApplicationDecisionRequestDTO request,
                                              String reviewerUserId) {
        application.setReviewNote(request != null ? request.getReviewNote() : null);
        application.setReviewedAt(OffsetDateTime.now());
        application.setReviewedByUserId(reviewerUserId);
        application.setDecisionEmailSent(false);
    }

    private static AuthAdminOnboardUserRequestDTO buildAuthRequest(JobApplication application) {
        AuthAdminOnboardUserRequestDTO request = new AuthAdminOnboardUserRequestDTO();
        request.setEmail(application.getEmail());
        request.setFirstName(application.getFirstNames());
        request.setLastName(buildAuthLastName(application));
        return request;
    }

    private static User buildPendingSetupUser(JobApplication application,
                                              AuthAdminOnboardUserResponseDTO authResponse,
                                              UUID acceptedUserId) {
        User user = new User();
        user.setUserId(acceptedUserId);
        user.setEmail(application.getEmail());
        user.setPreferredName(application.getPreferredName());
        user.setFirstNames(application.getFirstNames());
        user.setMiddleNamePrefix(application.getMiddleNamePrefix());
        user.setLastName(application.getLastName());
        user.setGender(application.getGender());
        user.setDateOfBirth(application.getDateOfBirth());
        user.setMobileNumber(application.getPhoneNumber());
        user.setPosition(application.getRoleInterest());
        user.setWorkedForUsBefore(application.isWorkedForUsBefore());
        user.setStatus(UserStatus.PENDING_SETUP);
        user.setCompanyId(parseCompanyIdOrDefault(authResponse));
        return user;
    }

    private static UUID parseCompanyIdOrDefault(AuthAdminOnboardUserResponseDTO authResponse) {
        if (authResponse != null && StringUtils.isNotBlank(authResponse.getCompanyId())) {
            return UUID.fromString(authResponse.getCompanyId().trim());
        }
        return DEFAULT_COMPANY_ID;
    }

    private static String buildAuthLastName(JobApplication application) {
        String prefix = application.getMiddleNamePrefix();
        String lastName = application.getLastName();
        if (StringUtils.isBlank(prefix)) {
            return lastName == null ? "" : lastName.trim();
        }
        if (StringUtils.isBlank(lastName)) {
            return prefix.trim();
        }
        return prefix.trim() + " " + lastName.trim();
    }
}
