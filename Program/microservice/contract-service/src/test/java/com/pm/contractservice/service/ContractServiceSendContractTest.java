package com.pm.contractservice.service;

import com.pm.contractservice.exception.ContractEmailDeliveryException;
import com.pm.contractservice.grpc.UserServiceGrpcClient;
import com.pm.contractservice.model.Contract;
import com.pm.contractservice.model.ContractStatus;
import com.pm.contractservice.model.ContractType;
import com.pm.contractservice.model.PaymentFrequency;
import com.pm.contractservice.repository.ContractRepository;
import com.pm.contractservice.repository.FunctionRepository;
import com.pm.contractservice.service.events.ContractEventPublisher;
import com.pm.contractservice.service.pdf.ContractPdfGenerator;
import com.pm.contractservice.validation.ContractValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContractServiceSendContractTest {

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

    @Test
    void sendContractEmailsEmployeeBeforeSavingSentStatus() {
        UUID contractId = UUID.randomUUID();
        Contract contract = contract(contractId);
        when(contractValidator.getExistingContract(contractId)).thenReturn(contract);
        when(contractRepository.save(contract)).thenReturn(contract);

        ContractService service = contractService();
        service.sendContract(contractId);

        InOrder inOrder = inOrder(contractNotificationService, contractRepository);
        inOrder.verify(contractNotificationService).sendContractReady(contract);
        inOrder.verify(contractRepository).save(contract);
        assertThat(contract.getStatus()).isEqualTo(ContractStatus.SENT_TO_EMPLOYEE);
        assertThat(contract.getSentToEmployeeAt()).isNotNull();
        assertThat(contract.getReviewComment()).isNull();
    }

    @Test
    void sendContractDoesNotMarkSentWhenEmailDeliveryFails() {
        UUID contractId = UUID.randomUUID();
        Contract contract = contract(contractId);
        when(contractValidator.getExistingContract(contractId)).thenReturn(contract);
        doThrow(new ContractEmailDeliveryException("Failed to send contract email"))
                .when(contractNotificationService).sendContractReady(contract);

        ContractService service = contractService();

        assertThatThrownBy(() -> service.sendContract(contractId))
                .isInstanceOf(ContractEmailDeliveryException.class)
                .hasMessageContaining("Failed to send contract email");
        verify(contractRepository, never()).save(any());
        assertThat(contract.getStatus()).isEqualTo(ContractStatus.DRAFT);
        assertThat(contract.getSentToEmployeeAt()).isNull();
    }

    private ContractService contractService() {
        return new ContractService(
                contractRepository,
                contractValidator,
                userServiceGrpcClient,
                contractEventPublisher,
                contractPdfGenerator,
                functionRepository,
                contractNotificationService
        );
    }

    private static Contract contract(UUID contractId) {
        Contract contract = new Contract();
        contract.setContractId(contractId);
        contract.setUserId(UUID.randomUUID());
        contract.setStartDate(LocalDate.of(2026, 5, 1));
        contract.setContractType(ContractType.ON_CALL_RUNNER);
        contract.setStatus(ContractStatus.DRAFT);
        contract.setGrossHourlyWage(new BigDecimal("18.50"));
        contract.setTravelAllowance(Boolean.TRUE);
        contract.setPaymentFrequency(PaymentFrequency.WEEKLY);
        contract.setReviewComment("Needs review");
        return contract;
    }
}
