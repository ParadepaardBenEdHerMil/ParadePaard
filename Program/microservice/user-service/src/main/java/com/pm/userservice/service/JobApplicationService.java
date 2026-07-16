package com.pm.userservice.service;

import com.pm.userservice.dto.ApplicationDecisionRequestDTO;
import com.pm.userservice.dto.AuditLogCreateRequestDTO;
import com.pm.userservice.dto.AuditLogMessagePartDTO;
import com.pm.userservice.dto.AuthAdminOnboardUserRequestDTO;
import com.pm.userservice.dto.AuthAdminOnboardUserResponseDTO;
import com.pm.userservice.dto.JobApplicationRequestDTO;
import com.pm.userservice.dto.JobApplicationResponseDTO;
import com.pm.userservice.exception.EmailAlreadyExistsException;
import com.pm.userservice.exception.ReapplicationNotAllowedException;
import com.pm.userservice.integration.AuthServiceClient;
import com.pm.userservice.mapper.JobApplicationMapper;
import com.pm.userservice.validation.JobApplicationUploadValidator;
import com.pm.userservice.model.ApplicationStatus;
import com.pm.userservice.model.Company;
import com.pm.userservice.model.JobApplication;
import com.pm.userservice.model.User;
import com.pm.userservice.model.UserStatus;
import com.pm.userservice.repository.CompanyRepository;
import com.pm.userservice.repository.JobApplicationRepository;
import com.pm.userservice.repository.UserRepository;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class JobApplicationService {

    private static final Logger log = LoggerFactory.getLogger(JobApplicationService.class);

    private static final UUID DEFAULT_COMPANY_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final JobApplicationRepository repository;
    private final UserRepository userRepository;
    private final AuthServiceClient authServiceClient;
    private final AppEmailSender appEmailSender;
    private final CompanyRepository companyRepository;
    private final MergeFieldResolver mergeFieldResolver;
    @Autowired(required = false)
    private AuditLogService auditLogService;

    public JobApplicationService(JobApplicationRepository repository,
                                 UserRepository userRepository,
                                 AuthServiceClient authServiceClient,
                                 AppEmailSender appEmailSender,
                                 CompanyRepository companyRepository,
                                 MergeFieldResolver mergeFieldResolver) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.authServiceClient = authServiceClient;
        this.appEmailSender = appEmailSender;
        this.companyRepository = companyRepository;
        this.mergeFieldResolver = mergeFieldResolver;
    }

    private enum DecisionKind { REJECT, REQUEST_CHANGES }

    @Transactional
    public JobApplicationResponseDTO submitApplication(JobApplicationRequestDTO request,
                                                       MultipartFile profilePicture,
                                                       MultipartFile cv) throws IOException {
        enforceApplicationEligibility(request);
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

    /**
     * Decides whether a submission is allowed. An email tied to a real user account is always
     * refused, as is one with a still-open or already-accepted application. Once every prior
     * application for the email is terminal (rejected / sent back for changes), a fresh
     * application — a reapplication — is allowed only when the company permits it and the
     * applicant has not been individually blocked.
     */
    private void enforceApplicationEligibility(JobApplicationRequestDTO request) {
        String email = StringUtils.trimToEmpty(request.getEmail());
        request.setEmail(email);

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new EmailAlreadyExistsException("Email already exists " + email);
        }

        List<JobApplication> priorApplications = repository.findByEmailIgnoreCaseOrderBySubmittedAtDesc(email);
        if (priorApplications.isEmpty()) {
            return;
        }

        boolean hasOpenOrAccepted = priorApplications.stream().anyMatch(application ->
                application.getStatus() == ApplicationStatus.APPLICATION_SUBMITTED
                        || application.getStatus() == ApplicationStatus.APPLICATION_ACCEPTED);
        if (hasOpenOrAccepted) {
            throw new EmailAlreadyExistsException("Email already exists " + email);
        }

        // Deliberately one generic message for both refusal reasons so it never reveals whether the
        // applicant was individually blocked or reapplications are turned off company-wide.
        boolean individuallyBlocked = priorApplications.stream().anyMatch(JobApplication::isReapplicationBlocked);
        if (individuallyBlocked || !reapplicationsAllowed()) {
            throw new ReapplicationNotAllowedException(
                    "We're not able to accept a new application from you at this time.");
        }
    }

    private boolean reapplicationsAllowed() {
        return companyRepository.findById(DEFAULT_COMPANY_ID)
                .map(Company::isAllowReapplications)
                .orElse(true);
    }

    @Transactional(readOnly = true)
    public List<JobApplicationResponseDTO> getApplications() {
        List<JobApplication> all = repository.findAll(Sort.by(Sort.Direction.DESC, "submittedAt"));
        // Group once (newest-first order preserved) so reapplicant context is O(n) rather than a
        // per-row query.
        Map<String, List<JobApplication>> byEmail = all.stream()
                .collect(Collectors.groupingBy(JobApplicationService::emailKey));
        return all.stream()
                .map(application -> {
                    JobApplicationResponseDTO dto = JobApplicationMapper.toDTO(application);
                    applyReapplicationContext(dto, application, byEmail.getOrDefault(emailKey(application), List.of()));
                    return dto;
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public JobApplicationResponseDTO getApplication(UUID applicationId) {
        JobApplication application = findApplication(applicationId);
        JobApplicationResponseDTO dto = JobApplicationMapper.toDTO(application);
        applyReapplicationContext(dto, application,
                repository.findByEmailIgnoreCaseOrderBySubmittedAtDesc(application.getEmail()));
        return dto;
    }

    /**
     * Sets (or clears) the per-applicant reapplication block from the application detail page. This
     * is how an admin bars a specific person from reapplying even when the company allows it.
     */
    @Transactional
    public JobApplicationResponseDTO setReapplicationBlocked(UUID applicationId, boolean blocked, String reviewerUserId) {
        JobApplication application = findApplicationForDecision(applicationId);
        application.setReapplicationBlocked(blocked);
        JobApplication saved = repository.save(application);
        recordAudit(saved, reviewerUserId, blocked ? "REAPPLICATION_BLOCKED" : "REAPPLICATION_UNBLOCKED");
        JobApplicationResponseDTO dto = JobApplicationMapper.toDTO(saved);
        applyReapplicationContext(dto, saved,
                repository.findByEmailIgnoreCaseOrderBySubmittedAtDesc(saved.getEmail()));
        return dto;
    }

    private static String emailKey(JobApplication application) {
        return application.getEmail() == null ? "" : application.getEmail().toLowerCase(Locale.ROOT);
    }

    /**
     * Fills the reapplicant fields on a response: whether earlier applications exist for the same
     * email, how many, and the most recent prior decision + reviewer note (the "decision from last
     * time"). {@code sameEmailNewestFirst} must be ordered newest-first.
     */
    private static void applyReapplicationContext(JobApplicationResponseDTO dto,
                                                  JobApplication current,
                                                  List<JobApplication> sameEmailNewestFirst) {
        List<JobApplication> priors = sameEmailNewestFirst.stream()
                .filter(other -> !other.getApplicationId().equals(current.getApplicationId()))
                .filter(other -> other.getSubmittedAt() != null
                        && current.getSubmittedAt() != null
                        && other.getSubmittedAt().isBefore(current.getSubmittedAt()))
                .toList();
        dto.setPriorApplicationCount(priors.size());
        dto.setReapplicant(!priors.isEmpty());
        if (!priors.isEmpty()) {
            JobApplication mostRecentPrior = priors.get(0);
            dto.setPriorDecision(mostRecentPrior.getStatus().name());
            dto.setPriorReviewNote(mostRecentPrior.getReviewNote());
            dto.setPriorDecisionAt(mostRecentPrior.getReviewedAt() != null
                    ? mostRecentPrior.getReviewedAt().toString()
                    : null);
        }
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
        application.setDecisionEmailSent(sendApplicantDecisionEmail(application, request, DecisionKind.REJECT));
        JobApplication saved = repository.save(application);
        recordAudit(saved, reviewerUserId, "REJECTED");
        return JobApplicationMapper.toDTO(saved);
    }

    /**
     * Sends the application back to the applicant asking for changes. Unlike a denial this is not
     * terminal: the application is marked CHANGES_REQUESTED and the applicant is emailed. Because
     * the public application form has no logged-in session, the applicant corrects their details
     * by submitting a fresh application (see reapplications), where the prior CHANGES_REQUESTED
     * decision and reviewer note surface as the reapplicant context.
     */
    @Transactional
    public JobApplicationResponseDTO requestChanges(UUID applicationId,
                                                    ApplicationDecisionRequestDTO request,
                                                    String reviewerUserId) {
        JobApplication application = findApplicationForDecision(applicationId);
        if (application.getStatus() == ApplicationStatus.APPLICATION_ACCEPTED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Application " + applicationId + " is already accepted"
            );
        }
        if (application.getStatus() == ApplicationStatus.APPLICATION_DENIED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Application " + applicationId + " is already denied"
            );
        }
        application.setStatus(ApplicationStatus.APPLICATION_CHANGES_REQUESTED);
        applyDecisionMetadata(application, request, reviewerUserId);
        application.setDecisionEmailSent(sendApplicantDecisionEmail(application, request, DecisionKind.REQUEST_CHANGES));
        JobApplication saved = repository.save(application);
        recordAudit(saved, reviewerUserId, "CHANGES_REQUESTED");
        return JobApplicationMapper.toDTO(saved);
    }

    /**
     * Emails the applicant about a reject / request-changes decision using the reviewer-supplied
     * subject and body (resolved from a preset). There is deliberately no default template: when no
     * email content is supplied, nothing is sent. Best-effort — a delivery failure is logged and
     * reported via {@code decisionEmailSent} but never rolls back the decision.
     */
    private boolean sendApplicantDecisionEmail(JobApplication application,
                                               ApplicationDecisionRequestDTO request,
                                               DecisionKind kind) {
        String rawSubject = request == null ? null : StringUtils.trimToNull(request.getEmailSubject());
        String rawBody = request == null ? null : StringUtils.trimToNull(request.getEmailBody());
        if (rawSubject == null || rawBody == null) {
            return false;
        }
        // Resolve link / personalization placeholders against the applicant, then remember the
        // resolved HTML so a later resend replays it verbatim (even if this attempt fails).
        String subject = mergeFieldResolver.resolveSubject(rawSubject, applicantFirstName(application), applicantLabel(application));
        String body = mergeFieldResolver.resolveHtml(rawBody, applicantFirstName(application), applicantLabel(application));
        application.setDecisionEmailSubject(subject);
        application.setDecisionEmailBody(body);
        return deliverApplicantDecisionEmail(application, kind, subject, body, "send");
    }

    private static String applicantFirstName(JobApplication application) {
        String preferred = StringUtils.trimToNull(application.getPreferredName());
        return preferred != null ? preferred : StringUtils.trimToEmpty(application.getFirstNames());
    }

    /** Replays the stored reject / request-changes email. Rejects the resend when none was stored. */
    private boolean resendApplicantDecisionEmail(JobApplication application, DecisionKind kind) {
        String subject = StringUtils.trimToNull(application.getDecisionEmailSubject());
        String body = StringUtils.trimToNull(application.getDecisionEmailBody());
        if (subject == null || body == null) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This decision was recorded without a saved email, so there is nothing to resend."
            );
        }
        return deliverApplicantDecisionEmail(application, kind, subject, body, "resend");
    }

    private boolean deliverApplicantDecisionEmail(JobApplication application, DecisionKind kind,
                                                  String subject, String body, String verb) {
        String toEmail = StringUtils.trimToNull(application.getEmail());
        if (toEmail == null) {
            return false;
        }
        try {
            // Applicant decision emails carry the rich HTML body but no attachments (those are a
            // direct-send preset feature; application/onboarding presets can't hold attachments).
            appEmailSender.sendHtml(toEmail, subject, body, List.of());
            return true;
        } catch (Exception e) {
            log.error("Failed to {} applicant {} email for application {}", verb, kind, application.getApplicationId(), e);
            return false;
        }
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
        switch (application.getStatus()) {
            case APPLICATION_ACCEPTED -> {
                if (application.getAcceptedUserId() == null) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Application " + applicationId + " has no accepted user"
                    );
                }
                // Accepted applicants are onboarded through auth-service, which owns their email.
                authServiceClient.resendOnboardingEmail(application.getAcceptedUserId(), accessToken);
                application.setDecisionEmailSent(true);
            }
            case APPLICATION_DENIED ->
                    application.setDecisionEmailSent(resendApplicantDecisionEmail(application, DecisionKind.REJECT));
            case APPLICATION_CHANGES_REQUESTED ->
                    application.setDecisionEmailSent(resendApplicantDecisionEmail(application, DecisionKind.REQUEST_CHANGES));
            default -> throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Application " + applicationId + " has no decision email to resend"
            );
        }
        JobApplication saved = repository.save(application);
        recordAudit(saved, saved.getReviewedByUserId(), "RESENT_DECISION_EMAIL");
        return JobApplicationMapper.toDTO(saved);
    }

    private void recordAudit(JobApplication application, String reviewerUserId, String action) {
        if (auditLogService == null) {
            return;
        }
        // Audit logging is a secondary concern: it must never fail (or roll back) the decision it
        // is recording. An earlier bug did exactly that — an exception here aborted the accept
        // transaction *after* the auth account had already been created, permanently wedging the
        // applicant behind "Email Already Exists". Keep it strictly best-effort.
        try {
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
        } catch (Exception e) {
            log.warn("Failed to record audit log for application {} action {}", application.getApplicationId(), action, e);
        }
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
            case "CHANGES_REQUESTED" -> " requested changes for ";
            case "REAPPLICATION_BLOCKED" -> " blocked reapplications for ";
            case "REAPPLICATION_UNBLOCKED" -> " allowed reapplications for ";
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
