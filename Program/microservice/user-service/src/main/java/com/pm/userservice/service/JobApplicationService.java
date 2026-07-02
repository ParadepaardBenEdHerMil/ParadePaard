package com.pm.userservice.service;

import com.pm.userservice.dto.ApplicationDecisionRequestDTO;
import com.pm.userservice.dto.AuditLogCreateRequestDTO;
import com.pm.userservice.dto.AuditLogMessagePartDTO;
import com.pm.userservice.dto.AuthAdminOnboardUserRequestDTO;
import com.pm.userservice.dto.AuthAdminOnboardUserResponseDTO;
import com.pm.userservice.dto.JobApplicationRequestDTO;
import com.pm.userservice.dto.JobApplicationResponseDTO;
import com.pm.userservice.exception.EmailAlreadyExistsException;
import com.pm.userservice.integration.AuthServiceClient;
import com.pm.userservice.mapper.JobApplicationMapper;
import com.pm.userservice.validation.JobApplicationUploadValidator;
import com.pm.userservice.model.ApplicationStatus;
import com.pm.userservice.model.JobApplication;
import com.pm.userservice.model.User;
import com.pm.userservice.model.UserStatus;
import com.pm.userservice.repository.JobApplicationRepository;
import com.pm.userservice.repository.UserRepository;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
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
    @Autowired(required = false)
    private AuditLogService auditLogService;

    public JobApplicationService(JobApplicationRepository repository,
                                 UserRepository userRepository,
                                 AuthServiceClient authServiceClient) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.authServiceClient = authServiceClient;
    }

    @Transactional
    public JobApplicationResponseDTO submitApplication(JobApplicationRequestDTO request,
                                                       MultipartFile profilePicture,
                                                       MultipartFile cv) throws IOException {
        validateUniqueApplicationEmail(request);
        if (profilePicture != null && !profilePicture.isEmpty()) {
            JobApplicationUploadValidator.validateProfilePicture(profilePicture.getContentType(), profilePicture.getSize());
        }
        if (cv != null && !cv.isEmpty()) {
            JobApplicationUploadValidator.validateCv(cv.getContentType(), cv.getSize());
        }
        JobApplication application = JobApplicationMapper.toNewEntity(request);
        application.setProfilePictureFileName(profilePicture.getOriginalFilename());
        application.setProfilePictureContentType(profilePicture.getContentType());
        application.setProfilePictureBytes(profilePicture.getBytes());
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

    @Transactional(readOnly = true)
    public JobApplication getApplicationProfilePicture(UUID applicationId) {
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
        JobApplication saved = repository.save(application);
        recordAudit(saved, reviewerUserId, "REJECTED");
        return JobApplicationMapper.toDTO(saved);
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
        JobApplication saved = repository.save(application);
        recordAudit(saved, reviewerUserId, "ACCEPTED");
        return JobApplicationMapper.toDTO(saved);
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
        JobApplication saved = repository.save(application);
        recordAudit(saved, saved.getReviewedByUserId(), "RESENT_DECISION_EMAIL");
        return JobApplicationMapper.toDTO(saved);
    }

    private void recordAudit(JobApplication application, String reviewerUserId, String action) {
        if (auditLogService == null) {
            return;
        }
        UUID companyId = resolveCompanyId(reviewerUserId);
        UUID actorUserId = reviewerUserId == null || reviewerUserId.isBlank() ? null : UUID.fromString(reviewerUserId);
        AuditLogCreateRequestDTO request = new AuditLogCreateRequestDTO();
        request.setCategory("APPLICATIONS");
        request.setAction(action);
        request.setEntityType("APPLICATION");
        request.setEntityId(application.getApplicationId().toString());
        request.setMessageParts(List.of(
                textPart(actionText(action)),
                linkPart("APPLICATION", application.getApplicationId().toString(), "application", "/management/applications/" + application.getApplicationId()),
                textPart(" for "),
                textPart(applicantLabel(application))
        ));
        auditLogService.record(companyId, actorUserId, request);
    }

    private UUID resolveCompanyId(String reviewerUserId) {
        if (reviewerUserId == null || reviewerUserId.isBlank()) {
            return DEFAULT_COMPANY_ID;
        }
        return userRepository.findByUserId(UUID.fromString(reviewerUserId))
                .map(User::getCompanyId)
                .orElse(DEFAULT_COMPANY_ID);
    }

    private static String applicantLabel(JobApplication application) {
        String preferred = StringUtils.trimToNull(application.getPreferredName());
        if (preferred != null) {
            return preferred;
        }
        String combined = StringUtils.normalizeSpace(
                String.join(" ",
                        StringUtils.defaultString(application.getFirstNames()),
                        StringUtils.defaultString(application.getMiddleNamePrefix()),
                        StringUtils.defaultString(application.getLastName())
                )
        );
        return combined.isBlank() ? application.getEmail() : combined;
    }

    private static String actionText(String action) {
        return switch (action) {
            case "ACCEPTED" -> " accepted ";
            case "REJECTED" -> " denied ";
            case "RESENT_DECISION_EMAIL" -> " resent decision email for ";
            default -> " updated ";
        };
    }

    private static AuditLogMessagePartDTO textPart(String text) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("TEXT");
        part.setText(text);
        return part;
    }

    private static AuditLogMessagePartDTO linkPart(String entityType, String entityId, String label, String route) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("LINK");
        part.setEntityType(entityType);
        part.setEntityId(entityId);
        part.setLabel(label);
        part.setRoute(route);
        return part;
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
        user.setProfilePicture(application.getProfilePictureBytes());
        user.setProfilePictureContentType(application.getProfilePictureContentType());
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
