package com.pm.userservice.service;

import com.pm.userservice.dto.HorecaJobPresetConfigDTO;
import com.pm.userservice.dto.HorecaRuleItemDTO;
import com.pm.userservice.dto.HorecaRulePublishRequestDTO;
import com.pm.userservice.dto.HorecaRuleSectionUpdateDTO;
import com.pm.userservice.dto.HorecaRuleVersionDTO;
import com.pm.userservice.integration.ContractServiceClient;
import com.pm.userservice.integration.RuleReplacementContractRequestDTO;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HorecaRuleServiceTest {

    @Mock
    private HorecaRuleVersionRepository versionRepository;
    @Mock
    private HorecaRuleItemRepository itemRepository;
    @Mock
    private HorecaJobPresetConfigRepository jobPresetRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ContractServiceClient contractServiceClient;

    @Test
    void getCurrentRulesBootstrapsThePublishedDefaultVersionWhenNoVersionExists() {
        UUID companyId = UUID.randomUUID();
        List<com.pm.userservice.model.HorecaRuleItem> storedItems = new ArrayList<>();
        List<com.pm.userservice.model.HorecaJobPresetConfig> storedPresets = new ArrayList<>();
        when(versionRepository.findTopByCompanyIdAndStatusOrderByPublishedAtDesc(companyId, HorecaRuleVersionStatus.PUBLISHED))
                .thenReturn(Optional.empty());
        when(versionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemRepository.saveAll(any())).thenAnswer(invocation -> {
            storedItems.clear();
            storedItems.addAll(invocation.getArgument(0));
            return invocation.getArgument(0);
        });
        when(jobPresetRepository.saveAll(any())).thenAnswer(invocation -> {
            storedPresets.clear();
            storedPresets.addAll(invocation.getArgument(0));
            return invocation.getArgument(0);
        });
        when(itemRepository.findAllByRuleVersionIdOrderBySectionKeyAscSortOrderAsc(any())).thenAnswer(invocation ->
                storedItems.stream()
                        .filter(item -> item.getRuleVersionId().equals(invocation.getArgument(0)))
                        .toList()
        );
        when(jobPresetRepository.findAllByRuleVersionIdOrderBySortOrderAsc(any())).thenAnswer(invocation ->
                storedPresets.stream()
                        .filter(item -> item.getRuleVersionId().equals(invocation.getArgument(0)))
                        .toList()
        );

        HorecaRuleVersionDTO current = horecaRuleService().getCurrentRules(companyId);

        assertThat(current.getStatus()).isEqualTo("PUBLISHED");
        assertThat(current.getSections()).containsKeys("HOLIDAY_AND_TRAVEL_RULES", "WAGE_RULES", "TAX_AND_PAYROLL_RULES", "PENSION_RULES");
        assertThat(current.getSections().get("HOLIDAY_AND_TRAVEL_RULES"))
                .extracting(HorecaRuleItemDTO::getItemKey)
                .contains(
                        "holidayAllowancePercentage",
                        "vacationBuildUpPerPaidHour",
                        "vacationDayBuildUpPerWorkedHour",
                        "travelAllowancePerKilometer"
                );
        assertThat(current.getSections().get("WAGE_RULES"))
                .extracting(HorecaRuleItemDTO::getItemKey)
                .containsExactly(
                        "adultFunctionGroupI_IIHourlyWage",
                        "age20FunctionGroupI_IIHourlyWage",
                        "age19FunctionGroupI_IIHourlyWage",
                        "age18FunctionGroupI_IIHourlyWage",
                        "age17FunctionGroupI_IIHourlyWage",
                        "age16FunctionGroupI_IIHourlyWage",
                        "age15FunctionGroupI_IIHourlyWage"
                );
        assertThat(current.getSections().get("WAGE_RULES").get(0).getAgeGroup()).isEqualTo("Adult");
        assertThat(current.getSections().get("WAGE_RULES").get(0).getFunctionGroup()).isEqualTo("I+II");
        assertThat(current.getJobPresets())
                .extracting(HorecaJobPresetConfigDTO::getPresetName)
                .contains("Bar employee", "Runner", "Waiter");
    }

    @Test
    void publishCurrentDraftCreatesForwardReplacementContractsForActiveEmployeesWhenContractFieldsChanged() {
        UUID companyId = UUID.randomUUID();
        UUID managerUserId = UUID.randomUUID();
        UUID publishedVersionId = UUID.randomUUID();
        UUID draftVersionId = UUID.randomUUID();
        UUID activeUserId = UUID.randomUUID();

        HorecaRuleVersion publishedVersion = HorecaRuleFixtures.publishedVersion(publishedVersionId, companyId, LocalDate.of(2026, 1, 1));
        HorecaRuleVersion draftVersion = HorecaRuleFixtures.draftVersion(draftVersionId, companyId);

        when(versionRepository.findTopByCompanyIdAndStatusOrderByCreatedAtDesc(companyId, HorecaRuleVersionStatus.DRAFT))
                .thenReturn(Optional.of(draftVersion));
        when(versionRepository.findTopByCompanyIdAndStatusOrderByPublishedAtDesc(companyId, HorecaRuleVersionStatus.PUBLISHED))
                .thenReturn(Optional.of(publishedVersion));
        when(itemRepository.findAllByRuleVersionIdOrderBySectionKeyAscSortOrderAsc(publishedVersionId))
                .thenReturn(List.of(
                        HorecaRuleFixtures.item(publishedVersionId, "HOLIDAY_AND_TRAVEL_RULES", "holidayAllowancePercentage", "Holiday allowance", new BigDecimal("8.00")),
                        HorecaRuleFixtures.item(publishedVersionId, "PENSION_RULES", "pensionSchemeName", "Pension scheme", "Pensioenfonds Horeca en Catering")
                ));
        when(itemRepository.findAllByRuleVersionIdOrderBySectionKeyAscSortOrderAsc(draftVersionId))
                .thenReturn(List.of(
                        HorecaRuleFixtures.item(draftVersionId, "HOLIDAY_AND_TRAVEL_RULES", "holidayAllowancePercentage", "Holiday allowance", new BigDecimal("8.50")),
                        HorecaRuleFixtures.item(draftVersionId, "PENSION_RULES", "pensionSchemeName", "Pension scheme", "Pensioenfonds Horeca en Catering")
                ));
        when(jobPresetRepository.findAllByRuleVersionIdOrderBySortOrderAsc(draftVersionId)).thenReturn(List.of());
        when(versionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        User activeUser = new User();
        activeUser.setUserId(activeUserId);
        activeUser.setCompanyId(companyId);
        activeUser.setStatus(UserStatus.ACTIVE);
        when(userRepository.findAllByCompanyId(companyId)).thenReturn(List.of(activeUser));

        HorecaRulePublishRequestDTO request = new HorecaRulePublishRequestDTO();
        request.setEffectiveFrom("2026-07-01");
        request.setReason("CAO update");
        request.setVersionLabel("Horeca July 2026");

        HorecaRuleVersionDTO published = horecaRuleService().publishCurrentDraft(companyId, managerUserId, request, "token");

        assertThat(published.getStatus()).isEqualTo("PUBLISHED");
        assertThat(published.getEffectiveFrom()).isEqualTo("2026-07-01");

        ArgumentCaptor<RuleReplacementContractRequestDTO> captor =
                ArgumentCaptor.forClass(RuleReplacementContractRequestDTO.class);
        verify(contractServiceClient, times(1)).createRuleReplacementDraft(captor.capture(), eq("token"));

        RuleReplacementContractRequestDTO replacement = captor.getValue();
        assertThat(replacement.getUserId()).isEqualTo(activeUserId.toString());
        assertThat(replacement.getEffectiveFrom()).isEqualTo("2026-07-01");
        assertThat(replacement.getRuleVersionId()).isEqualTo(draftVersionId.toString());
        assertThat(replacement.getHolidayAllowancePercentage()).isEqualByComparingTo("8.50");
    }

    @Test
    void publishCurrentDraftCreatesForwardReplacementContractsForActiveEmployeesWhenWageRulesChanged() {
        UUID companyId = UUID.randomUUID();
        UUID managerUserId = UUID.randomUUID();
        UUID publishedVersionId = UUID.randomUUID();
        UUID draftVersionId = UUID.randomUUID();
        UUID horecaUserId = UUID.randomUUID();
        UUID nonHorecaUserId = UUID.randomUUID();

        HorecaRuleVersion publishedVersion = HorecaRuleFixtures.publishedVersion(publishedVersionId, companyId, LocalDate.of(2026, 1, 1));
        HorecaRuleVersion draftVersion = HorecaRuleFixtures.draftVersion(draftVersionId, companyId);

        when(versionRepository.findTopByCompanyIdAndStatusOrderByCreatedAtDesc(companyId, HorecaRuleVersionStatus.DRAFT))
                .thenReturn(Optional.of(draftVersion));
        when(versionRepository.findTopByCompanyIdAndStatusOrderByPublishedAtDesc(companyId, HorecaRuleVersionStatus.PUBLISHED))
                .thenReturn(Optional.of(publishedVersion));
        when(itemRepository.findAllByRuleVersionIdOrderBySectionKeyAscSortOrderAsc(publishedVersionId))
                .thenReturn(List.of(
                        HorecaRuleFixtures.item(publishedVersionId, "WAGE_RULES", "adultFunctionGroupI_IIHourlyWage", "Adult function group I+II hourly wage", new BigDecimal("14.71"))
                ));
        when(itemRepository.findAllByRuleVersionIdOrderBySectionKeyAscSortOrderAsc(draftVersionId))
                .thenReturn(List.of(
                        HorecaRuleFixtures.item(draftVersionId, "WAGE_RULES", "adultFunctionGroupI_IIHourlyWage", "Adult function group I+II hourly wage", new BigDecimal("14.99"))
                ));
        when(jobPresetRepository.findAllByRuleVersionIdOrderBySortOrderAsc(draftVersionId)).thenReturn(List.of());
        when(versionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        User horecaUser = new User();
        horecaUser.setUserId(horecaUserId);
        horecaUser.setCompanyId(companyId);
        horecaUser.setStatus(UserStatus.ACTIVE);
        horecaUser.setDateOfBirth(LocalDate.of(2000, 1, 1));
        horecaUser.setPosition("Runner");

        User nonHorecaUser = new User();
        nonHorecaUser.setUserId(nonHorecaUserId);
        nonHorecaUser.setCompanyId(companyId);
        nonHorecaUser.setStatus(UserStatus.ACTIVE);
        nonHorecaUser.setDateOfBirth(LocalDate.of(2000, 1, 1));
        nonHorecaUser.setPosition("Supervisor");

        when(userRepository.findAllByCompanyId(companyId)).thenReturn(List.of(horecaUser, nonHorecaUser));

        HorecaRulePublishRequestDTO request = new HorecaRulePublishRequestDTO();
        request.setEffectiveFrom("2026-07-01");
        request.setReason("Wage table update");
        request.setVersionLabel("Horeca July 2026 wages");

        horecaRuleService().publishCurrentDraft(companyId, managerUserId, request, "token");

        ArgumentCaptor<RuleReplacementContractRequestDTO> captor =
                ArgumentCaptor.forClass(RuleReplacementContractRequestDTO.class);
        verify(contractServiceClient, times(1)).createRuleReplacementDraft(captor.capture(), eq("token"));

        RuleReplacementContractRequestDTO replacement = captor.getValue();
        assertThat(replacement.getUserId()).isEqualTo(horecaUserId.toString());
        assertThat(replacement.getGrossHourlyWage()).isEqualByComparingTo("14.99");
    }

    private HorecaRuleService horecaRuleService() {
        return new HorecaRuleService(
                versionRepository,
                itemRepository,
                jobPresetRepository,
                userRepository,
                contractServiceClient
        );
    }

    private static final class HorecaRuleFixtures {
        private static HorecaRuleVersion publishedVersion(UUID id, UUID companyId, LocalDate effectiveFrom) {
            HorecaRuleVersion version = new HorecaRuleVersion();
            version.setId(id);
            version.setCompanyId(companyId);
            version.setStatus(HorecaRuleVersionStatus.PUBLISHED);
            version.setEffectiveFrom(effectiveFrom);
            version.setPublishedAt(OffsetDateTime.now().minusDays(1));
            return version;
        }

        private static HorecaRuleVersion draftVersion(UUID id, UUID companyId) {
            HorecaRuleVersion version = new HorecaRuleVersion();
            version.setId(id);
            version.setCompanyId(companyId);
            version.setStatus(HorecaRuleVersionStatus.DRAFT);
            version.setCreatedAt(OffsetDateTime.now());
            return version;
        }

        private static com.pm.userservice.model.HorecaRuleItem item(
                UUID ruleVersionId,
                String sectionKey,
                String itemKey,
                String name,
                BigDecimal valueNumber
        ) {
            com.pm.userservice.model.HorecaRuleItem item = new com.pm.userservice.model.HorecaRuleItem();
            item.setId(UUID.randomUUID());
            item.setRuleVersionId(ruleVersionId);
            item.setSectionKey(HorecaRuleSection.valueOf(sectionKey));
            item.setItemKey(itemKey);
            item.setName(name);
            item.setValueNumber(valueNumber);
            item.setValueType(HorecaRuleValueType.NUMBER);
            return item;
        }

        private static com.pm.userservice.model.HorecaRuleItem item(
                UUID ruleVersionId,
                String sectionKey,
                String itemKey,
                String name,
                String valueText
        ) {
            com.pm.userservice.model.HorecaRuleItem item = new com.pm.userservice.model.HorecaRuleItem();
            item.setId(UUID.randomUUID());
            item.setRuleVersionId(ruleVersionId);
            item.setSectionKey(HorecaRuleSection.valueOf(sectionKey));
            item.setItemKey(itemKey);
            item.setName(name);
            item.setValueText(valueText);
            item.setValueType(HorecaRuleValueType.TEXT);
            return item;
        }
    }
}
