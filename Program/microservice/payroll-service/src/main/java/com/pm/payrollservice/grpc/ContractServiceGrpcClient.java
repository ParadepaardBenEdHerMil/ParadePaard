// src/main/java/com/pm/payrollservice/grpc/ContractServiceGrpcClient.java
package com.pm.payrollservice.grpc;

import contract.ContractDataRequest;
import contract.ContractDataResponse;
import contract.ContractServiceGrpc;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class ContractServiceGrpcClient {

    private static final Logger log = LoggerFactory.getLogger(ContractServiceGrpcClient.class);
    private final ContractServiceGrpc.ContractServiceBlockingStub blockingStub;

    public ContractServiceGrpcClient(
            @Value("${contract.service.address:localhost}") String serverAddress,
            @Value("${contract.service.grpc.port:9002}") int serverPort) {

        log.info("Connecting to Contract Service GRPC at {}:{}", serverAddress, serverPort);

        ManagedChannel channel = ManagedChannelBuilder
                .forAddress(serverAddress, serverPort)
                .usePlaintext()
                .build();

        this.blockingStub = ContractServiceGrpc.newBlockingStub(channel);
    }

    public ContractDataResponse requestContractData(String userId) {
        ContractDataRequest request = ContractDataRequest.newBuilder()
                .setUserId(userId)
                .build();

        ContractDataResponse response = blockingStub.requestContractData(request);
        log.info("Received response from contract service via GRPC: {}", response);
        return response; // let StatusRuntimeException bubble to the handler
    }
}
