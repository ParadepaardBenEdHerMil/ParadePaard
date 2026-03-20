package com.pm.planningservice.integration;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import timesheet.ImportPlannedTimesheetsRequest;
import timesheet.ImportPlannedTimesheetsResponse;
import timesheet.PlannedTimesheetRecord;
import timesheet.TimesheetServiceGrpc;

import java.util.List;

@Service
public class TimesheetGrpcClient {
    private final TimesheetServiceGrpc.TimesheetServiceBlockingStub blockingStub;

    public TimesheetGrpcClient(
            @Value("${timesheet.service.address:localhost}") String serverAddress,
            @Value("${timesheet.service.grpc.port:9001}") int serverPort) {
        ManagedChannel channel = ManagedChannelBuilder
                .forAddress(serverAddress, serverPort)
                .usePlaintext()
                .build();
        this.blockingStub = TimesheetServiceGrpc.newBlockingStub(channel);
    }

    public ImportPlannedTimesheetsResponse importPlannedTimesheets(String source, List<PlannedTimesheetRecord> records) {
        ImportPlannedTimesheetsRequest request = ImportPlannedTimesheetsRequest.newBuilder()
                .setSource(source)
                .addAllRecords(records)
                .build();
        return blockingStub.importPlannedTimesheets(request);
    }
}
