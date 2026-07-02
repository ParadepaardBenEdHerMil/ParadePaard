package com.pm.planningservice.integration;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import user.LeaveOverlapRequest;
import user.LeaveOverlapResponse;
import user.UserServiceGrpc;

import java.time.LocalDate;

/**
 * Asks user-service whether an employee is on approved leave in a date range, so planning
 * can refuse to roster someone who is off (leave ↔ roster). Fails open: if user-service is
 * unavailable the assignment is allowed rather than blocking all scheduling on an outage.
 */
@Service
public class UserLeaveGrpcClient {

    private static final Logger log = LoggerFactory.getLogger(UserLeaveGrpcClient.class);

    private final UserServiceGrpc.UserServiceBlockingStub blockingStub;

    public UserLeaveGrpcClient(
            @Value("${user.service.address:localhost}") String serverAddress,
            @Value("${user.service.grpc.port:9006}") int serverPort) {
        ManagedChannel channel = ManagedChannelBuilder
                .forAddress(serverAddress, serverPort)
                .usePlaintext()
                .build();
        this.blockingStub = UserServiceGrpc.newBlockingStub(channel);
    }

    public boolean hasApprovedLeaveOverlap(String userId, LocalDate from, LocalDate to) {
        try {
            LeaveOverlapResponse response = blockingStub.hasApprovedLeaveOverlap(
                    LeaveOverlapRequest.newBuilder()
                            .setUserId(userId)
                            .setFromDate(from.toString())
                            .setToDate(to.toString())
                            .build());
            return response.getHasOverlap();
        } catch (RuntimeException ex) {
            log.warn("Leave-overlap check failed for user {} ({} to {}); allowing assignment: {}",
                    userId, from, to, ex.getMessage());
            return false;
        }
    }
}
