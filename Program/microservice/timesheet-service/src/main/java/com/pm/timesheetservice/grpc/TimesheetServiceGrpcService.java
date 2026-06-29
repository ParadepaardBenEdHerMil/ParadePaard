package com.pm.timesheetservice.grpc;

import com.pm.timesheetservice.exception.TimesheetNotFoundException;
import com.pm.timesheetservice.model.Timesheet;
import com.pm.timesheetservice.repository.TimesheetRepository;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.WeekFields;
import java.util.Comparator;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

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
                resp.addTimesheets(toProto(tsEntity));
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

    @Override
    public void requestLatestTimesheetSummary(timesheet.LatestTimesheetSummaryRequest request,
                                              StreamObserver<timesheet.LatestTimesheetSummaryResponse> responseObserver) {
        try {
            UUID userId = UUID.fromString(request.getUserId());

            Timesheet latest = timesheetRepository.findByUserIdOrderByDateOfIssueDesc(userId).stream()
                    .max(Comparator
                            .comparing(this::resolveLoggedAt)
                            .thenComparing(Timesheet::getDateOfIssue)
                            .thenComparing(Timesheet::getTimesheetId))
                    .orElseThrow(() -> new TimesheetNotFoundException("No timesheets for user " + userId));

            timesheet.LatestTimesheetSummaryResponse response = timesheet.LatestTimesheetSummaryResponse.newBuilder()
                    .setTimesheetId(latest.getTimesheetId().toString())
                    .setDateOfIssue(latest.getDateOfIssue().toString())
                    .setWeekNumber(String.valueOf(latest.getWeekNumber()))
                    .setWeekBasedYear(String.valueOf(latest.getWeekBasedYear()))
                    .setShiftEndTime(asText(latest.getShiftEndTime() == null ? null : latest.getShiftEndTime().toString()))
                    .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT.withDescription("bad userId").asRuntimeException());
        } catch (TimesheetNotFoundException e) {
            responseObserver.onError(Status.NOT_FOUND.withDescription(e.getMessage()).asRuntimeException());
        } catch (Exception e) {
            responseObserver.onError(Status.UNKNOWN.withDescription("server error").withCause(e).asRuntimeException());
        }
    }

    @Override
    public void requestTimesheetSummariesForUser(timesheet.TimesheetSummariesForUserRequest request,
                                                 StreamObserver<timesheet.TimesheetSummariesForUserResponse> responseObserver) {
        try {
            UUID userId = UUID.fromString(request.getUserId());

            Map<String, Timesheet> latestByWeek = timesheetRepository.findByUserIdOrderByDateOfIssueDesc(userId).stream()
                    .collect(Collectors.toMap(
                            timesheet -> timesheet.getWeekBasedYear() + "-" + timesheet.getWeekNumber(),
                            timesheet -> timesheet,
                            (left, right) -> resolveLoggedAt(left).isAfter(resolveLoggedAt(right)) ? left : right
                    ));

            if (latestByWeek.isEmpty()) {
                throw new TimesheetNotFoundException("No timesheets for user " + userId);
            }

            List<timesheet.LatestTimesheetSummaryResponse> summaries = latestByWeek.values().stream()
                    .sorted(Comparator
                            .comparing(this::resolveLoggedAt)
                            .thenComparing(Timesheet::getDateOfIssue)
                            .thenComparing(Timesheet::getTimesheetId)
                            .reversed())
                    .map(summaryTimesheet -> timesheet.LatestTimesheetSummaryResponse.newBuilder()
                            .setTimesheetId(summaryTimesheet.getTimesheetId().toString())
                            .setDateOfIssue(summaryTimesheet.getDateOfIssue().toString())
                            .setWeekNumber(String.valueOf(summaryTimesheet.getWeekNumber()))
                            .setWeekBasedYear(String.valueOf(summaryTimesheet.getWeekBasedYear()))
                            .setShiftEndTime(asText(summaryTimesheet.getShiftEndTime() == null ? null : summaryTimesheet.getShiftEndTime().toString()))
                            .build())
                    .toList();

            responseObserver.onNext(timesheet.TimesheetSummariesForUserResponse.newBuilder()
                    .addAllSummaries(summaries)
                    .build());
            responseObserver.onCompleted();
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT.withDescription("bad userId").asRuntimeException());
        } catch (TimesheetNotFoundException e) {
            responseObserver.onError(Status.NOT_FOUND.withDescription(e.getMessage()).asRuntimeException());
        } catch (Exception e) {
            responseObserver.onError(Status.UNKNOWN.withDescription("server error").withCause(e).asRuntimeException());
        }
    }

    @Override
    public void importPlannedTimesheets(timesheet.ImportPlannedTimesheetsRequest request,
                                        StreamObserver<timesheet.ImportPlannedTimesheetsResponse> responseObserver) {
        try {
            List<Timesheet> toPersist = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            int createdCount = 0;
            int updatedCount = 0;

            for (timesheet.PlannedTimesheetRecord record : request.getRecordsList()) {
                try {
                    UUID userId = UUID.fromString(record.getUserId());
                    LocalDate date = LocalDate.parse(record.getDateOfIssue());
                    BigDecimal hoursWorked = new BigDecimal(record.getHoursWorked());
                    BigDecimal travelExpenses = new BigDecimal(record.getTravelExpenses());
                    UUID sourceScheduleEntryId = record.getSourceScheduleEntryId().isBlank()
                            ? null
                            : UUID.fromString(record.getSourceScheduleEntryId());
                    Timesheet timesheetEntity = sourceScheduleEntryId == null
                            ? new Timesheet()
                            : timesheetRepository.findBySourceScheduleEntryId(sourceScheduleEntryId).orElseGet(Timesheet::new);

                    if (timesheetEntity.getTimesheetId() == null) {
                        createdCount++;
                    } else {
                        updatedCount++;
                    }

                    timesheetEntity.setUserId(userId);
                    timesheetEntity.setCompanyId(record.getCompanyId().isBlank() ? null : UUID.fromString(record.getCompanyId()));
                    timesheetEntity.setDateOfIssue(date);
                    timesheetEntity.setWeekNumber(date.get(WeekFields.ISO.weekOfWeekBasedYear()));
                    timesheetEntity.setWeekBasedYear(date.get(WeekFields.ISO.weekBasedYear()));
                    timesheetEntity.setName(record.getName());
                    timesheetEntity.setProjectName(record.getProjectName().isBlank() ? record.getName() : record.getProjectName());
                    timesheetEntity.setFunction(record.getFunction());
                    timesheetEntity.setHoursWorked(hoursWorked);
                    timesheetEntity.setTravelExpenses(travelExpenses);
                    timesheetEntity.setSourceProjectId(record.getSourceProjectId().isBlank() ? null : UUID.fromString(record.getSourceProjectId()));
                    timesheetEntity.setSourceShiftId(record.getSourceShiftId().isBlank() ? null : UUID.fromString(record.getSourceShiftId()));
                    timesheetEntity.setSourceScheduleEntryId(sourceScheduleEntryId);
                    timesheetEntity.setShiftName(record.getShiftName().isBlank() ? null : record.getShiftName());
                    timesheetEntity.setShiftDate(record.getShiftDate().isBlank() ? null : LocalDate.parse(record.getShiftDate()));
                    timesheetEntity.setShiftStartTime(record.getShiftStartTime().isBlank() ? null : LocalDateTime.parse(record.getShiftStartTime()));
                    timesheetEntity.setShiftEndTime(record.getShiftEndTime().isBlank() ? null : LocalDateTime.parse(record.getShiftEndTime()));
                    timesheetEntity.setBreakMinutes(record.getBreakMinutes());
                    timesheetEntity.setTravelKilometers(record.getTravelKilometers().isBlank() ? null : new BigDecimal(record.getTravelKilometers()));
                    timesheetEntity.setTravelRate(record.getTravelRate().isBlank() ? null : new BigDecimal(record.getTravelRate()));
                    toPersist.add(timesheetEntity);
                } catch (Exception recordError) {
                    String warning = "Skipped scheduleEntryId=" + record.getSourceScheduleEntryId()
                            + " reason=" + recordError.getMessage();
                    warnings.add(warning);
                }
            }

            if (!toPersist.isEmpty()) {
                timesheetRepository.saveAll(toPersist);
            }

            timesheet.ImportPlannedTimesheetsResponse response = timesheet.ImportPlannedTimesheetsResponse.newBuilder()
                    .setCreatedCount(createdCount)
                    .setUpdatedCount(updatedCount)
                    .addAllWarnings(warnings)
                    .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            responseObserver.onError(Status.UNKNOWN.withDescription("server error").withCause(e).asRuntimeException());
        }
    }

    @Override
    public void requestCompanyTimesheets(timesheet.CompanyTimesheetsRequest request,
                                         StreamObserver<timesheet.CompanyTimesheetsResponse> responseObserver) {
        try {
            UUID companyId = UUID.fromString(request.getCompanyId());
            LocalDate from = LocalDate.parse(request.getFromDate());
            LocalDate to = LocalDate.parse(request.getToDate());

            List<Timesheet> items =
                    timesheetRepository.findByCompanyIdAndShiftDateBetweenOrderByShiftDateAsc(companyId, from, to);

            timesheet.CompanyTimesheetsResponse.Builder resp = timesheet.CompanyTimesheetsResponse.newBuilder();
            for (Timesheet tsEntity : items) {
                resp.addTimesheets(toProto(tsEntity));
            }
            responseObserver.onNext(resp.build());
            responseObserver.onCompleted();
        } catch (java.time.format.DateTimeParseException | IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT.withDescription("companyId, fromDate and toDate must be valid").asRuntimeException());
        } catch (Exception e) {
            responseObserver.onError(Status.UNKNOWN.withDescription("server error").withCause(e).asRuntimeException());
        }
    }

    /** Maps a Timesheet entity to its proto representation (null-safe). */
    private timesheet.Timesheet toProto(Timesheet tsEntity) {
        return timesheet.Timesheet.newBuilder()
                .setTimesheetId(asString(tsEntity.getTimesheetId()))
                .setDateOfIssue(asText(tsEntity.getDateOfIssue() == null ? null : tsEntity.getDateOfIssue().toString()))
                .setFunctionName(asText(tsEntity.getFunction()))
                .setHoursWorked(asDecimal(tsEntity.getHoursWorked()))
                .setTravelExpenses(asDecimal(tsEntity.getTravelExpenses()))
                .setSourceProjectId(asString(tsEntity.getSourceProjectId()))
                .setSourceShiftId(asString(tsEntity.getSourceShiftId()))
                .setSourceScheduleEntryId(asString(tsEntity.getSourceScheduleEntryId()))
                .setProjectName(asText(tsEntity.getProjectName()))
                .setShiftName(asText(tsEntity.getShiftName()))
                .setShiftDate(asText(tsEntity.getShiftDate() == null ? null : tsEntity.getShiftDate().toString()))
                .setShiftStartTime(asText(tsEntity.getShiftStartTime() == null ? null : tsEntity.getShiftStartTime().toString()))
                .setShiftEndTime(asText(tsEntity.getShiftEndTime() == null ? null : tsEntity.getShiftEndTime().toString()))
                .setBreakMinutes(tsEntity.getBreakMinutes() == null ? 0 : tsEntity.getBreakMinutes())
                .setTravelKilometers(asDecimal(tsEntity.getTravelKilometers()))
                .setTravelRate(asDecimal(tsEntity.getTravelRate()))
                .setCompanyId(asString(tsEntity.getCompanyId()))
                .setUserId(asString(tsEntity.getUserId()))
                .build();
    }

    private String asString(UUID value) {
        return value == null ? "" : value.toString();
    }

    private String asText(String value) {
        return value == null ? "" : value;
    }

    private String asDecimal(BigDecimal value) {
        return value == null ? "" : value.toPlainString();
    }

    private LocalDateTime resolveLoggedAt(Timesheet timesheet) {
        if (timesheet.getShiftEndTime() != null) {
            return timesheet.getShiftEndTime();
        }
        return timesheet.getDateOfIssue().atStartOfDay();
    }
}
