package com.pm.payrollservice.grpc;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import net.devh.boot.grpc.server.service.GrpcService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import user.UserDataRequest;
import user.UserDataResponse;
import user.UserServiceGrpc;


@Service
public class UserServiceGrpcClient {

    private final UserServiceGrpc.UserServiceBlockingStub blockingStub;

    private static final Logger log = LoggerFactory.getLogger(
            UserServiceGrpcClient.class);

    public UserServiceGrpcClient(@Value("${user.service.address:localhost}") String serverAddress,
                                 @Value("${user.service.grpc.port:9006}") int serverPort) {
        log.info("Connecting to Billing Service GRPC service at {}:{}",
                serverAddress, serverPort);

        ManagedChannel channel = ManagedChannelBuilder.forAddress(serverAddress,
                serverPort).usePlaintext().build();

        blockingStub = UserServiceGrpc.newBlockingStub(channel);
    }

    public UserDataResponse requestUserData(String userId) {
        UserDataRequest request = UserDataRequest.newBuilder().setUserId(userId).build();

        UserDataResponse response = blockingStub.requestUserData(request);
        log.info("Received response from billing service via GRPC: {}", response);
        return response;
    }
}
