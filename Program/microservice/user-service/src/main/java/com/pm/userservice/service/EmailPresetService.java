package com.pm.userservice.service;

import com.pm.userservice.dto.EmailPresetAttachmentDTO;
import com.pm.userservice.dto.EmailPresetResponseDTO;
import com.pm.userservice.dto.EmailPresetSaveDTO;
import com.pm.userservice.dto.EmailPresetSendResponseDTO;
import com.pm.userservice.model.EmailPreset;
import com.pm.userservice.model.EmailPresetAttachment;
import com.pm.userservice.model.EmailPresetCategory;
import com.pm.userservice.model.EmailPresetGroup;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.EmailPresetAttachmentRepository;
import com.pm.userservice.repository.EmailPresetRepository;
import com.pm.userservice.repository.UserRepository;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class EmailPresetService {

    private static final Logger log = LoggerFactory.getLogger(EmailPresetService.class);

    private static final int MAX_ATTACHMENTS = 6;
    private static final long MAX_ATTACHMENT_BYTES = 5L * 1024 * 1024;

    private final EmailPresetRepository repository;
    private final EmailPresetAttachmentRepository attachmentRepository;
    private final UserRepository userRepository;
    private final AppEmailSender appEmailSender;
    private final MergeFieldResolver mergeFieldResolver;

    public EmailPresetService(EmailPresetRepository repository,
                              EmailPresetAttachmentRepository attachmentRepository,
                              UserRepository userRepository,
                              AppEmailSender appEmailSender,
                              MergeFieldResolver mergeFieldResolver) {
        this.repository = repository;
        this.attachmentRepository = attachmentRepository;
        this.userRepository = userRepository;
        this.appEmailSender = appEmailSender;
        this.mergeFieldResolver = mergeFieldResolver;
    }

    @Transactional(readOnly = true)
    public List<EmailPresetResponseDTO> list(String actorUserId) {
        UUID companyId = resolveCompanyId(actorUserId);
        return repository.findByCompanyIdOrderByGroupTypeAscNameAsc(companyId)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    @Transactional
    public EmailPresetResponseDTO create(EmailPresetSaveDTO request, String actorUserId) {
        UUID companyId = resolveCompanyId(actorUserId);
        EmailPreset preset = new EmailPreset();
        preset.setCompanyId(companyId);
        applySave(preset, request);
        return toDTO(repository.save(preset));
    }

    @Transactional
    public EmailPresetResponseDTO update(UUID presetId, EmailPresetSaveDTO request, String actorUserId) {
        UUID companyId = resolveCompanyId(actorUserId);
        EmailPreset preset = findPreset(presetId, companyId);
        applySave(preset, request);
        return toDTO(repository.save(preset));
    }

    @Transactional
    public void delete(UUID presetId, String actorUserId) {
        UUID companyId = resolveCompanyId(actorUserId);
        EmailPreset preset = findPreset(presetId, companyId);
        attachmentRepository.deleteByPresetId(presetId);
        repository.delete(preset);
    }

    /**
     * Sends a preset to a set of users (shift / project members, or a single account), resolving
     * link / personalization placeholders per recipient and including the preset's attachments.
     * Applicant reject / request-changes presets are deliberately not sendable here — those go
     * through the application decision endpoints so the two categories can never be crossed.
     */
    @Transactional
    public EmailPresetSendResponseDTO send(UUID presetId, List<String> userIds, String actorUserId) {
        UUID companyId = resolveCompanyId(actorUserId);
        EmailPreset preset = findPreset(presetId, companyId);

        if (preset.getGroupType() == EmailPresetGroup.APPLICATIONS
                || preset.getGroupType() == EmailPresetGroup.ONBOARDING) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Application and onboarding presets are sent through the review decision, not directly."
            );
        }

        if (userIds == null || userIds.isEmpty()) {
            return new EmailPresetSendResponseDTO(0, 0);
        }

        List<UUID> parsedIds = userIds.stream()
                .filter(StringUtils::isNotBlank)
                .map(id -> UUID.fromString(id.trim()))
                .distinct()
                .toList();

        // Only recipients in the caller's company, and only those with a real email address.
        List<User> recipients = userRepository.findByUserIdIn(parsedIds).stream()
                .filter(user -> companyId.equals(user.getCompanyId()))
                .filter(user -> StringUtils.isNotBlank(user.getEmail()))
                .toList();

        List<AppEmailSender.Attachment> attachments = loadAttachments(presetId);

        int sent = 0;
        for (User user : recipients) {
            String subject = mergeFieldResolver.resolveSubject(preset.getSubject(), firstName(user), fullName(user));
            String body = mergeFieldResolver.resolveHtml(preset.getBody(), firstName(user), fullName(user));
            try {
                appEmailSender.sendHtml(user.getEmail(), subject, body, attachments);
                sent++;
            } catch (RuntimeException e) {
                log.error("Preset email to {} failed; continuing with remaining recipients", user.getEmail(), e);
            }
        }
        // Observability: successful sends are otherwise silent, which makes "it never arrived"
        // impossible to diagnose (delivery accepted vs. no recipients resolved vs. SMTP error).
        log.info("Preset '{}' ({}) send: {} recipient(s) resolved, {} accepted by relay, {} attachment(s)",
                preset.getName(), presetId, recipients.size(), sent, attachments.size());
        return new EmailPresetSendResponseDTO(recipients.size(), sent);
    }

    // ---- Attachments ---------------------------------------------------------------------------

    @Transactional
    public EmailPresetAttachmentDTO addAttachment(UUID presetId, String actorUserId, MultipartFile file) throws IOException {
        UUID companyId = resolveCompanyId(actorUserId);
        EmailPreset preset = findPreset(presetId, companyId);
        if (preset.getGroupType() == EmailPresetGroup.APPLICATIONS
                || preset.getGroupType() == EmailPresetGroup.ONBOARDING) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Attachments aren't supported for application/onboarding presets (they're sent through the review decision)."
            );
        }
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No file provided");
        }
        if (file.getSize() > MAX_ATTACHMENT_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Attachment is too large (max 5MB)");
        }
        if (attachmentRepository.countByPresetId(presetId) >= MAX_ATTACHMENTS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This preset already has the maximum number of attachments");
        }
        EmailPresetAttachment attachment = new EmailPresetAttachment();
        attachment.setPresetId(presetId);
        attachment.setFileName(StringUtils.defaultIfBlank(file.getOriginalFilename(), "attachment"));
        attachment.setContentType(file.getContentType());
        attachment.setSizeBytes(file.getSize());
        attachment.setBytes(file.getBytes());
        return toAttachmentDTO(attachmentRepository.save(attachment));
    }

    @Transactional(readOnly = true)
    public EmailPresetAttachment getAttachment(UUID presetId, UUID attachmentId, String actorUserId) {
        UUID companyId = resolveCompanyId(actorUserId);
        findPreset(presetId, companyId);
        return attachmentRepository.findByIdAndPresetId(attachmentId, presetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found"));
    }

    @Transactional
    public void deleteAttachment(UUID presetId, UUID attachmentId, String actorUserId) {
        UUID companyId = resolveCompanyId(actorUserId);
        findPreset(presetId, companyId);
        EmailPresetAttachment attachment = attachmentRepository.findByIdAndPresetId(attachmentId, presetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found"));
        attachmentRepository.delete(attachment);
    }

    private List<AppEmailSender.Attachment> loadAttachments(UUID presetId) {
        return attachmentRepository.findByPresetIdOrderByCreatedAtAsc(presetId).stream()
                .map(a -> new AppEmailSender.Attachment(a.getFileName(), a.getContentType(), a.getBytes()))
                .toList();
    }

    // ---- Helpers -------------------------------------------------------------------------------

    private EmailPreset findPreset(UUID presetId, UUID companyId) {
        return repository.findByIdAndCompanyId(presetId, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Email preset not found"));
    }

    private void applySave(EmailPreset preset, EmailPresetSaveDTO request) {
        EmailPresetGroup group = parseGroup(request.getGroupType());
        preset.setGroupType(group);
        preset.setCategory(normalizeCategory(group, request.getCategory()));
        preset.setName(StringUtils.trimToEmpty(request.getName()));
        preset.setSubject(StringUtils.trimToEmpty(request.getSubject()));
        preset.setBody(StringUtils.trimToEmpty(request.getBody()));
    }

    private static EmailPresetGroup parseGroup(String raw) {
        try {
            return EmailPresetGroup.valueOf(StringUtils.trimToEmpty(raw).toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown email preset group: " + raw);
        }
    }

    /**
     * Split groups must carry an explicit decision category so the flows stay separable in the UI.
     * APPLICATIONS additionally allows ACCEPT (the accept flow can send a welcome email); ONBOARDING
     * has no accept step so it stays REJECT / REQUEST_CHANGES. Every other group is forced to GENERAL.
     */
    private static EmailPresetCategory normalizeCategory(EmailPresetGroup group, String raw) {
        boolean split = group == EmailPresetGroup.APPLICATIONS || group == EmailPresetGroup.ONBOARDING;
        if (!split) {
            return EmailPresetCategory.GENERAL;
        }
        boolean acceptAllowed = group == EmailPresetGroup.APPLICATIONS;
        String allowed = acceptAllowed ? "REJECT, REQUEST_CHANGES or ACCEPT" : "REJECT or REQUEST_CHANGES";
        EmailPresetCategory category;
        try {
            category = EmailPresetCategory.valueOf(StringUtils.trimToEmpty(raw).toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    group + " presets must be categorised as " + allowed);
        }
        boolean valid = category == EmailPresetCategory.REJECT
                || category == EmailPresetCategory.REQUEST_CHANGES
                || (acceptAllowed && category == EmailPresetCategory.ACCEPT);
        if (!valid) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    group + " presets must be categorised as " + allowed);
        }
        return category;
    }

    private static String firstName(User user) {
        String preferred = StringUtils.trimToNull(user.getPreferredName());
        if (preferred != null) {
            return preferred;
        }
        return StringUtils.trimToEmpty(user.getFirstNames());
    }

    private static String fullName(User user) {
        String combined = StringUtils.normalizeSpace(String.join(" ",
                StringUtils.defaultString(user.getFirstNames()),
                StringUtils.defaultString(user.getMiddleNamePrefix()),
                StringUtils.defaultString(user.getLastName())));
        if (!combined.isBlank()) {
            return combined;
        }
        return StringUtils.trimToEmpty(user.getPreferredName());
    }

    private UUID resolveCompanyId(String actorUserId) {
        if (StringUtils.isBlank(actorUserId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing user identity");
        }
        return userRepository.findByUserId(UUID.fromString(actorUserId))
                .map(User::getCompanyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "User is missing a company"));
    }

    private EmailPresetResponseDTO toDTO(EmailPreset preset) {
        EmailPresetResponseDTO dto = new EmailPresetResponseDTO();
        dto.setId(preset.getId().toString());
        dto.setGroupType(preset.getGroupType().name());
        dto.setCategory(preset.getCategory().name());
        dto.setName(preset.getName());
        dto.setSubject(preset.getSubject());
        dto.setBody(preset.getBody());
        dto.setAttachments(attachmentRepository.findByPresetIdOrderByCreatedAtAsc(preset.getId())
                .stream()
                .map(EmailPresetService::toAttachmentDTO)
                .toList());
        dto.setCreatedAt(preset.getCreatedAt() != null ? preset.getCreatedAt().toString() : null);
        dto.setUpdatedAt(preset.getUpdatedAt() != null ? preset.getUpdatedAt().toString() : null);
        return dto;
    }

    private static EmailPresetAttachmentDTO toAttachmentDTO(EmailPresetAttachment attachment) {
        EmailPresetAttachmentDTO dto = new EmailPresetAttachmentDTO();
        dto.setId(attachment.getId().toString());
        dto.setFileName(attachment.getFileName());
        dto.setContentType(attachment.getContentType());
        dto.setSizeBytes(attachment.getSizeBytes());
        return dto;
    }
}
