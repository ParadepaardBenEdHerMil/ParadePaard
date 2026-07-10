package com.pm.contractservice.service;

import com.pm.contractservice.dto.ContractRequestDTO;
import com.pm.contractservice.grpc.UserServiceGrpcClient;
import com.pm.contractservice.model.Contract;
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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import user.UserDataResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContractServiceMinimumWageTest {

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

    @Test
    void createContract_rejectsHourlyWageBelowAdultMinimumOn2026July() {
        UUID userId = UUID.randomUUID();
        when(userServiceGrpcClient.requestUserData(userId.toString()))
                .thenReturn(userWithDateOfBirth("2000-01-01"));

        ContractService service = service();
        ContractRequestDTO request = request(userId, "2026-07-01", "14.98");

        assertThatThrownBy(() -> service.createContract(request, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("minimum wage")
                .hasMessageContaining("14.99");
        verify(contractRepository, never()).save(any());
    }

    @Test
    void updateContract_rejectsHourlyWageBelowYouthMinimumOn2025July() {
        UUID contractId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Contract existing = contract(userId, LocalDate.of(2025, 7, 1), "8.64");
        existing.setContractId(contractId);

        when(contractValidator.getExistingContract(contractId)).thenReturn(existing);
        when(userServiceGrpcClient.requestUserData(userId.toString()))
                .thenReturn(userWithDateOfBirth("2006-07-01"));

        ContractService service = service();
        ContractRequestDTO request = request(userId, "2025-07-01", "8.63");

        assertThatThrownBy(() -> service.updateContract(contractId, request, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("minimum wage")
                .hasMessageContaining("8.64");
        verify(contractRepository, never()).save(any());
    }

    @Test
    void createContract_rejectsMissingDateOfBirthBecauseAgeCannotBeValidated() {
        UUID userId = UUID.randomUUID();
        when(userServiceGrpcClient.requestUserData(userId.toString()))
                .thenReturn(UserDataResponse.newBuilder().build());

        ContractService service = service();
        ContractRequestDTO request = request(userId, "2026-07-01", "15.00");

        assertThatThrownBy(() -> service.createContract(request, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("dateOfBirth");
        verify(contractRepository, never()).save(any());
    }

    private ContractService service() {
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

    private static ContractRequestDTO request(UUID userId, String startDate, String grossHourlyWage) {
        ContractRequestDTO request = new ContractRequestDTO();
        request.setUserId(userId.toString());
        request.setStartDate(startDate);
        request.setContractType("ON_CALL_RUNNER");
        request.setGrossHourlyWage(new BigDecimal(grossHourlyWage));
        request.setTravelAllowance(Boolean.TRUE);
        return request;
    }

    private static Contract contract(UUID userId, LocalDate startDate, String grossHourlyWage) {
        Contract contract = new Contract();
        contract.setUserId(userId);
        contract.setStartDate(startDate);
        contract.setContractType(ContractType.ON_CALL_RUNNER);
        contract.setGrossHourlyWage(new BigDecimal(grossHourlyWage));
        contract.setTravelAllowance(Boolean.TRUE);
        contract.setPaymentFrequency(PaymentFrequency.WEEKLY);
        return contract;
    }

    private static UserDataResponse userWithDateOfBirth(String dateOfBirth) {
        return UserDataResponse.newBuilder()
                .setDateOfBirth(dateOfBirth)
                .build();
    }
}
