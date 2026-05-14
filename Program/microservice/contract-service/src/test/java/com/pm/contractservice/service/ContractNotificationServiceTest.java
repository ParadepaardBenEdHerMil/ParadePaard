package com.pm.contractservice.service;

import com.pm.contractservice.exception.ContractEmailDeliveryException;
import com.pm.contractservice.grpc.UserServiceGrpcClient;
import com.pm.contractservice.model.Contract;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import user.UserDataResponse;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContractNotificationServiceTest {

    @Mock
    private UserServiceGrpcClient userServiceGrpcClient;
    @Mock
    private ContractEmailSender contractEmailSender;

    @Test
    void sendsContractReadyEmailToEmployeeProfileEmail() {
        UUID userId = UUID.randomUUID();
        Contract contract = new Contract();
        contract.setUserId(userId);
        when(userServiceGrpcClient.requestUserData(userId.toString())).thenReturn(UserDataResponse.newBuilder()
                .setEmail("employee@example.com")
                .setPreferredName("Alex")
                .build());

        ContractNotificationService service = new ContractNotificationService(
                userServiceGrpcClient,
                contractEmailSender,
                "http://localhost:5173/account/employment"
        );

        service.sendContractReady(contract);

        verify(contractEmailSender).sendContractReadyEmail(
                "employee@example.com",
                "Alex",
                "http://localhost:5173/account/employment"
        );
    }

    @Test
    void rejectsContractReadyEmailWhenEmployeeEmailIsMissing() {
        UUID userId = UUID.randomUUID();
        Contract contract = new Contract();
        contract.setUserId(userId);
        when(userServiceGrpcClient.requestUserData(userId.toString())).thenReturn(UserDataResponse.newBuilder().build());

        ContractNotificationService service = new ContractNotificationService(
                userServiceGrpcClient,
                contractEmailSender,
                "http://localhost:5173/account/employment"
        );

        assertThatThrownBy(() -> service.sendContractReady(contract))
                .isInstanceOf(ContractEmailDeliveryException.class)
                .hasMessageContaining("Employee email address is missing");
    }
}
