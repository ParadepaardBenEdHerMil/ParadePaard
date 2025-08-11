// src/main/java/com/pm/payrollservice/grpc/TimesheetServiceGrpcClient.java
package com.pm.payrollservice.grpc;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import timesheet.TimesheetDataRequest;
import timesheet.TimesheetDataResponse;
import timesheet.TimesheetServiceGrpc;

@Service
public class TimesheetServiceGrpcClient {

    private static final Logger log = LoggerFactory.getLogger(TimesheetServiceGrpcClient.class);
    private final TimesheetServiceGrpc.TimesheetServiceBlockingStub blockingStub;

    public TimesheetServiceGrpcClient(
            @Value("${timesheet.service.address:localhost}") String serverAddress,
            @Value("${timesheet.service.grpc.port:9001}") int serverPort) {

        log.info("Connecting to Timesheet Service GRPC at {}:{}", serverAddress, serverPort);

        ManagedChannel channel = ManagedChannelBuilder
                .forAddress(serverAddress, serverPort)
                .usePlaintext()
                .build();

        this.blockingStub = TimesheetServiceGrpc.newBlockingStub(channel);
    }

    public TimesheetDataResponse requestTimesheetData(String userId, int weekNumber, int weekBasedYear) {
        TimesheetDataRequest request = TimesheetDataRequest.newBuilder()
                .setUserId(userId)
                .setWeekNumber(String.valueOf(weekNumber))     // proto uses string
                .setWeekBasedYear(String.valueOf(weekBasedYear)) // proto uses string
                .build();

        TimesheetDataResponse response = blockingStub.requestTimesheetData(request);
        log.info("Received response from timesheet service via GRPC: {}", response);
        return response; // let StatusRuntimeException bubble to the handler
    }
}
