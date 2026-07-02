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

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * TS-7: the worked hours must flow through planning → timesheet → payroll unchanged.
 *
 * <p>Finalized planning exports each shift as a planned-timesheet record over gRPC; the
 * timesheet the import stores is exactly what payroll later reads back
 * ({@code requestTimesheetData}/{@code requestCompanyTimesheets}). This test pins that the
 * import preserves every record's hours to the stored entity, so the total hours planning
 * finalized equal the total hours payroll will be paid on — no drift at the hinge.
 */
@ExtendWith(MockitoExtension.class)
class TimesheetImportReconciliationTest {

    @Mock
    private TimesheetRepository timesheetRepository;

    @Mock
    private StreamObserver<ImportPlannedTimesheetsResponse> responseObserver;

    private final UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Test
    void importedHoursSumEqualsPlannedHoursSum() {
        TimesheetServiceGrpcService service = new TimesheetServiceGrpcService(timesheetRepository);
        when(timesheetRepository.findBySourceScheduleEntryId(org.mockito.ArgumentMatchers.any()))
                .thenReturn(Optional.empty());

        ImportPlannedTimesheetsRequest request = ImportPlannedTimesheetsRequest.newBuilder()
                .setSource("planning")
                .addRecords(record("8.00"))
                .addRecords(record("6.50"))
                .addRecords(record("4.25"))
                .build();

        service.importPlannedTimesheets(request, responseObserver);

        List<Timesheet> saved = captureSaved();
        BigDecimal storedTotal = saved.stream()
                .map(Timesheet::getHoursWorked)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Planned total = 8.00 + 6.50 + 4.25 = 18.75, preserved exactly.
        assertThat(storedTotal).isEqualByComparingTo("18.75");
        assertThat(saved).extracting(t -> t.getHoursWorked().stripTrailingZeros())
                .containsExactly(new BigDecimal("8"), new BigDecimal("6.5"), new BigDecimal("4.25"));
    }

    @Test
    void eachStoredRecordKeepsItsOwnHours() {
        TimesheetServiceGrpcService service = new TimesheetServiceGrpcService(timesheetRepository);
        when(timesheetRepository.findBySourceScheduleEntryId(org.mockito.ArgumentMatchers.any()))
                .thenReturn(Optional.empty());

        service.importPlannedTimesheets(
                ImportPlannedTimesheetsRequest.newBuilder().setSource("planning").addRecords(record("7.75")).build(),
                responseObserver);

        List<Timesheet> saved = captureSaved();
        assertThat(saved).singleElement()
                .satisfies(t -> assertThat(t.getHoursWorked()).isEqualByComparingTo("7.75"));
    }

    private PlannedTimesheetRecord record(String hours) {
        return PlannedTimesheetRecord.newBuilder()
                .setUserId(userId.toString())
                .setDateOfIssue("2026-06-17")
                .setName("Jan de Vries")
                .setFunction("barmedewerker")
                .setHoursWorked(hours)
                .setTravelExpenses("0.00")
                .setSourceScheduleEntryId(UUID.randomUUID().toString())
                .setCompanyId("33333333-3333-3333-3333-333333333333")
                .build();
    }

    @SuppressWarnings("unchecked")
    private List<Timesheet> captureSaved() {
        ArgumentCaptor<List<Timesheet>> captor = ArgumentCaptor.forClass(List.class);
        verify(timesheetRepository).saveAll(captor.capture());
        return captor.getValue();
    }
}
