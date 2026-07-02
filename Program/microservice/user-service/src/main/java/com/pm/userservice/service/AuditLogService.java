package com.pm.userservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pm.userservice.dto.AuditLogCreateRequestDTO;
import com.pm.userservice.dto.AuditLogEntryDTO;
import com.pm.userservice.dto.AuditLogMessagePartDTO;
import com.pm.userservice.dto.PagedResponseDTO;
import com.pm.userservice.model.AuditLogEntry;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.AuditLogEntryRepository;
import com.pm.userservice.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class AuditLogService {
    private static final TypeReference<List<AuditLogMessagePartDTO>> MESSAGE_PARTS_TYPE = new TypeReference<>() {};

    private final AuditLogEntryRepository auditLogEntryRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public AuditLogService(
            AuditLogEntryRepository auditLogEntryRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper
    ) {
        this(auditLogEntryRepository, userRepository, objectMapper, Clock.systemUTC());
    }

    AuditLogService(
            AuditLogEntryRepository auditLogEntryRepository,
            UserRepository userRepository,
            ObjectMapper objectMapper,
            Clock clock
    ) {
        this.auditLogEntryRepository = auditLogEntryRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Transactional
    public AuditLogEntryDTO record(UUID companyId, UUID actorUserId, AuditLogCreateRequestDTO request) {
        User actor = actorUserId == null ? null : userRepository.findByUserIdAndCompanyId(actorUserId, companyId).orElse(null);
        String actorDisplayName = actor == null ? "System" : displayName(actor);

        List<AuditLogMessagePartDTO> normalizedParts = normalizeMessageParts(companyId, actorDisplayName, actorUserId, request.getMessageParts());

        AuditLogEntry entry = new AuditLogEntry();
        entry.setId(UUID.randomUUID());
        entry.setCompanyId(companyId);
        entry.setOccurredAt(OffsetDateTime.now(clock));
        entry.setCategory(normalizeRequired(request.getCategory(), "GENERAL"));
        entry.setAction(normalizeRequired(request.getAction(), "UPDATED"));
        entry.setEntityType(normalizeRequired(request.getEntityType(), "GENERAL"));
        entry.setEntityId(blankToNull(request.getEntityId()));
        entry.setActorUserId(actorUserId);
        entry.setActorDisplayName(actorDisplayName);
        entry.setSummary(toSummary(normalizedParts));
        entry.setMessagePartsJson(writeMessageParts(normalizedParts));
        return toDto(auditLogEntryRepository.save(entry), normalizedParts);
    }

    @Transactional(readOnly = true)
    public PagedResponseDTO<AuditLogEntryDTO> list(
            UUID companyId,
            String category,
            String action,
            String entityType,
            UUID actorUserId,
            LocalDate occurredFrom,
            LocalDate occurredTo,
            String query,
            int page,
            int size
    ) {
        String normalizedQuery = blankToNull(query);
        OffsetDateTime occurredFromOffset = occurredFrom == null ? null : occurredFrom.atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime occurredToOffset = occurredTo == null ? null : occurredTo.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);
        PageRequest pageRequest = PageRequest.of(page, size);

        return PagedResponseDTO.from(
                hasFilters(category, action, entityType, actorUserId, occurredFromOffset, occurredToOffset, normalizedQuery)
                        ? auditLogEntryRepository.findAll(
                                filters(
                                        companyId,
                                        blankToNull(category),
                                        blankToNull(action),
                                        blankToNull(entityType),
                                        actorUserId,
                                        occurredFromOffset,
                                        occurredToOffset,
                                        normalizedQuery
                                ),
                                pageRequest.withSort(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "occurredAt"))
                        )
                        : auditLogEntryRepository.findAllByCompanyIdOrderByOccurredAtDesc(companyId, pageRequest),
                this::toDto
        );
    }

    private static boolean hasFilters(
            String category,
            String action,
            String entityType,
            UUID actorUserId,
            OffsetDateTime occurredFrom,
            OffsetDateTime occurredTo,
            String query
    ) {
        return blankToNull(category) != null
                || blankToNull(action) != null
                || blankToNull(entityType) != null
                || actorUserId != null
                || occurredFrom != null
                || occurredTo != null
                || query != null;
    }

    private static Specification<AuditLogEntry> filters(
            UUID companyId,
            String category,
            String action,
            String entityType,
            UUID actorUserId,
            OffsetDateTime occurredFrom,
            OffsetDateTime occurredTo,
            String query
    ) {
        return companyEquals(companyId)
                .and(equalsIfPresent("category", category))
                .and(equalsIfPresent("action", action))
                .and(equalsIfPresent("entityType", entityType))
                .and(equalsIfPresent("actorUserId", actorUserId))
                .and(greaterThanOrEqualToIfPresent("occurredAt", occurredFrom))
                .and(lessThanOrEqualToIfPresent("occurredAt", occurredTo))
                .and(summaryContains(query));
    }

    private static Specification<AuditLogEntry> companyEquals(UUID companyId) {
        return (root, criteriaQuery, criteriaBuilder) -> criteriaBuilder.equal(root.get("companyId"), companyId);
    }

    private static <T> Specification<AuditLogEntry> equalsIfPresent(String fieldName, T value) {
        if (value == null) {
            return null;
        }
        return (root, criteriaQuery, criteriaBuilder) -> criteriaBuilder.equal(root.get(fieldName), value);
    }

    private static Specification<AuditLogEntry> greaterThanOrEqualToIfPresent(String fieldName, OffsetDateTime value) {
        if (value == null) {
            return null;
        }
        return (root, criteriaQuery, criteriaBuilder) -> criteriaBuilder.greaterThanOrEqualTo(root.get(fieldName), value);
    }

    private static Specification<AuditLogEntry> lessThanOrEqualToIfPresent(String fieldName, OffsetDateTime value) {
        if (value == null) {
            return null;
        }
        return (root, criteriaQuery, criteriaBuilder) -> criteriaBuilder.lessThanOrEqualTo(root.get(fieldName), value);
    }

    private static Specification<AuditLogEntry> summaryContains(String query) {
        if (query == null) {
            return null;
        }
        return (root, criteriaQuery, criteriaBuilder) ->
                criteriaBuilder.like(criteriaBuilder.lower(root.get("summary")), "%" + query.toLowerCase() + "%");
    }

    private AuditLogEntryDTO toDto(AuditLogEntry entry) {
        return toDto(entry, readMessageParts(entry.getMessagePartsJson()));
    }

    private AuditLogEntryDTO toDto(AuditLogEntry entry, List<AuditLogMessagePartDTO> messageParts) {
        AuditLogEntryDTO dto = new AuditLogEntryDTO();
        dto.setEntryId(entry.getId().toString());
        dto.setCompanyId(entry.getCompanyId().toString());
        dto.setOccurredAt(entry.getOccurredAt().toString());
        dto.setCategory(entry.getCategory());
        dto.setAction(entry.getAction());
        dto.setEntityType(entry.getEntityType());
        dto.setEntityId(entry.getEntityId());
        dto.setActorUserId(entry.getActorUserId() == null ? null : entry.getActorUserId().toString());
        dto.setActorDisplayName(entry.getActorDisplayName());
        dto.setSummary(entry.getSummary());
        dto.setMessageParts(messageParts);
        return dto;
    }

    private List<AuditLogMessagePartDTO> normalizeMessageParts(
            UUID companyId,
            String actorDisplayName,
            UUID actorUserId,
            List<AuditLogMessagePartDTO> rawParts
    ) {
        List<AuditLogMessagePartDTO> normalized = new ArrayList<>();
        normalized.add(linkPart("USER", actorUserId == null ? null : actorUserId.toString(), actorDisplayName, actorUserId == null ? null : "/management/users/" + actorUserId));

        if (rawParts == null) {
            return normalized;
        }

        Map<UUID, String> userLabels = userRepository.findByUserIdIn(
                        rawParts.stream()
                                .filter(part -> "LINK".equalsIgnoreCase(part.getType()))
                                .filter(part -> "USER".equalsIgnoreCase(part.getEntityType()))
                                .map(AuditLogMessagePartDTO::getEntityId)
                                .map(AuditLogService::toUuid)
                                .filter(Objects::nonNull)
                                .distinct()
                                .toList()
                ).stream()
                .filter(user -> companyId.equals(user.getCompanyId()))
                .sorted(Comparator.comparing(User::getUserId))
                .collect(Collectors.toMap(User::getUserId, this::displayName, (left, right) -> left));

        for (AuditLogMessagePartDTO part : rawParts) {
            if (part == null) {
                continue;
            }
            if ("TEXT".equalsIgnoreCase(part.getType())) {
                String text = blankToNull(part.getText());
                if (text != null) {
                    AuditLogMessagePartDTO normalizedPart = new AuditLogMessagePartDTO();
                    normalizedPart.setType("TEXT");
                    normalizedPart.setText(text);
                    normalized.add(normalizedPart);
                }
                continue;
            }
            if ("LINK".equalsIgnoreCase(part.getType())) {
                AuditLogMessagePartDTO normalizedPart = new AuditLogMessagePartDTO();
                normalizedPart.setType("LINK");
                normalizedPart.setEntityType(blankToNull(part.getEntityType()));
                normalizedPart.setEntityId(blankToNull(part.getEntityId()));
                normalizedPart.setRoute(blankToNull(part.getRoute()));
                normalizedPart.setLabel(resolveLinkLabel(part, userLabels));
                normalized.add(normalizedPart);
            }
        }
        return normalized;
    }

    private String resolveLinkLabel(AuditLogMessagePartDTO part, Map<UUID, String> userLabels) {
        String explicit = blankToNull(part.getLabel());
        if (explicit != null) {
            return explicit;
        }
        if ("USER".equalsIgnoreCase(part.getEntityType())) {
            UUID userId = toUuid(part.getEntityId());
            if (userId != null && userLabels.containsKey(userId)) {
                return userLabels.get(userId);
            }
        }
        if (part.getEntityId() != null && part.getEntityType() != null) {
            return part.getEntityType().toLowerCase() + " " + part.getEntityId();
        }
        return "record";
    }

    private List<AuditLogMessagePartDTO> readMessageParts(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, MESSAGE_PARTS_TYPE);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not read audit log message parts", ex);
        }
    }

    private String writeMessageParts(List<AuditLogMessagePartDTO> parts) {
        try {
            return objectMapper.writeValueAsString(parts);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not write audit log message parts", ex);
        }
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

    private String toSummary(List<AuditLogMessagePartDTO> parts) {
        return parts.stream()
                .map(part -> "TEXT".equalsIgnoreCase(part.getType()) ? part.getText() : part.getLabel())
                .filter(Objects::nonNull)
                .collect(Collectors.joining())
                .trim();
    }

    private String displayName(User user) {
        String preferred = blankToNull(user.getPreferredName());
        if (preferred != null) {
            return preferred;
        }
        String combined = List.of(
                        blankToNull(user.getFirstNames()),
                        blankToNull(user.getMiddleNamePrefix()),
                        blankToNull(user.getLastName())
                ).stream()
                .filter(Objects::nonNull)
                .collect(Collectors.joining(" "))
                .trim();
        return combined.isBlank() ? user.getEmail() : combined;
    }

    private static UUID toUuid(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return UUID.fromString(value);
    }

    private static String normalizeRequired(String value, String fallback) {
        String normalized = blankToNull(value);
        return normalized == null ? fallback : normalized.trim().toUpperCase();
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
