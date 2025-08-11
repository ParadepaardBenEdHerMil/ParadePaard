package com.pm.timesheetservice.grpc;

import com.pm.timesheetservice.exception.TimesheetNotFoundException;
import com.pm.timesheetservice.model.Timesheet;
import com.pm.timesheetservice.repository.TimesheetRepository;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;

import java.util.List;
import java.util.UUID;

@GrpcService
public class TimesheetServiceGrpcService extends timesheet.TimesheetServiceGrpc.TimesheetServiceImplBase {
    private final TimesheetRepository timesheetRepository;

    public TimesheetServiceGrpcService(TimesheetRepository timesheetRepository) {
        this.timesheetRepository = timesheetRepository;
    }

    @Override
    public void requestTimesheetData(timesheet.TimesheetDataRequest request,
                                     StreamObserver<timesheet.TimesheetDataResponse> responseObserver) {
        try {
            UUID userId = UUID.fromString(request.getUserId());
            Integer week = Integer.valueOf(request.getWeekNumber());
            Integer year = Integer.valueOf(request.getWeekBasedYear());

            List<Timesheet> items = timesheetRepository.findByUserIdAndWeekNumberAndWeekBasedYear(userId, week, year);
            if (items == null || items.isEmpty()) {
                throw new TimesheetNotFoundException("No timesheets for user " + userId + " in week " + week + " of year " + year);
            }

            timesheet.TimesheetDataResponse.Builder resp = timesheet.TimesheetDataResponse.newBuilder();
            for (Timesheet tsEntity : items) {
                timesheet.Timesheet ts = timesheet.Timesheet.newBuilder()
                        .setTimesheetId(tsEntity.getTimesheetId().toString())
                        .setDateOfIssue(tsEntity.getDateOfIssue().toString())
                        .setFunction(tsEntity.getFunction())
                        .setHoursWorked(tsEntity.getHoursWorked().toString())
                        .setTravelExpenses(tsEntity.getTravelExpenses().toString())
                        .build();
                resp.addTimesheets(ts);
            }

            responseObserver.onNext(resp.build());
            responseObserver.onCompleted();

        } catch (NumberFormatException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT.withDescription("weekNumber, and weekBasedYear must be a number").asRuntimeException());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT.withDescription("bad userId").asRuntimeException());
        } catch (TimesheetNotFoundException e) {
            responseObserver.onError(Status.NOT_FOUND.withDescription(e.getMessage()).asRuntimeException());
        } catch (Exception e) {
            responseObserver.onError(Status.UNKNOWN.withDescription("server error").withCause(e).asRuntimeException());
        }
    }
}
