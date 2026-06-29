package com.pm.contractservice.service;

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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import user.UserDataResponse;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ContractServiceCompanyScopeTest {
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
    void getContractsReturnsOnlyContractsForTheRequestedCompany() {
        UUID companyId = UUID.randomUUID();
        UUID otherCompanyId = UUID.randomUUID();
        UUID companyUserId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();

        when(contractRepository.findAll()).thenReturn(List.of(
                contract(UUID.randomUUID(), companyUserId),
                contract(UUID.randomUUID(), otherUserId)
        ));
        when(userServiceGrpcClient.requestUserData(companyUserId.toString()))
                .thenReturn(UserDataResponse.newBuilder().setCompanyId(companyId.toString()).build());
        when(userServiceGrpcClient.requestUserData(otherUserId.toString()))
                .thenReturn(UserDataResponse.newBuilder().setCompanyId(otherCompanyId.toString()).build());

        ContractService service = new ContractService(
                contractRepository,
                contractValidator,
                userServiceGrpcClient,
                contractEventPublisher,
                contractPdfGenerator,
                functionRepository,
                contractNotificationService
        );

        assertThat(service.getContracts(companyId))
                .singleElement()
                .satisfies(contract -> assertThat(contract.getUserId()).isEqualTo(companyUserId));
    }

    // ---- T-1 / R-10 / CT-7: cross-tenant isolation & IDOR on contract reads ----

    @Test
    void getContractView_deniesContractOwnedByAnotherCompany() {
        UUID scopedCompany = UUID.randomUUID();   // caller is scoped into company A
        UUID ownerCompany = UUID.randomUUID();    // contract actually belongs to company B
        UUID ownerUserId = UUID.randomUUID();
        UUID contractId = UUID.randomUUID();      // attacker guesses another company's contractId

        when(contractValidator.getExistingContract(contractId)).thenReturn(contract(contractId, ownerUserId));
        when(userServiceGrpcClient.requestUserData(ownerUserId.toString()))
                .thenReturn(UserDataResponse.newBuilder().setCompanyId(ownerCompany.toString()).build());

        ContractService service = service();

        assertThatThrownBy(() -> service.getContractView(contractId, scopedCompany))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void getContractsForUser_deniesUserInAnotherCompany() {
        UUID scopedCompany = UUID.randomUUID();
        UUID ownerCompany = UUID.randomUUID();
        UUID targetUserId = UUID.randomUUID();
        when(userServiceGrpcClient.requestUserData(targetUserId.toString()))
                .thenReturn(UserDataResponse.newBuilder().setCompanyId(ownerCompany.toString()).build());

        ContractService service = service();

        assertThatThrownBy(() -> service.getContractsForUser(targetUserId, scopedCompany))
                .isInstanceOf(AccessDeniedException.class);
        verify(contractRepository, never()).findByUserIdOrderByStartDateDesc(targetUserId);
    }

    @Test
    void getContractsForUser_allowsUserInSameCompany() {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(userServiceGrpcClient.requestUserData(userId.toString()))
                .thenReturn(UserDataResponse.newBuilder().setCompanyId(companyId.toString()).build());
        when(contractRepository.findByUserIdOrderByStartDateDesc(userId))
                .thenReturn(List.of(contract(UUID.randomUUID(), userId)));

        ContractService service = service();

        assertThat(service.getContractsForUser(userId, companyId)).hasSize(1);
    }

    @Test
    void getCurrentContract_deniesUserInAnotherCompany() {
        UUID scopedCompany = UUID.randomUUID();
        UUID ownerCompany = UUID.randomUUID();
        UUID targetUserId = UUID.randomUUID();
        when(userServiceGrpcClient.requestUserData(targetUserId.toString()))
                .thenReturn(UserDataResponse.newBuilder().setCompanyId(ownerCompany.toString()).build());

        ContractService service = service();

        assertThatThrownBy(() -> service.getCurrentContract(targetUserId, LocalDate.of(2026, 6, 1), scopedCompany))
                .isInstanceOf(AccessDeniedException.class);
    }

    private ContractService service() {
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

    private static Contract contract(UUID contractId, UUID userId) {
        Contract contract = new Contract();
        contract.setContractId(contractId);
        contract.setUserId(userId);
        contract.setStartDate(LocalDate.of(2026, 6, 1));
        contract.setContractType(ContractType.ON_CALL_RUNNER);
        contract.setStatus(ContractStatus.DRAFT);
        contract.setGrossHourlyWage(new BigDecimal("18.50"));
        contract.setTravelAllowance(Boolean.TRUE);
        contract.setPaymentFrequency(PaymentFrequency.WEEKLY);
        return contract;
    }
}
