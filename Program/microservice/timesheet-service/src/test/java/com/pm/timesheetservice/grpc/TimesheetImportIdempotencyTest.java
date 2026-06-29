package com.pm.timesheetservice.grpc;

import com.pm.timesheetservice.model.Timesheet;
import com.pm.timesheetservice.repository.TimesheetRepository;
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import timesheet.ImportPlannedTimesheetsRequest;
import timesheet.ImportPlannedTimesheetsResponse;
import timesheet.PlannedTimesheetRecord;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Idempotency of the planned-timesheet import (TS-9).
 *
 * <p>Finalizing planning exports timesheets via gRPC. Re-finalizing (or an at-least-once
 * Kafka redelivery) must not double the payable hours: the import is keyed by
 * {@code sourceScheduleEntryId} and an existing row is updated in place, so a worked shift
 * appears in work history exactly once. Malformed records must be skipped, not abort the batch.
 */
@ExtendWith(MockitoExtension.class)
class TimesheetImportIdempotencyTest {

    @Mock
    private TimesheetRepository timesheetRepository;

    @Mock
    private StreamObserver<ImportPlannedTimesheetsResponse> responseObserver;

    private final UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID scheduleEntryId = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Test
    void importNewRecord_countsAsCreated() {
        TimesheetServiceGrpcService service = new TimesheetServiceGrpcService(timesheetRepository);
        when(timesheetRepository.findBySourceScheduleEntryId(scheduleEntryId)).thenReturn(Optional.empty());

        service.importPlannedTimesheets(requestWith(record(scheduleEntryId, "8.00")), responseObserver);

        ImportPlannedTimesheetsResponse resp = captureResponse();
        assertThat(resp.getCreatedCount()).isEqualTo(1);
        assertThat(resp.getUpdatedCount()).isEqualTo(0);
        verify(timesheetRepository).saveAll(anyList());
    }

    @Test
    void reimportSameScheduleEntryId_updatesInPlace_doesNotDuplicate() {
        TimesheetServiceGrpcService service = new TimesheetServiceGrpcService(timesheetRepository);
        Timesheet existing = new Timesheet();
        existing.setTimesheetId(UUID.randomUUID()); // already persisted
        existing.setSourceScheduleEntryId(scheduleEntryId);
        when(timesheetRepository.findBySourceScheduleEntryId(scheduleEntryId)).thenReturn(Optional.of(existing));

        service.importPlannedTimesheets(requestWith(record(scheduleEntryId, "8.00")), responseObserver);

        ImportPlannedTimesheetsResponse resp = captureResponse();
        assertThat(resp.getCreatedCount()).isEqualTo(0);
        assertThat(resp.getUpdatedCount()).isEqualTo(1);

        // The same entity instance is updated and saved — no second row is created.
        ArgumentCaptor<List<Timesheet>> captor = listCaptor();
        verify(timesheetRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).containsExactly(existing);
    }

    @Test
    void malformedRecord_isSkippedWithWarning_goodRecordStillImported() {
        TimesheetServiceGrpcService service = new TimesheetServiceGrpcService(timesheetRepository);
        when(timesheetRepository.findBySourceScheduleEntryId(scheduleEntryId)).thenReturn(Optional.empty());

        PlannedTimesheetRecord good = record(scheduleEntryId, "8.00");
        PlannedTimesheetRecord bad = record(UUID.randomUUID(), "not-a-number");
        ImportPlannedTimesheetsRequest request = ImportPlannedTimesheetsRequest.newBuilder()
                .setSource("planning")
                .addRecords(good)
                .addRecords(bad)
                .build();

        service.importPlannedTimesheets(request, responseObserver);

        ImportPlannedTimesheetsResponse resp = captureResponse();
        assertThat(resp.getCreatedCount()).isEqualTo(1);
        assertThat(resp.getWarningsCount()).isEqualTo(1);
        verify(responseObserver, never()).onError(org.mockito.ArgumentMatchers.any());
    }

    // ---- helpers ----

    private PlannedTimesheetRecord record(UUID scheduleId, String hours) {
        return PlannedTimesheetRecord.newBuilder()
                .setUserId(userId.toString())
                .setDateOfIssue("2026-06-17")
                .setName("Jan de Vries")
                .setFunction("barmedewerker")
                .setHoursWorked(hours)
                .setTravelExpenses("0.00")
                .setSourceScheduleEntryId(scheduleId.toString())
                .setCompanyId("33333333-3333-3333-3333-333333333333")
                .build();
    }

    private ImportPlannedTimesheetsRequest requestWith(PlannedTimesheetRecord record) {
        return ImportPlannedTimesheetsRequest.newBuilder()
                .setSource("planning")
                .addRecords(record)
                .build();
    }

    private ImportPlannedTimesheetsResponse captureResponse() {
        ArgumentCaptor<ImportPlannedTimesheetsResponse> captor =
                ArgumentCaptor.forClass(ImportPlannedTimesheetsResponse.class);
        verify(responseObserver).onNext(captor.capture());
        return captor.getValue();
    }

    @SuppressWarnings("unchecked")
    private ArgumentCaptor<List<Timesheet>> listCaptor() {
        return ArgumentCaptor.forClass(List.class);
    }
}
