// src/main/java/com/pm/payrollservice/grpc/UserServiceGrpcClient.java
package com.pm.payrollservice.grpc;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import user.UserDataRequest;
import user.UserDataResponse;
import user.UserServiceGrpc;

@Service
public class UserServiceGrpcClient {

    private static final Logger log = LoggerFactory.getLogger(UserServiceGrpcClient.class);
    private final UserServiceGrpc.UserServiceBlockingStub blockingStub;

    public UserServiceGrpcClient(
            @Value("${user.service.address:localhost}") String serverAddress,
            @Value("${user.service.grpc.port:9006}") int serverPort) {

        log.info("Connecting to User Service GRPC at {}:{}", serverAddress, serverPort);

        ManagedChannel channel = ManagedChannelBuilder
                .forAddress(serverAddress, serverPort)
                .usePlaintext()
                .build();

        this.blockingStub = UserServiceGrpc.newBlockingStub(channel);
    }

    public UserDataResponse requestUserData(String userId) {
        UserDataRequest request = UserDataRequest.newBuilder()
                .setUserId(userId)
                .build();

        UserDataResponse response = blockingStub.requestUserData(request);
        log.info("Received response from user service via GRPC: {}", response);
        return response; // let StatusRuntimeException bubble to the handler
    }
}
