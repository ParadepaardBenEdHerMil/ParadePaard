package com.pm.contractservice.grpc;

import com.pm.contractservice.repository.ContractRepository;
import contract.ContractDataRequest;
import contract.ContractDataResponse;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ContractGrpcServiceContractTest {

    private final ContractRepository contractRepository = mock(ContractRepository.class);
    @SuppressWarnings("unchecked")
    private final StreamObserver<ContractDataResponse> responseObserver = mock(StreamObserver.class);

    @Test
    void requestContractDataMapsUnexpectedFailuresToInternalGrpcStatus() {
        UUID userId = UUID.randomUUID();
        when(contractRepository.findPayrollActiveForPeriod(userId, java.time.LocalDate.now(), java.time.LocalDate.now()))
                .thenThrow(new RuntimeException("database exploded"));

        ContractGrpcService service = new ContractGrpcService(contractRepository);

        service.requestContractData(
                ContractDataRequest.newBuilder().setUserId(userId.toString()).build(),
                responseObserver
        );

        ArgumentCaptor<Throwable> errorCaptor = ArgumentCaptor.forClass(Throwable.class);
        verify(responseObserver).onError(errorCaptor.capture());

        StatusRuntimeException error = (StatusRuntimeException) errorCaptor.getValue();
        assertThat(error.getStatus().getCode()).isEqualTo(Status.Code.INTERNAL);
        assertThat(error.getStatus().getDescription()).isEqualTo("Server error");
    }
}
