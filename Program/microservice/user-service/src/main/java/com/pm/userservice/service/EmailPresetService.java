package com.pm.userservice.service;

import com.pm.userservice.dto.EmailPresetResponseDTO;
import com.pm.userservice.dto.EmailPresetSaveDTO;
import com.pm.userservice.dto.EmailPresetSendResponseDTO;
import com.pm.userservice.model.EmailPreset;
import com.pm.userservice.model.EmailPresetCategory;
import com.pm.userservice.model.EmailPresetGroup;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.EmailPresetRepository;
import com.pm.userservice.repository.UserRepository;
import org.apache.commons.lang3.StringUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class EmailPresetService {

    private final EmailPresetRepository repository;
    private final UserRepository userRepository;
    private final AppEmailSender appEmailSender;

    public EmailPresetService(EmailPresetRepository repository,
                              UserRepository userRepository,
                              AppEmailSender appEmailSender) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.appEmailSender = appEmailSender;
    }

    @Transactional(readOnly = true)
    public List<EmailPresetResponseDTO> list(String actorUserId) {
        UUID companyId = resolveCompanyId(actorUserId);
        return repository.findByCompanyIdOrderByGroupTypeAscNameAsc(companyId)
                .stream()
                .map(EmailPresetService::toDTO)
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
        EmailPreset preset = repository.findByIdAndCompanyId(presetId, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Email preset not found"));
        applySave(preset, request);
        return toDTO(repository.save(preset));
    }

    @Transactional
    public void delete(UUID presetId, String actorUserId) {
        UUID companyId = resolveCompanyId(actorUserId);
        EmailPreset preset = repository.findByIdAndCompanyId(presetId, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Email preset not found"));
        repository.delete(preset);
    }

    /**
     * Sends a preset to a set of users (shift / project members, or a single account). Applicant
     * reject / request-changes presets are deliberately not sendable here — those go through the
     * application decision endpoints so a reject preset can never be sent as a request-changes
     * decision or vice versa.
     */
    @Transactional
    public EmailPresetSendResponseDTO send(UUID presetId, List<String> userIds, String actorUserId) {
        UUID companyId = resolveCompanyId(actorUserId);
        EmailPreset preset = repository.findByIdAndCompanyId(presetId, companyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Email preset not found"));

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
        List<String> emails = userRepository.findByUserIdIn(parsedIds).stream()
                .filter(user -> companyId.equals(user.getCompanyId()))
                .map(User::getEmail)
                .filter(StringUtils::isNotBlank)
                .distinct()
                .toList();

        int sent = appEmailSender.sendPlainTextBulk(emails, preset.getSubject(), preset.getBody());
        return new EmailPresetSendResponseDTO(emails.size(), sent);
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
     * Reject / request-changes groups must carry an explicit REJECT or REQUEST_CHANGES category so
     * the two stay separable in the UI; every other group is forced to GENERAL.
     */
    private static EmailPresetCategory normalizeCategory(EmailPresetGroup group, String raw) {
        boolean split = group == EmailPresetGroup.APPLICATIONS || group == EmailPresetGroup.ONBOARDING;
        if (!split) {
            return EmailPresetCategory.GENERAL;
        }
        EmailPresetCategory category;
        try {
            category = EmailPresetCategory.valueOf(StringUtils.trimToEmpty(raw).toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    group + " presets must be categorised as REJECT or REQUEST_CHANGES");
        }
        if (category != EmailPresetCategory.REJECT && category != EmailPresetCategory.REQUEST_CHANGES) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    group + " presets must be categorised as REJECT or REQUEST_CHANGES");
        }
        return category;
    }

    private UUID resolveCompanyId(String actorUserId) {
        if (StringUtils.isBlank(actorUserId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing user identity");
        }
        return userRepository.findByUserId(UUID.fromString(actorUserId))
                .map(User::getCompanyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "User is missing a company"));
    }

    private static EmailPresetResponseDTO toDTO(EmailPreset preset) {
        EmailPresetResponseDTO dto = new EmailPresetResponseDTO();
        dto.setId(preset.getId().toString());
        dto.setGroupType(preset.getGroupType().name());
        dto.setCategory(preset.getCategory().name());
        dto.setName(preset.getName());
        dto.setSubject(preset.getSubject());
        dto.setBody(preset.getBody());
        dto.setCreatedAt(preset.getCreatedAt() != null ? preset.getCreatedAt().toString() : null);
        dto.setUpdatedAt(preset.getUpdatedAt() != null ? preset.getUpdatedAt().toString() : null);
        return dto;
    }
}
