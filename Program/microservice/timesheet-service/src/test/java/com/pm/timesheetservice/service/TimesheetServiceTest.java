package com.pm.timesheetservice.service;

import com.pm.timesheetservice.dto.PagedResponseDTO;
import com.pm.timesheetservice.dto.TimesheetRequestDTO;
import com.pm.timesheetservice.dto.TimesheetResponseDTO;
import com.pm.timesheetservice.exception.TimesheetNotFoundException;
import com.pm.timesheetservice.model.Timesheet;
import com.pm.timesheetservice.repository.TimesheetRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Service-level unit tests for {@link TimesheetService}.
 *
 * <p>Closes the weakest test area called out in the production-readiness checklist:
 * timesheet-service previously had only a {@code contextLoads} smoke test. Timesheets
 * are the source of truth for pay, so these tests pin hour capture, ISO-week derivation
 * (including the week-based-year boundary), own-vs-all retrieval scoping (TS-4) and the
 * manual CRUD path (TS-8).
 */
@ExtendWith(MockitoExtension.class)
class TimesheetServiceTest {

    @Mock
    private TimesheetRepository timesheetRepository;

    @InjectMocks
    private TimesheetService timesheetService;

    private final UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");

    // ---- TS-1: hours captured and ISO week/year derived from date of issue ----

    @Test
    void createTimesheet_computesIsoWeekAndWeekBasedYear() {
        TimesheetRequestDTO req = baseRequest("2026-06-17", "8.00"); // Wed in ISO week 25 of 2026
        whenSaveAssignId();

        TimesheetResponseDTO dto = timesheetService.createTimesheet(req);

        Timesheet saved = captureSaved();
        assertThat(saved.getWeekNumber()).isEqualTo(25);
        assertThat(saved.getWeekBasedYear()).isEqualTo(2026);
        assertThat(saved.getHoursWorked()).isEqualByComparingTo("8.00");
        assertThat(dto.getWeekNumber()).isEqualTo(25);
        assertThat(dto.getWeekBasedYear()).isEqualTo(2026);
    }

    @Test
    void createTimesheet_weekBasedYearCrossesCalendarYearBoundary() {
        // 2027-01-01 (Fri) falls in ISO week 53 of week-based-year 2026.
        // A naive getYear() would mis-bucket this into 2027 and mis-assign the pay period.
        TimesheetRequestDTO req = baseRequest("2027-01-01", "6.00");
        whenSaveAssignId();

        timesheetService.createTimesheet(req);

        Timesheet saved = captureSaved();
        assertThat(saved.getWeekNumber()).isEqualTo(53);
        assertThat(saved.getWeekBasedYear()).isEqualTo(2026);
    }

    // ---- TS-1 / PY-1 edge: zero hours with travel is a valid (travel-only) period ----

    @Test
    void createTimesheet_allowsZeroHoursWithTravelExpenses() {
        TimesheetRequestDTO req = baseRequest("2026-06-17", "0.00");
        req.setTravelExpenses(new BigDecimal("25.00"));
        whenSaveAssignId();

        TimesheetResponseDTO dto = timesheetService.createTimesheet(req);

        assertThat(dto.getHoursWorked()).isEqualByComparingTo("0.00");
        assertThat(dto.getTravelExpenses()).isEqualByComparingTo("25.00");
    }

    // ---- TS-4: own-vs-all retrieval is scoped by userId at the query ----

    @Test
    void getTimesheetsByUserId_returnsOnlyThatUsersRecords() {
        Timesheet mine = entity(UUID.randomUUID(), userId, "2026-06-17");
        when(timesheetRepository.findByUserIdOrderByDateOfIssueDesc(userId)).thenReturn(List.of(mine));

        List<TimesheetResponseDTO> result = timesheetService.getTimesheetsByUserId(userId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getUserId()).isEqualTo(userId.toString());
        verify(timesheetRepository).findByUserIdOrderByDateOfIssueDesc(userId);
    }

