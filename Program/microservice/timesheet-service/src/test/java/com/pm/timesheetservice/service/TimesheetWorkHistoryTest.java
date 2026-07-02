package com.pm.timesheetservice.service;

import com.pm.timesheetservice.dto.PagedResponseDTO;
import com.pm.timesheetservice.dto.TimesheetResponseDTO;
import com.pm.timesheetservice.model.Timesheet;
import com.pm.timesheetservice.repository.TimesheetAuditRepository;
import com.pm.timesheetservice.repository.TimesheetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * TS-5: the work-history view (an employee's own timesheets) must be accurate and paginate
 * correctly — only the caller's rows, in the repository's issue-date-descending order, with
 * correct page metadata.
 */
@ExtendWith(MockitoExtension.class)
class TimesheetWorkHistoryTest {

    @Mock
    private TimesheetRepository timesheetRepository;
    @Mock
    private TimesheetAuditRepository auditRepository;

    private TimesheetService service;

    private final UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @BeforeEach
    void setUp() {
        service = new TimesheetService(timesheetRepository, auditRepository,
                Clock.fixed(Instant.parse("2026-06-20T10:00:00Z"), ZoneOffset.UTC));
    }

    @Test
    void workHistoryReturnsOnlyOwnRowsInRepositoryOrder() {
        Timesheet a = entity("2026-06-19", "8.00");
        Timesheet b = entity("2026-06-12", "6.00");
        Timesheet c = entity("2026-06-05", "4.00");
        // repository returns newest-first (findByUserIdOrderByDateOfIssueDesc)
        when(timesheetRepository.findByUserIdOrderByDateOfIssueDesc(userId)).thenReturn(List.of(a, b, c));

        List<TimesheetResponseDTO> history = service.getTimesheetsByUserId(userId);

        assertThat(history).extracting(TimesheetResponseDTO::getDateOfIssue)
                .containsExactly("2026-06-19", "2026-06-12", "2026-06-05");
        assertThat(history).allSatisfy(row -> assertThat(row.getUserId()).isEqualTo(userId.toString()));
    }

    @Test
    void workHistoryPaginationMetadataIsAccurate() {
        Timesheet a = entity("2026-06-19", "8.00");
        Timesheet b = entity("2026-06-12", "6.00");
        Pageable pageable = PageRequest.of(0, 2);
        // page 0 of 2, 5 total rows -> hasNext true
        when(timesheetRepository.findByUserIdOrderByDateOfIssueDesc(userId, PageRequest.of(0, 2)))
                .thenReturn(new PageImpl<>(List.of(a, b), pageable, 5));

        PagedResponseDTO<TimesheetResponseDTO> page = service.getTimesheetsByUserIdPage(userId, 0, 2);

        assertThat(page.items()).hasSize(2);
        assertThat(page.totalElements()).isEqualTo(5);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.hasPrevious()).isFalse();
    }

    private Timesheet entity(String dateOfIssue, String hours) {
        Timesheet t = new Timesheet();
        t.setTimesheetId(UUID.randomUUID());
        t.setUserId(userId);
        t.setName("Jan de Vries");
        t.setDateOfIssue(LocalDate.parse(dateOfIssue));
        t.setHoursWorked(new BigDecimal(hours));
        return t;
    }
}
