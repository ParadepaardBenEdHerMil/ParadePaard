package com.pm.contractservice.service;

import com.pm.contractservice.dto.AuditLogCreateRequestDTO;
import com.pm.contractservice.integration.AuditLogClient;
import com.pm.contractservice.dto.RuleReplacementContractRequestDTO;
import com.pm.contractservice.dto.RuleReplacementContractResponseDTO;
import com.pm.contractservice.grpc.UserServiceGrpcClient;
import com.pm.contractservice.model.Contract;
import com.pm.contractservice.model.ContractStatus;
import com.pm.contractservice.model.ContractType;
import com.pm.contractservice.model.PaymentFrequency;
import com.pm.contractservice.repository.ContractRepository;
import com.pm.contractservice.repository.FunctionRepository;
import com.pm.contractservice.repository.MinimumWageRateRepository;
import com.pm.contractservice.service.events.ContractEventPublisher;
import com.pm.contractservice.service.pdf.ContractPdfGenerator;
import com.pm.contractservice.validation.ContractValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.lang.reflect.Field;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContractServiceRuleReplacementTest {

    @Mock
    private ContractRepository contractRepository;
    @Mock
    private ContractValidator contractValidator;
    @Mock
    private UserServiceGrpcClient userServiceGrpcClient;
    @Mock
    private ContractEventPublisher contractEventPublisher;
    @Mock
    private ContractPdfGenerator contractPdfGenerator;
    @Mock
    private FunctionRepository functionRepository;
    @Mock
    private ContractNotificationService contractNotificationService;
    @Mock
    private MinimumWageRateRepository minimumWageRateRepository;
    @Mock
    private AuditLogClient auditLogClient;

    @Test
    void createRuleReplacementDraftClonesTheActiveContractForwardWithoutChangingHistory() {
        UUID userId = UUID.randomUUID();
        UUID previousContractId = UUID.randomUUID();
        UUID ruleVersionId = UUID.randomUUID();
        Contract previousContract = activeFinalizedContract(previousContractId, userId);

        when(contractRepository.findPayrollActiveForPeriod(
                userId,
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2026, 7, 1)
        )).thenReturn(List.of(previousContract));
        when(contractRepository.save(any(Contract.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userServiceGrpcClient.requestUserData(userId.toString()))
                .thenReturn(user.UserDataResponse.newBuilder().setDateOfBirth("2000-01-01").build());

        RuleReplacementContractRequestDTO request = new RuleReplacementContractRequestDTO();
        request.setUserId(userId.toString());
        request.setEffectiveFrom("2026-07-01");
        request.setRuleVersionId(ruleVersionId.toString());
        request.setGrossHourlyWage(new BigDecimal("14.99"));
        request.setHolidayAllowancePercentage(new BigDecimal("8.50"));
        request.setCollectiveAgreement("Horeca CAO 2025 2026 updated per 2026-07-01");
        request.setPensionScheme("Pensioenfonds Horeca en Catering");

        RuleReplacementContractResponseDTO response = contractService().createRuleReplacementDraft(request);

        ArgumentCaptor<Contract> savedContract = ArgumentCaptor.forClass(Contract.class);
        verify(contractRepository).save(savedContract.capture());

        Contract draft = savedContract.getValue();
        assertThat(draft.getContractId()).isNull();
        assertThat(draft.getUserId()).isEqualTo(userId);
        assertThat(draft.getStatus()).isEqualTo(ContractStatus.DRAFT);
        assertThat(draft.getStartDate()).isEqualTo(LocalDate.of(2026, 7, 1));
        assertThat(draft.getGrossHourlyWage()).isEqualByComparingTo("14.99");
        assertThat(draft.getTravelAllowance()).isTrue();
        assertThat(draft.getPaymentFrequency()).isEqualTo(PaymentFrequency.WEEKLY);
        assertThat(draft.getHolidayAllowancePercentage()).isEqualByComparingTo("8.50");
        assertThat(draft.getCollectiveAgreement()).isEqualTo("Horeca CAO 2025 2026 updated per 2026-07-01");
        assertThat(draft.getPensionScheme()).isEqualTo("Pensioenfonds Horeca en Catering");
        assertThat(draft.getReplacesContractId()).isEqualTo(previousContractId);
        assertThat(draft.getDerivedFromRuleVersionId()).isEqualTo(ruleVersionId);

        assertThat(previousContract.getStatus()).isEqualTo(ContractStatus.FINALIZED);
        assertThat(previousContract.getStartDate()).isEqualTo(LocalDate.of(2026, 1, 1));
        assertThat(previousContract.getHolidayAllowancePercentage()).isEqualByComparingTo("8.00");

        assertThat(response.getReplacesContractId()).isEqualTo(previousContractId.toString());
        assertThat(response.getDerivedFromRuleVersionId()).isEqualTo(ruleVersionId.toString());
        assertThat(response.getStartDate()).isEqualTo("2026-07-01");
    }

    @Test
    void createRuleReplacementDraftRecordsAuditEntryWhenAccessTokenIsAvailable() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID previousContractId = UUID.randomUUID();
        Contract previousContract = activeFinalizedContract(previousContractId, userId);

        when(contractRepository.findPayrollActiveForPeriod(
                userId,
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2026, 7, 1)
        )).thenReturn(List.of(previousContract));
        when(contractRepository.save(any(Contract.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RuleReplacementContractRequestDTO request = new RuleReplacementContractRequestDTO();
        request.setUserId(userId.toString());
        request.setEffectiveFrom("2026-07-01");

        ContractService service = contractService();
        injectAuditLogClient(service);
        service.createRuleReplacementDraft(request, "access-token");

        verify(auditLogClient).record(eq("access-token"), argThat((AuditLogCreateRequestDTO auditRequest) ->
                auditRequest != null
                        && "CONTRACTS".equals(auditRequest.getCategory())
                        && "CREATED_REPLACEMENT_DRAFT".equals(auditRequest.getAction())
        ));
    }

    private ContractService contractService() {
        return new ContractService(
                contractRepository,
                contractValidator,
                userServiceGrpcClient,
                contractEventPublisher,
                contractPdfGenerator,
                functionRepository,
                contractNotificationService,
                new MinimumWageService(minimumWageRateRepository)
        );
    }

    private void injectAuditLogClient(ContractService service) throws Exception {
        Field field = ContractService.class.getDeclaredField("auditLogClient");
        field.setAccessible(true);
        field.set(service, auditLogClient);
    }

    private static Contract activeFinalizedContract(UUID contractId, UUID userId) {
        Contract contract = new Contract();
        contract.setContractId(contractId);
        contract.setUserId(userId);
        contract.setFunctionName("Waiter");
        contract.setStartDate(LocalDate.of(2026, 1, 1));
        contract.setContractType(ContractType.ON_CALL_RUNNER);
        contract.setStatus(ContractStatus.FINALIZED);
        contract.setGrossHourlyWage(new BigDecimal("18.50"));
        contract.setTravelAllowance(Boolean.TRUE);
        contract.setPaymentFrequency(PaymentFrequency.WEEKLY);
        contract.setHolidayAllowancePercentage(new BigDecimal("8.00"));
        contract.setLeaveEntitlementDays(20);
        contract.setWorkLocation("Amsterdam");
        contract.setNoticePeriod("Statutory Dutch notice periods apply unless otherwise agreed in writing.");
        contract.setSicknessPolicy("The employee must report sickness according to the employer's absence policy and Dutch employment rules.");
        contract.setCollectiveAgreement("Horeca CAO 2025 2026");
        contract.setPensionScheme("Pensioenfonds Horeca en Catering");
        return contract;
    }
}