    @Test
    void getTimesheetsByUserIdPage_delegatesPagingToRepository() {
        Timesheet mine = entity(UUID.randomUUID(), userId, "2026-06-17");
        Pageable pageable = PageRequest.of(0, 50);
        when(timesheetRepository.findByUserIdOrderByDateOfIssueDesc(userId, PageRequest.of(0, 50)))
                .thenReturn(new PageImpl<>(List.of(mine), pageable, 1));

        PagedResponseDTO<TimesheetResponseDTO> page = timesheetService.getTimesheetsByUserIdPage(userId, 0, 50);

        assertThat(page.items()).hasSize(1);
        assertThat(page.totalElements()).isEqualTo(1);
        assertThat(page.hasNext()).isFalse();
    }

    // ---- TS-8: get / update / delete by id ----

    @Test
    void getTimesheetById_throwsWhenMissing() {
        UUID id = UUID.randomUUID();
        when(timesheetRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> timesheetService.getTimesheetById(id))
                .isInstanceOf(TimesheetNotFoundException.class)
                .hasMessageContaining(id.toString());
    }

    @Test
    void updateTimesheet_throwsWhenMissing_andDoesNotSave() {
        UUID id = UUID.randomUUID();
        when(timesheetRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> timesheetService.updateTimesheet(id, baseRequest("2026-06-17", "8.00")))
                .isInstanceOf(TimesheetNotFoundException.class);
        verify(timesheetRepository, never()).save(any());
    }

    @Test
    void updateTimesheet_appliesChangesToExistingRecord() {
        UUID id = UUID.randomUUID();
        Timesheet existing = entity(id, userId, "2026-06-17");
        when(timesheetRepository.findById(id)).thenReturn(Optional.of(existing));
        when(timesheetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        TimesheetRequestDTO req = baseRequest("2026-06-18", "9.50");
        req.setFunction("barhoofd");
        TimesheetResponseDTO dto = timesheetService.updateTimesheet(id, req);

        assertThat(dto.getHoursWorked()).isEqualByComparingTo("9.50");
        assertThat(dto.getFunction()).isEqualTo("barhoofd");
        assertThat(dto.getDateOfIssue()).isEqualTo("2026-06-18");
    }

    @Test
    void deleteTimesheet_delegatesToRepository() {
        UUID id = UUID.randomUUID();

        timesheetService.deleteTimesheet(id);

        verify(timesheetRepository, times(1)).deleteById(id);
    }

    // ---- helpers ----

    private TimesheetRequestDTO baseRequest(String dateOfIssue, String hours) {
        TimesheetRequestDTO req = new TimesheetRequestDTO();
        req.setUserId(userId.toString());
        req.setName("Jan de Vries");
        req.setDateOfIssue(dateOfIssue);
        req.setFunction("barmedewerker");
        req.setHoursWorked(new BigDecimal(hours));
        return req;
    }

    private Timesheet entity(UUID id, UUID owner, String dateOfIssue) {
        Timesheet t = new Timesheet();
        t.setTimesheetId(id);
        t.setUserId(owner);
        t.setName("Jan de Vries");
        t.setDateOfIssue(LocalDate.parse(dateOfIssue));
        t.setFunction("barmedewerker");
        t.setHoursWorked(new BigDecimal("8.00"));
        return t;
    }

    private void whenSaveAssignId() {
        when(timesheetRepository.save(any())).thenAnswer(inv -> {
            Timesheet t = inv.getArgument(0);
            if (t.getTimesheetId() == null) {
                t.setTimesheetId(UUID.randomUUID());
            }
            return t;
        });
    }

    private Timesheet captureSaved() {
        ArgumentCaptor<Timesheet> captor = ArgumentCaptor.forClass(Timesheet.class);
        verify(timesheetRepository).save(captor.capture());
        return captor.getValue();
    }
}
