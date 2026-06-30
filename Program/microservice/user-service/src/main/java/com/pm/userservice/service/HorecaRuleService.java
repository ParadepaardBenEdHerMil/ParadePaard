package com.pm.userservice.service;

import com.pm.userservice.dto.HorecaJobPresetConfigDTO;
import com.pm.userservice.dto.HorecaJobPresetUpdateDTO;
import com.pm.userservice.dto.HorecaRuleItemDTO;
import com.pm.userservice.dto.HorecaRulePublishRequestDTO;
import com.pm.userservice.dto.HorecaRuleSectionUpdateDTO;
import com.pm.userservice.dto.HorecaRuleVersionDTO;
import com.pm.userservice.dto.AuditLogCreateRequestDTO;
import com.pm.userservice.dto.AuditLogMessagePartDTO;
import com.pm.userservice.integration.ContractServiceClient;
import com.pm.userservice.integration.RuleReplacementContractRequestDTO;
import com.pm.userservice.model.HorecaJobPresetConfig;
import com.pm.userservice.model.HorecaRuleItem;
import com.pm.userservice.model.HorecaRuleSection;
import com.pm.userservice.model.HorecaRuleValueType;
import com.pm.userservice.model.HorecaRuleVersion;
import com.pm.userservice.model.HorecaRuleVersionStatus;
import com.pm.userservice.model.User;
import com.pm.userservice.model.UserStatus;
import com.pm.userservice.repository.HorecaJobPresetConfigRepository;
import com.pm.userservice.repository.HorecaRuleItemRepository;
import com.pm.userservice.repository.HorecaRuleVersionRepository;
import com.pm.userservice.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.Period;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class HorecaRuleService {

    private static final Set<String> CONTRACT_AFFECTING_ITEM_KEYS = Set.of(
            "holidayAllowancePercentage",
            "collectiveAgreementName",
            "pensionSchemeName"
    );

    private final HorecaRuleVersionRepository versionRepository;
    private final HorecaRuleItemRepository itemRepository;
    private final HorecaJobPresetConfigRepository jobPresetRepository;
    private final UserRepository userRepository;
    private final ContractServiceClient contractServiceClient;
    @Autowired(required = false)
    private AuditLogService auditLogService;

    public HorecaRuleService(
            HorecaRuleVersionRepository versionRepository,
            HorecaRuleItemRepository itemRepository,
            HorecaJobPresetConfigRepository jobPresetRepository,
            UserRepository userRepository,
            ContractServiceClient contractServiceClient
    ) {
        this.versionRepository = versionRepository;
        this.itemRepository = itemRepository;
        this.jobPresetRepository = jobPresetRepository;
        this.userRepository = userRepository;
        this.contractServiceClient = contractServiceClient;
    }

    @Transactional
    public HorecaRuleVersionDTO getCurrentRules(UUID companyId) {
        HorecaRuleVersion version = ensureCurrentVersion(companyId);
        return toDto(version);
    }

    @Transactional
    public HorecaRuleVersionDTO updateSection(
            UUID companyId,
            UUID userId,
            HorecaRuleSection section,
            HorecaRuleSectionUpdateDTO update
    ) {
        HorecaRuleVersion draft = loadOrCreateDraft(companyId, userId);
        itemRepository.deleteByRuleVersionIdAndSectionKey(draft.getId(), section);
        itemRepository.saveAll(
                update.getItems().stream()
                        .sorted(Comparator.comparingInt(HorecaRuleItemDTO::getSortOrder))
                        .map(item -> toEntity(draft.getId(), section, item))
                        .toList()
        );
        recordAudit(
                companyId,
                userId,
                "RULES",
                "UPDATED",
                "HORECA_RULE_SECTION",
                draft.getId().toString(),
                List.of(
                        textPart(" updated "),
                        linkPart("HORECA_RULE_SECTION", draft.getId().toString(), sectionTitle(section), "/management/horeca-payroll-rules"),
                        textPart(" draft on "),
                        linkPart("HORECA_RULES", draft.getId().toString(), "Horeca Payroll and Contract Rules", "/management/horeca-payroll-rules")
                )
        );
        return toDto(draft);
    }

    @Transactional
    public HorecaRuleVersionDTO updateJobPresets(UUID companyId, UUID userId, HorecaJobPresetUpdateDTO update) {
        HorecaRuleVersion draft = loadOrCreateDraft(companyId, userId);
        jobPresetRepository.deleteByRuleVersionId(draft.getId());
        jobPresetRepository.saveAll(
                update.getJobPresets().stream()
                        .sorted(Comparator.comparingInt(HorecaJobPresetConfigDTO::getSortOrder))
                        .map(item -> toEntity(draft.getId(), item))
                        .toList()
        );
        recordAudit(
                companyId,
                userId,
                "RULES",
                "UPDATED",
                "JOB_PRESET",
                draft.getId().toString(),
                List.of(
                        textPart(" updated "),
                        linkPart("JOB_PRESET", draft.getId().toString(), "job presets", "/management/horeca-payroll-rules"),
                        textPart(" on "),
                        linkPart("HORECA_RULES", draft.getId().toString(), "Horeca Payroll and Contract Rules", "/management/horeca-payroll-rules")
                )
        );
        return toDto(draft);
    }

    @Transactional
    public HorecaRuleVersionDTO publishCurrentDraft(
            UUID companyId,
            UUID userId,
            HorecaRulePublishRequestDTO request,
            String accessToken
    ) {
        HorecaRuleVersion draft = versionRepository.findTopByCompanyIdAndStatusOrderByCreatedAtDesc(
                        companyId,
                        HorecaRuleVersionStatus.DRAFT
                )
                .orElseThrow(() -> new IllegalStateException("No horeca draft version exists for this company."));
        Optional<HorecaRuleVersion> previousPublished = versionRepository.findTopByCompanyIdAndStatusOrderByPublishedAtDesc(
                companyId,
                HorecaRuleVersionStatus.PUBLISHED
        );
        LocalDate effectiveFrom = LocalDate.parse(request.getEffectiveFrom());

        previousPublished.ifPresent(previous -> {
            if (previous.getId().equals(draft.getId())) {
                return;
            }
            LocalDate currentEffectiveFrom = previous.getEffectiveFrom();
            if (currentEffectiveFrom != null && !effectiveFrom.isAfter(currentEffectiveFrom)) {
                throw new IllegalArgumentException(
                        "The new horeca rule version must start after the current published version start date."
                );
            }
        });

        draft.setStatus(HorecaRuleVersionStatus.PUBLISHED);
        draft.setEffectiveFrom(effectiveFrom);
        draft.setEffectiveTo(null);
        draft.setVersionLabel(blankToDefault(request.getVersionLabel(), "Horeca rules " + effectiveFrom));
        draft.setReason(blankToNull(request.getReason()));
        draft.setPublishedAt(OffsetDateTime.now());
        draft.setPublishedByUserId(userId);
        versionRepository.save(draft);

        previousPublished.ifPresent(previous -> {
            if (!previous.getId().equals(draft.getId())) {
                previous.setStatus(HorecaRuleVersionStatus.SUPERSEDED);
                previous.setEffectiveTo(effectiveFrom.minusDays(1));
                versionRepository.save(previous);
            }
        });

        List<HorecaRuleItem> previousItems = previousPublished
                .map(version -> itemRepository.findAllByRuleVersionIdOrderBySectionKeyAscSortOrderAsc(version.getId()))
                .orElseGet(List::of);
        List<HorecaRuleItem> draftItems = itemRepository.findAllByRuleVersionIdOrderBySectionKeyAscSortOrderAsc(draft.getId());

        if (requiresContractReplacement(previousItems, draftItems)) {
            Map<String, HorecaRuleItem> draftItemByKey = draftItems.stream()
                    .collect(Collectors.toMap(HorecaRuleItem::getItemKey, item -> item, (left, right) -> right));
            for (User user : userRepository.findAllByCompanyId(companyId)) {
                if (user.getStatus() != UserStatus.ACTIVE) {
                    continue;
                }
                RuleReplacementContractRequestDTO replacement = new RuleReplacementContractRequestDTO();
                replacement.setUserId(user.getUserId().toString());
                replacement.setEffectiveFrom(effectiveFrom.toString());
                replacement.setRuleVersionId(draft.getId().toString());
                replacement.setGrossHourlyWage(resolveReplacementGrossHourlyWage(user, draftItemByKey, effectiveFrom));
                replacement.setHolidayAllowancePercentage(numberValue(draftItemByKey.get("holidayAllowancePercentage")));
                replacement.setCollectiveAgreement(textValue(draftItemByKey.get("collectiveAgreementName")));
                replacement.setPensionScheme(textValue(draftItemByKey.get("pensionSchemeName")));
                contractServiceClient.createRuleReplacementDraft(replacement, accessToken);
            }
        }

        recordAudit(
                companyId,
                userId,
                "RULES",
                "PUBLISHED",
                "HORECA_RULE_VERSION",
                draft.getId().toString(),
                List.of(
                        textPart(" published "),
                        linkPart("HORECA_RULE_VERSION", draft.getId().toString(), draft.getVersionLabel(), "/management/horeca-payroll-rules"),
                        textPart(" effective "),
                        textPart(effectiveFrom.toString())
                )
        );
        return toDto(draft);
    }

    private void recordAudit(
            UUID companyId,
            UUID actorUserId,
            String category,
            String action,
            String entityType,
            String entityId,
            List<AuditLogMessagePartDTO> messageParts
    ) {
        if (auditLogService == null) {
            return;
        }
        AuditLogCreateRequestDTO request = new AuditLogCreateRequestDTO();
        request.setCategory(category);
        request.setAction(action);
        request.setEntityType(entityType);
        request.setEntityId(entityId);
        request.setMessageParts(messageParts);
        auditLogService.record(companyId, actorUserId, request);
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

    private static String sectionTitle(HorecaRuleSection section) {
        return switch (section) {
            case WAGE_RULES -> "wage rules";
            case TAX_AND_PAYROLL_RULES -> "tax and payroll rules";
            case PENSION_RULES -> "pension rules";
            case HOLIDAY_AND_TRAVEL_RULES -> "holiday and travel rules";
        };
    }

    private HorecaRuleVersion ensureCurrentVersion(UUID companyId) {
        Optional<HorecaRuleVersion> draft = versionRepository.findTopByCompanyIdAndStatusOrderByCreatedAtDesc(
                companyId,
                HorecaRuleVersionStatus.DRAFT
        );
        if (draft.isPresent()) {
            return draft.get();
        }

        return versionRepository.findTopByCompanyIdAndStatusOrderByPublishedAtDesc(companyId, HorecaRuleVersionStatus.PUBLISHED)
                .orElseGet(() -> bootstrapPublishedVersion(companyId));
    }

    private HorecaRuleVersion loadOrCreateDraft(UUID companyId, UUID userId) {
        Optional<HorecaRuleVersion> existingDraft = versionRepository.findTopByCompanyIdAndStatusOrderByCreatedAtDesc(
                companyId,
                HorecaRuleVersionStatus.DRAFT
        );
        if (existingDraft.isPresent()) {
            return existingDraft.get();
        }

        HorecaRuleVersion base = ensureCurrentVersion(companyId);
        HorecaRuleVersion draft = new HorecaRuleVersion();
        draft.setId(UUID.randomUUID());
        draft.setCompanyId(companyId);
        draft.setVersionLabel(base.getVersionLabel() + " draft");
        draft.setStatus(HorecaRuleVersionStatus.DRAFT);
        draft.setReason(base.getReason());
        draft.setSourceSummary(base.getSourceSummary());
        draft.setCreatedByUserId(userId);
        draft.setCreatedAt(OffsetDateTime.now());
        draft = versionRepository.save(draft);
        UUID draftId = draft.getId();

        List<HorecaRuleItem> copiedItems = itemRepository.findAllByRuleVersionIdOrderBySectionKeyAscSortOrderAsc(base.getId()).stream()
                .map(item -> copyItem(item, draftId))
                .toList();
        itemRepository.saveAll(copiedItems);

        List<HorecaJobPresetConfig> copiedPresets = jobPresetRepository.findAllByRuleVersionIdOrderBySortOrderAsc(base.getId()).stream()
                .map(preset -> copyPreset(preset, draftId))
                .toList();
        jobPresetRepository.saveAll(copiedPresets);
        return draft;
    }

    private HorecaRuleVersion bootstrapPublishedVersion(UUID companyId) {
        HorecaRuleVersion version = new HorecaRuleVersion();
        version.setId(UUID.randomUUID());
        version.setCompanyId(companyId);
        version.setVersionLabel("Horeca CAO 2025 2026");
        version.setStatus(HorecaRuleVersionStatus.PUBLISHED);
        version.setEffectiveFrom(LocalDate.of(2025, 1, 1));
        version.setReason("Initial seeded horeca rule version.");
        version.setSourceSummary("Seeded from current horeca CAO, wage table, Belastingdienst, and pension sources.");
        version.setCreatedAt(OffsetDateTime.now());
        version.setPublishedAt(OffsetDateTime.now());
        version = versionRepository.save(version);

        itemRepository.saveAll(defaultItems(version.getId()));
        jobPresetRepository.saveAll(defaultPresets(version.getId()));
        return version;
    }

    private HorecaRuleVersionDTO toDto(HorecaRuleVersion version) {
        HorecaRuleVersionDTO dto = new HorecaRuleVersionDTO();
        dto.setVersionId(version.getId().toString());
        dto.setCompanyId(version.getCompanyId().toString());
        dto.setVersionLabel(version.getVersionLabel());
        dto.setStatus(version.getStatus().name());
        dto.setEffectiveFrom(version.getEffectiveFrom() == null ? null : version.getEffectiveFrom().toString());
        dto.setEffectiveTo(version.getEffectiveTo() == null ? null : version.getEffectiveTo().toString());
        dto.setReason(version.getReason());
        dto.setSourceSummary(version.getSourceSummary());
        dto.setPublishedAt(version.getPublishedAt() == null ? null : version.getPublishedAt().toString());
        dto.setPublishedByUserId(version.getPublishedByUserId() == null ? null : version.getPublishedByUserId().toString());

        Map<String, List<HorecaRuleItemDTO>> sections = new LinkedHashMap<>();
        for (HorecaRuleSection section : HorecaRuleSection.values()) {
            sections.put(section.name(), new ArrayList<>());
        }
        for (HorecaRuleItem item : itemRepository.findAllByRuleVersionIdOrderBySectionKeyAscSortOrderAsc(version.getId())) {
            sections.computeIfAbsent(item.getSectionKey().name(), ignored -> new ArrayList<>()).add(toDto(item));
        }
        dto.setSections(sections);
        dto.setJobPresets(
                jobPresetRepository.findAllByRuleVersionIdOrderBySortOrderAsc(version.getId()).stream()
                        .map(this::toDto)
                        .toList()
        );
        return dto;
    }

    private HorecaRuleItemDTO toDto(HorecaRuleItem item) {
        HorecaRuleItemDTO dto = new HorecaRuleItemDTO();
        dto.setId(item.getId().toString());
        dto.setSectionKey(item.getSectionKey().name());
        dto.setItemKey(item.getItemKey());
        dto.setName(item.getName());
        dto.setValueText(item.getValueText());
        dto.setValueNumber(item.getValueNumber());
        dto.setValueBoolean(item.getValueBoolean());
        dto.setValueType(item.getValueType().name());
        dto.setUnit(item.getUnit());
        dto.setCalculationRule(item.getCalculationRule());
        dto.setDocumentName(item.getDocumentName());
        dto.setDocumentUrl(item.getDocumentUrl());
        dto.setPageReference(item.getPageReference());
        dto.setFunctionGroup(item.getFunctionGroup());
        dto.setAgeGroup(item.getAgeGroup());
        dto.setSourceNote(item.getSourceNote());
        dto.setUsedInContract(item.isUsedInContract());
        dto.setUsedInPayroll(item.isUsedInPayroll());
        dto.setSortOrder(item.getSortOrder());
        return dto;
    }

    private HorecaJobPresetConfigDTO toDto(HorecaJobPresetConfig item) {
        HorecaJobPresetConfigDTO dto = new HorecaJobPresetConfigDTO();
        dto.setId(item.getId().toString());
        dto.setPresetKey(item.getPresetKey());
        dto.setPresetName(item.getPresetName());
        dto.setJobTitle(item.getJobTitle());
        dto.setJobFunction(item.getJobFunction());
        dto.setFunctionGroup(item.getFunctionGroup());
        dto.setDefaultContractType(item.getDefaultContractType());
        dto.setDefaultHourlyWage(item.getDefaultHourlyWage());
        dto.setDefaultMonthlyWage(item.getDefaultMonthlyWage());
        dto.setDefaultHoursPerWeek(item.getDefaultHoursPerWeek());
        dto.setDefaultPayrollPeriod(item.getDefaultPayrollPeriod());
        dto.setPensionApplicable(item.isPensionApplicable());
        dto.setHolidayAllowanceMode(item.getHolidayAllowanceMode());
        dto.setVacationBuildUpApplicable(item.isVacationBuildUpApplicable());
        dto.setDocumentName(item.getDocumentName());
        dto.setDocumentUrl(item.getDocumentUrl());
        dto.setPageReference(item.getPageReference());
        dto.setSourceNote(item.getSourceNote());
        dto.setActive(item.isActive());
        dto.setAdminNotes(item.getAdminNotes());
        dto.setSortOrder(item.getSortOrder());
        return dto;
    }

    private HorecaRuleItem toEntity(UUID versionId, HorecaRuleSection section, HorecaRuleItemDTO dto) {
        HorecaRuleItem item = new HorecaRuleItem();
        item.setId(dto.getId() == null || dto.getId().isBlank() ? UUID.randomUUID() : UUID.fromString(dto.getId()));
        item.setRuleVersionId(versionId);
        item.setSectionKey(section);
        item.setItemKey(dto.getItemKey());
        item.setName(dto.getName());
        item.setValueText(dto.getValueText());
        item.setValueNumber(dto.getValueNumber());
        item.setValueBoolean(dto.getValueBoolean());
        item.setValueType(dto.getValueType() == null ? HorecaRuleValueType.TEXT : HorecaRuleValueType.valueOf(dto.getValueType()));
        item.setUnit(dto.getUnit());
        item.setCalculationRule(dto.getCalculationRule());
        item.setDocumentName(dto.getDocumentName());
        item.setDocumentUrl(dto.getDocumentUrl());
        item.setPageReference(dto.getPageReference());
        item.setFunctionGroup(blankToNull(dto.getFunctionGroup()));
        item.setAgeGroup(blankToNull(dto.getAgeGroup()));
        item.setSourceNote(dto.getSourceNote());
        item.setUsedInContract(dto.isUsedInContract());
        item.setUsedInPayroll(dto.isUsedInPayroll());
        item.setSortOrder(dto.getSortOrder());
        return item;
    }

    private HorecaJobPresetConfig toEntity(UUID versionId, HorecaJobPresetConfigDTO dto) {
        HorecaJobPresetConfig item = new HorecaJobPresetConfig();
        item.setId(dto.getId() == null || dto.getId().isBlank() ? UUID.randomUUID() : UUID.fromString(dto.getId()));
        item.setRuleVersionId(versionId);
        item.setPresetKey(dto.getPresetKey());
        item.setPresetName(dto.getPresetName());
        item.setJobTitle(dto.getJobTitle());
        item.setJobFunction(dto.getJobFunction());
        item.setFunctionGroup(dto.getFunctionGroup());
        item.setDefaultContractType(dto.getDefaultContractType());
        item.setDefaultHourlyWage(dto.getDefaultHourlyWage());
        item.setDefaultMonthlyWage(dto.getDefaultMonthlyWage());
        item.setDefaultHoursPerWeek(dto.getDefaultHoursPerWeek());
        item.setDefaultPayrollPeriod(dto.getDefaultPayrollPeriod());
        item.setPensionApplicable(dto.isPensionApplicable());
        item.setHolidayAllowanceMode(dto.getHolidayAllowanceMode());
        item.setVacationBuildUpApplicable(dto.isVacationBuildUpApplicable());
        item.setDocumentName(dto.getDocumentName());
        item.setDocumentUrl(dto.getDocumentUrl());
        item.setPageReference(dto.getPageReference());
        item.setSourceNote(dto.getSourceNote());
        item.setActive(dto.isActive());
        item.setAdminNotes(dto.getAdminNotes());
        item.setSortOrder(dto.getSortOrder());
        return item;
    }

    private HorecaRuleItem copyItem(HorecaRuleItem source, UUID versionId) {
        HorecaRuleItem item = new HorecaRuleItem();
        item.setId(UUID.randomUUID());
        item.setRuleVersionId(versionId);
        item.setSectionKey(source.getSectionKey());
        item.setItemKey(source.getItemKey());
        item.setName(source.getName());
        item.setValueText(source.getValueText());
        item.setValueNumber(source.getValueNumber());
        item.setValueBoolean(source.getValueBoolean());
        item.setValueType(source.getValueType());
        item.setUnit(source.getUnit());
        item.setCalculationRule(source.getCalculationRule());
        item.setDocumentName(source.getDocumentName());
        item.setDocumentUrl(source.getDocumentUrl());
        item.setPageReference(source.getPageReference());
        item.setFunctionGroup(source.getFunctionGroup());
        item.setAgeGroup(source.getAgeGroup());
        item.setSourceNote(source.getSourceNote());
        item.setUsedInContract(source.isUsedInContract());
        item.setUsedInPayroll(source.isUsedInPayroll());
        item.setSortOrder(source.getSortOrder());
        return item;
    }

    private HorecaJobPresetConfig copyPreset(HorecaJobPresetConfig source, UUID versionId) {
        HorecaJobPresetConfig item = new HorecaJobPresetConfig();
        item.setId(UUID.randomUUID());
        item.setRuleVersionId(versionId);
        item.setPresetKey(source.getPresetKey());
        item.setPresetName(source.getPresetName());
        item.setJobTitle(source.getJobTitle());
        item.setJobFunction(source.getJobFunction());
        item.setFunctionGroup(source.getFunctionGroup());
        item.setDefaultContractType(source.getDefaultContractType());
        item.setDefaultHourlyWage(source.getDefaultHourlyWage());
        item.setDefaultMonthlyWage(source.getDefaultMonthlyWage());
        item.setDefaultHoursPerWeek(source.getDefaultHoursPerWeek());
        item.setDefaultPayrollPeriod(source.getDefaultPayrollPeriod());
        item.setPensionApplicable(source.isPensionApplicable());
        item.setHolidayAllowanceMode(source.getHolidayAllowanceMode());
        item.setVacationBuildUpApplicable(source.isVacationBuildUpApplicable());
        item.setDocumentName(source.getDocumentName());
        item.setDocumentUrl(source.getDocumentUrl());
        item.setPageReference(source.getPageReference());
        item.setSourceNote(source.getSourceNote());
        item.setActive(source.isActive());
        item.setAdminNotes(source.getAdminNotes());
        item.setSortOrder(source.getSortOrder());
        return item;
    }

    private boolean requiresContractReplacement(List<HorecaRuleItem> previousItems, List<HorecaRuleItem> draftItems) {
        Map<String, HorecaRuleItem> previousByKey = previousItems.stream()
                .collect(Collectors.toMap(HorecaRuleItem::getItemKey, item -> item, (left, right) -> right));
        for (HorecaRuleItem draftItem : draftItems) {
            if (!isContractAffectingItem(draftItem)) {
                continue;
            }
            HorecaRuleItem previous = previousByKey.get(draftItem.getItemKey());
            if (previous == null) {
                return true;
            }
            if (draftItem.getValueNumber() != null && previous.getValueNumber() != null) {
                if (draftItem.getValueNumber().compareTo(previous.getValueNumber()) != 0) {
                    return true;
                }
            } else if (!safeEquals(draftItem.getValueText(), previous.getValueText())) {
                return true;
            }
        }
        return false;
    }

    private boolean isContractAffectingItem(HorecaRuleItem item) {
        return item != null
                && (CONTRACT_AFFECTING_ITEM_KEYS.contains(item.getItemKey())
                || item.getSectionKey() == HorecaRuleSection.WAGE_RULES);
    }

    private BigDecimal resolveReplacementGrossHourlyWage(
            User user,
            Map<String, HorecaRuleItem> draftItemByKey,
            LocalDate effectiveFrom
    ) {
        if (user == null || user.getDateOfBirth() == null || draftItemByKey == null || effectiveFrom == null) {
            return null;
        }

        int age = Period.between(user.getDateOfBirth(), effectiveFrom).getYears();
        String wageItemKey = switch (age) {
            case 15 -> "age15FunctionGroupI_IIHourlyWage";
            case 16 -> "age16FunctionGroupI_IIHourlyWage";
            case 17 -> "age17FunctionGroupI_IIHourlyWage";
            case 18 -> "age18FunctionGroupI_IIHourlyWage";
            case 19 -> "age19FunctionGroupI_IIHourlyWage";
            case 20 -> "age20FunctionGroupI_IIHourlyWage";
            default -> age >= 21 ? "adultFunctionGroupI_IIHourlyWage" : null;
        };
        return wageItemKey == null ? null : numberValue(draftItemByKey.get(wageItemKey));
    }

    private List<HorecaRuleItem> defaultItems(UUID versionId) {
        List<HorecaRuleItem> items = new ArrayList<>();
        items.add(defaultNumberItem(versionId, HorecaRuleSection.HOLIDAY_AND_TRAVEL_RULES, "holidayAllowancePercentage", "Holiday allowance", "percent", "Gross wage x 8%.", "Horeca cao 2025 2026", "https://static2.khn.nl/public/images/downloads/Horeca-cao-2025-2026_2024-12-30-142048_kgjp.pdf", "32", "The CAO gives employees the right to 8 percent holiday allowance.", true, true, 1, new BigDecimal("8.00")));
        items.add(defaultTextItem(versionId, HorecaRuleSection.HOLIDAY_AND_TRAVEL_RULES, "holidayAllowanceMode", "Holiday allowance mode", "reserved", "Reserved per payroll period.", "Horeca cao 2025 2026", "https://static2.khn.nl/public/images/downloads/Horeca-cao-2025-2026_2024-12-30-142048_kgjp.pdf", "32", "Default horeca onboarding rule for reserved holiday allowance.", true, true, 2));
        items.add(defaultNumberItem(versionId, HorecaRuleSection.HOLIDAY_AND_TRAVEL_RULES, "vacationBuildUpPerPaidHour", "Vacation buildup", "vacation hour per paid hour", "Paid hours x 0.0961.", "Horeca cao 2025 2026", "https://static2.khn.nl/public/images/downloads/Horeca-cao-2025-2026_2024-12-30-142048_kgjp.pdf", "23", "0.0769 legal vacation hour plus 0.0192 extra vacation hour per paid hour.", true, true, 3, new BigDecimal("0.0961")));
        items.add(defaultNumberItem(versionId, HorecaRuleSection.HOLIDAY_AND_TRAVEL_RULES, "vacationDayBuildUpPerWorkedHour", "Vacation day buildup", "vacation hour per worked hour", "Worked hours x 0.0961.", "Horeca cao 2025 2026", "https://static2.khn.nl/public/images/downloads/Horeca-cao-2025-2026_2024-12-30-142048_kgjp.pdf", "23", "Displayed as the vacation-hours-per-worked-hour rule used in onboarding.", true, true, 4, new BigDecimal("0.0961")));
        items.add(defaultNumberItem(versionId, HorecaRuleSection.HOLIDAY_AND_TRAVEL_RULES, "travelAllowancePerKilometer", "Travel allowance rate", "EUR per km", "Temporary shared horeca rule used for onboarding and travel claim estimates.", "Horeca cao 2025 2026", "https://static2.khn.nl/public/images/downloads/Horeca-cao-2025-2026_2024-12-30-142048_kgjp.pdf", "32", "Temporary shared horeca rule used for onboarding and travel claim estimates.", false, true, 5, new BigDecimal("0.23")));
        items.add(defaultTextItem(versionId, HorecaRuleSection.HOLIDAY_AND_TRAVEL_RULES, "collectiveAgreementName", "Collective agreement", "Horeca CAO 2025 2026", "Current horeca collective agreement reference.", "Horeca cao 2025 2026", "https://static2.khn.nl/public/images/downloads/Horeca-cao-2025-2026_2024-12-30-142048_kgjp.pdf", "12", "Current horeca collective agreement reference.", true, false, 6));
        items.add(defaultWageItem(versionId, "adultFunctionGroupI_IIHourlyWage", "Adult function group I+II hourly wage", "Adult", "I+II", 1, "Adult horeca hourly wage for function group I+II.", new BigDecimal("14.71")));
        items.add(defaultWageItem(versionId, "age20FunctionGroupI_IIHourlyWage", "Age 20 function group I+II hourly wage", "20", "I+II", 2, "Horeca hourly wage for a 20-year-old employee in function group I+II.", new BigDecimal("12.50")));
        items.add(defaultWageItem(versionId, "age19FunctionGroupI_IIHourlyWage", "Age 19 function group I+II hourly wage", "19", "I+II", 3, "Horeca hourly wage for a 19-year-old employee in function group I+II.", new BigDecimal("11.03")));
        items.add(defaultWageItem(versionId, "age18FunctionGroupI_IIHourlyWage", "Age 18 function group I+II hourly wage", "18", "I+II", 4, "Horeca hourly wage for an 18-year-old employee in function group I+II.", new BigDecimal("9.56")));
        items.add(defaultWageItem(versionId, "age17FunctionGroupI_IIHourlyWage", "Age 17 function group I+II hourly wage", "17", "I+II", 5, "Horeca hourly wage for a 17-year-old employee in function group I+II.", new BigDecimal("8.09")));
        items.add(defaultWageItem(versionId, "age16FunctionGroupI_IIHourlyWage", "Age 16 function group I+II hourly wage", "16", "I+II", 6, "Horeca hourly wage for a 16-year-old employee in function group I+II.", new BigDecimal("6.62")));
        items.add(defaultWageItem(versionId, "age15FunctionGroupI_IIHourlyWage", "Age 15 function group I+II hourly wage", "15", "I+II", 7, "Horeca hourly wage for a 15-year-old employee in function group I+II.", new BigDecimal("5.15")));
        items.add(defaultNumberItem(versionId, HorecaRuleSection.TAX_AND_PAYROLL_RULES, "awfLowPercentage", "AWf low", "percent", "Employer premium percentage.", "Tarieven, bedragen en percentages loonheffingen vanaf 1 januari 2026", "https://download.belastingdienst.nl/belastingdienst/docs/bijlage-nieuwsbrief-loonheffingen-2026-lh2091b63fd.pdf", "10", "Low AWf premium percentage.", false, true, 1, new BigDecimal("2.74")));
        items.add(defaultNumberItem(versionId, HorecaRuleSection.TAX_AND_PAYROLL_RULES, "zvwEmployeePercentage", "Employee Zvw contribution", "percent", "Withheld only when the employee owes the Zvw contribution (special cases). Capped at the maximumbijdrageloon.", "Tarieven, bedragen en percentages loonheffingen vanaf 1 januari 2026", "https://download.belastingdienst.nl/belastingdienst/docs/bijlage-nieuwsbrief-loonheffingen-2026-lh2091b63fd.pdf", "13", "Inhouding bijdrage Zvw percentage for 2026.", true, true, 3, new BigDecimal("4.85")));
        items.add(defaultTextItem(versionId, HorecaRuleSection.TAX_AND_PAYROLL_RULES, "loonheffingTableSource", "Loonheffing wage-tax table", "Belastingdienst tijdvaktabellen 2026 (statutory)", "Loonbelasting/premie volksverzekeringen are computed from the national Belastingdienst brackets and heffingskortingen; identical for every employer and applied automatically in payroll.", "Handboek Loonheffingen 2026", "https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_mnd_nl_std_20260101.pdf", "Bijlage 1", "National wage-tax tables are statutory and maintained in payroll, not per company.", false, true, 4));
        items.add(defaultNumberItem(versionId, HorecaRuleSection.TAX_AND_PAYROLL_RULES, "monthlyPayrollTaxWithCreditExample", "Payroll tax with loonheffingskorting", "EUR", "Example monthly table wage withholding.", "Witte Maandloon tabel loonbelasting premie volksverzekeringen Nederland Standaard 2026", "https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_mnd_nl_std_20260101.pdf", "15", "Example monthly withholding with loonheffingskorting.", false, true, 2, new BigDecimal("160.50")));
        items.add(defaultTextItem(versionId, HorecaRuleSection.PENSION_RULES, "pensionSchemeName", "Pension scheme", "Pensioenfonds Horeca en Catering", "Default horeca pension scheme text.", "Pensioenpremie Pensioenfonds Horeca en Catering", "https://www.phenc.nl/werkgever/pensioen-bij-ons/pensioenadministratie/pensioenpremie", "Web page", "Default horeca pension scheme text.", true, true, 1));
        items.add(defaultNumberItem(versionId, HorecaRuleSection.PENSION_RULES, "pensionPremiumEmployee", "Employee pension premium", "percent", "Pension base x 8.4%.", "Pensioenpremie Pensioenfonds Horeca en Catering", "https://www.phenc.nl/werkgever/pensioen-bij-ons/pensioenadministratie/pensioenpremie", "Web page", "Employee part of the horeca pension premium.", true, true, 2, new BigDecimal("8.40")));
        items.add(defaultNumberItem(versionId, HorecaRuleSection.PENSION_RULES, "pensionPremiumEmployer", "Employer pension premium", "percent", "Pension base x 8.4%.", "Pensioenpremie Pensioenfonds Horeca en Catering", "https://www.phenc.nl/werkgever/pensioen-bij-ons/pensioenadministratie/pensioenpremie", "Web page", "Employer part of the horeca pension premium.", true, true, 3, new BigDecimal("8.40")));
        return items;
    }

    private List<HorecaJobPresetConfig> defaultPresets(UUID versionId) {
        List<HorecaJobPresetConfig> presets = new ArrayList<>();
        presets.add(defaultPreset(versionId, "bar-employee", "Bar employee", "Bar employee", "Bar service and guest support", "PART_TIME", new BigDecimal("14.71"), new BigDecimal("2422.25"), new BigDecimal("24"), 1));
        presets.add(defaultPreset(versionId, "runner", "Runner", "Runner", "Floor support, clearing, serving support, and stock movement", "ZERO_HOURS", new BigDecimal("14.71"), new BigDecimal("2422.25"), BigDecimal.ZERO, 2));
        presets.add(defaultPreset(versionId, "waiter", "Waiter", "Waiter", "Guest service, ordering, serving, and section care", "PART_TIME", new BigDecimal("14.71"), new BigDecimal("2422.25"), new BigDecimal("24"), 3));
        return presets;
    }

    private HorecaRuleItem defaultNumberItem(
            UUID versionId,
            HorecaRuleSection section,
            String itemKey,
            String name,
            String unit,
            String calculationRule,
            String documentName,
            String documentUrl,
            String pageReference,
            String sourceNote,
            boolean usedInContract,
            boolean usedInPayroll,
            int sortOrder,
            BigDecimal value
    ) {
        HorecaRuleItem item = new HorecaRuleItem();
        item.setId(UUID.randomUUID());
        item.setRuleVersionId(versionId);
        item.setSectionKey(section);
        item.setItemKey(itemKey);
        item.setName(name);
        item.setValueNumber(value);
        item.setValueType(HorecaRuleValueType.NUMBER);
        item.setUnit(unit);
        item.setCalculationRule(calculationRule);
        item.setDocumentName(documentName);
        item.setDocumentUrl(documentUrl);
        item.setPageReference(pageReference);
        item.setSourceNote(sourceNote);
        item.setUsedInContract(usedInContract);
        item.setUsedInPayroll(usedInPayroll);
        item.setSortOrder(sortOrder);
        return item;
    }

    private HorecaRuleItem defaultWageItem(
            UUID versionId,
            String itemKey,
            String name,
            String ageGroup,
            String functionGroup,
            int sortOrder,
            String sourceNote,
            BigDecimal value
    ) {
        HorecaRuleItem item = defaultNumberItem(
                versionId,
                HorecaRuleSection.WAGE_RULES,
                itemKey,
                name,
                "EUR",
                "Monthly wage / 164.67.",
                "Loontabel per 1 januari 2026",
                "https://static2.khn.nl/public/images/downloads/Loontabel-per-1-januari-20261.pdf",
                "1",
                sourceNote,
                true,
                true,
                sortOrder,
                value
        );
        item.setAgeGroup(ageGroup);
        item.setFunctionGroup(functionGroup);
        return item;
    }

    private HorecaRuleItem defaultTextItem(
            UUID versionId,
            HorecaRuleSection section,
            String itemKey,
            String name,
            String value,
            String calculationRule,
            String documentName,
            String documentUrl,
            String pageReference,
            String sourceNote,
            boolean usedInContract,
            boolean usedInPayroll,
            int sortOrder
    ) {
        HorecaRuleItem item = new HorecaRuleItem();
        item.setId(UUID.randomUUID());
        item.setRuleVersionId(versionId);
        item.setSectionKey(section);
        item.setItemKey(itemKey);
        item.setName(name);
        item.setValueText(value);
        item.setValueType(HorecaRuleValueType.TEXT);
        item.setCalculationRule(calculationRule);
        item.setDocumentName(documentName);
        item.setDocumentUrl(documentUrl);
        item.setPageReference(pageReference);
        item.setSourceNote(sourceNote);
        item.setUsedInContract(usedInContract);
        item.setUsedInPayroll(usedInPayroll);
        item.setSortOrder(sortOrder);
        return item;
    }

    private HorecaJobPresetConfig defaultPreset(
            UUID versionId,
            String presetKey,
            String presetName,
            String jobTitle,
            String jobFunction,
            String contractType,
            BigDecimal hourlyWage,
            BigDecimal monthlyWage,
            BigDecimal hoursPerWeek,
            int sortOrder
    ) {
        HorecaJobPresetConfig item = new HorecaJobPresetConfig();
        item.setId(UUID.randomUUID());
        item.setRuleVersionId(versionId);
        item.setPresetKey(presetKey);
        item.setPresetName(presetName);
        item.setJobTitle(jobTitle);
        item.setJobFunction(jobFunction);
        item.setFunctionGroup("I+II");
        item.setDefaultContractType(contractType);
        item.setDefaultHourlyWage(hourlyWage);
        item.setDefaultMonthlyWage(monthlyWage);
        item.setDefaultHoursPerWeek(hoursPerWeek);
        item.setDefaultPayrollPeriod("MONTHLY");
        item.setPensionApplicable(true);
        item.setHolidayAllowanceMode("RESERVED");
        item.setVacationBuildUpApplicable(true);
        item.setDocumentName("Loontabel per 1 januari 2026");
        item.setDocumentUrl("https://static2.khn.nl/public/images/downloads/Loontabel-per-1-januari-20261.pdf");
        item.setPageReference("1");
        item.setSourceNote("Default horeca preset seeded from the current wage table.");
        item.setActive(true);
        item.setAdminNotes("");
        item.setSortOrder(sortOrder);
        return item;
    }

    private BigDecimal numberValue(HorecaRuleItem item) {
        return item == null ? null : item.getValueNumber();
    }

    private String textValue(HorecaRuleItem item) {
        return item == null ? null : item.getValueText();
    }

    private boolean safeEquals(String left, String right) {
        return left == null ? right == null : left.equals(right);
    }

    private String blankToDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
