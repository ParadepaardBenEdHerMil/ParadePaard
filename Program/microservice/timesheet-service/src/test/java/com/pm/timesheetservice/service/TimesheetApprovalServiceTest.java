package com.pm.timesheetservice.service;

import com.pm.timesheetservice.dto.TimesheetRequestDTO;
import com.pm.timesheetservice.dto.TimesheetResponseDTO;
import com.pm.timesheetservice.exception.InvalidTimesheetStateException;
import com.pm.timesheetservice.model.Timesheet;
import com.pm.timesheetservice.model.TimesheetAudit;
import com.pm.timesheetservice.model.TimesheetAuditAction;
import com.pm.timesheetservice.model.TimesheetStatus;
import com.pm.timesheetservice.repository.TimesheetAuditRepository;
import com.pm.timesheetservice.repository.TimesheetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * TS-3: manager approve/reject workflow with an audit trail.
 *
 * <p>Pins the state machine (a timesheet is born PENDING and can be decided exactly
 * once), the captured who/when/reason on a decision, and the append-only audit entries
 * written for create / approve / reject. A finalized decision cannot be silently flipped
 * — that is an {@link InvalidTimesheetStateException} (HTTP 409).
 */
@ExtendWith(MockitoExtension.class)
class TimesheetApprovalServiceTest {

    @Mock
    private TimesheetRepository timesheetRepository;

    @Mock
    private TimesheetAuditRepository auditRepository;

    private TimesheetService service;

    private final Clock clock = Clock.fixed(Instant.parse("2026-06-20T10:00:00Z"), ZoneOffset.UTC);
    private final UUID userId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private final UUID manager = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @BeforeEach
    void setUp() {
        service = new TimesheetService(timesheetRepository, auditRepository, clock);
    }

    @Test
    void createTimesheet_isBornPendingAndWritesCreatedAudit() {
        when(timesheetRepository.save(any())).thenAnswer(inv -> {
            Timesheet t = inv.getArgument(0);
            if (t.getTimesheetId() == null) t.setTimesheetId(UUID.randomUUID());
            return t;
        });

        TimesheetResponseDTO dto = service.createTimesheet(request(), manager);

        assertThat(dto.getStatus()).isEqualTo("PENDING");
        TimesheetAudit audit = captureAudit();
        assertThat(audit.getAction()).isEqualTo(TimesheetAuditAction.CREATED);
        assertThat(audit.getActorUserId()).isEqualTo(manager);
        assertThat(audit.getToStatus()).isEqualTo(TimesheetStatus.PENDING);
        assertThat(audit.getAt()).isEqualTo(OffsetDateTime.now(clock));
    }

    @Test
    void approve_movesPendingToApproved_capturesDecider_andAudits() {
        UUID id = UUID.randomUUID();
        Timesheet pending = pending(id);
        when(timesheetRepository.findById(id)).thenReturn(Optional.of(pending));
        when(timesheetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        TimesheetResponseDTO dto = service.approveTimesheet(id, manager, "looks correct");

        assertThat(dto.getStatus()).isEqualTo("APPROVED");
        assertThat(dto.getDecidedByUserId()).isEqualTo(manager.toString());
        assertThat(dto.getDecisionReason()).isEqualTo("looks correct");
        assertThat(dto.getDecidedAt()).isEqualTo(OffsetDateTime.now(clock).toString());

        TimesheetAudit audit = captureAudit();
        assertThat(audit.getAction()).isEqualTo(TimesheetAuditAction.APPROVED);
        assertThat(audit.getFromStatus()).isEqualTo(TimesheetStatus.PENDING);
        assertThat(audit.getToStatus()).isEqualTo(TimesheetStatus.APPROVED);
        assertThat(audit.getReason()).isEqualTo("looks correct");
    }

    @Test
    void reject_movesPendingToRejected() {
        UUID id = UUID.randomUUID();
        when(timesheetRepository.findById(id)).thenReturn(Optional.of(pending(id)));
        when(timesheetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        TimesheetResponseDTO dto = service.rejectTimesheet(id, manager, "hours disputed");

        assertThat(dto.getStatus()).isEqualTo("REJECTED");
        assertThat(dto.getDecisionReason()).isEqualTo("hours disputed");
        TimesheetAudit audit = captureAudit();
        assertThat(audit.getAction()).isEqualTo(TimesheetAuditAction.REJECTED);
        assertThat(audit.getToStatus()).isEqualTo(TimesheetStatus.REJECTED);
    }

    @Test
    void approve_onAlreadyApproved_throwsConflict_andDoesNotSave() {
        UUID id = UUID.randomUUID();
        Timesheet approved = pending(id);
        approved.setStatus(TimesheetStatus.APPROVED);
        when(timesheetRepository.findById(id)).thenReturn(Optional.of(approved));

        assertThatThrownBy(() -> service.approveTimesheet(id, manager, null))
                .isInstanceOf(InvalidTimesheetStateException.class)
                .hasMessageContaining("APPROVED");

        verify(timesheetRepository, never()).save(any());
        verify(auditRepository, never()).save(any());
    }

    @Test
    void reject_onAlreadyRejected_throwsConflict() {
        UUID id = UUID.randomUUID();
        Timesheet rejected = pending(id);
        rejected.setStatus(TimesheetStatus.REJECTED);
        when(timesheetRepository.findById(id)).thenReturn(Optional.of(rejected));

        assertThatThrownBy(() -> service.rejectTimesheet(id, manager, null))
                .isInstanceOf(InvalidTimesheetStateException.class);
    }

    @Test
    void update_writesUpdatedAudit() {
        UUID id = UUID.randomUUID();
        when(timesheetRepository.findById(id)).thenReturn(Optional.of(pending(id)));
        when(timesheetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.updateTimesheet(id, request(), manager);

        TimesheetAudit audit = captureAudit();
        assertThat(audit.getAction()).isEqualTo(TimesheetAuditAction.UPDATED);
        assertThat(audit.getActorUserId()).isEqualTo(manager);
    }

    // ---- helpers ----

    private TimesheetRequestDTO request() {
        TimesheetRequestDTO req = new TimesheetRequestDTO();
        req.setUserId(userId.toString());
        req.setName("Jan de Vries");
        req.setDateOfIssue("2026-06-17");
        req.setFunction("barmedewerker");
        req.setHoursWorked(new BigDecimal("8.00"));
        return req;
    }

    private Timesheet pending(UUID id) {
        Timesheet t = new Timesheet();
        t.setTimesheetId(id);
        t.setUserId(userId);
        t.setName("Jan de Vries");
        t.setDateOfIssue(LocalDate.parse("2026-06-17"));
        t.setHoursWorked(new BigDecimal("8.00"));
        t.setStatus(TimesheetStatus.PENDING);
        return t;
    }

    private TimesheetAudit captureAudit() {
        ArgumentCaptor<TimesheetAudit> captor = ArgumentCaptor.forClass(TimesheetAudit.class);
        verify(auditRepository).save(captor.capture());
        return captor.getValue();
    }
}
