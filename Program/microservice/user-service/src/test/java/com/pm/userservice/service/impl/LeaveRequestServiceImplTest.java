package com.pm.userservice.service.impl;

import com.pm.userservice.dto.LeaveRequestResponseDTO;
import com.pm.userservice.exception.InsufficientLeaveBalanceException;
import com.pm.userservice.exception.InvalidLeaveRequestStateException;
import com.pm.userservice.model.LeaveRequest;
import com.pm.userservice.model.LeaveStatus;
import com.pm.userservice.model.LeaveType;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.LeaveRequestRepository;
import com.pm.userservice.repository.UserRepository;
import com.pm.userservice.service.LeaveBalanceService;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LeaveRequestServiceImplTest {

    private final LeaveRequestRepository leaveRepo = mock(LeaveRequestRepository.class);
    private final UserRepository userRepo = mock(UserRepository.class);
    private final LeaveBalanceService balanceService = mock(LeaveBalanceService.class);
    private final LeaveRequestServiceImpl service = new LeaveRequestServiceImpl(leaveRepo, userRepo, balanceService);

    // The caller (admin) and the request owner share this company in these tests, so the
    // company-scope guard is satisfied and we isolate the PENDING-only state behaviour.
    private static final UUID COMPANY = UUID.randomUUID();

    private LeaveRequest requestWithStatus(UUID id, LeaveStatus status) {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setCompanyId(COMPANY);
        user.setPreferredName("Test User");
        LeaveRequest lr = new LeaveRequest();
        lr.setRequestId(id);
        lr.setUser(user);
        lr.setType(LeaveType.VACATION);
        lr.setStartDate(LocalDate.of(2026, 7, 1));
        lr.setEndDate(LocalDate.of(2026, 7, 5));
        lr.setHours(24);
        lr.setStatus(status);
        lr.setCreatedAt(OffsetDateTime.parse("2026-06-29T10:00:00Z"));
        lr.setUpdatedAt(OffsetDateTime.parse("2026-06-29T10:00:00Z"));
        return lr;
    }

    @Test
    void approveFromPendingSetsApproved() {
        UUID id = UUID.randomUUID();
        LeaveRequest lr = requestWithStatus(id, LeaveStatus.PENDING);
        when(leaveRepo.findById(id)).thenReturn(Optional.of(lr));
        when(leaveRepo.save(any(LeaveRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        LeaveRequestResponseDTO dto = service.approveLeaveRequest(id, COMPANY, "ok");

        assertEquals("APPROVED", dto.getStatus());
        assertEquals(LeaveStatus.APPROVED, lr.getStatus());
        verify(leaveRepo).save(lr);
    }

    @Test
    void rejectFromPendingSetsRejected() {
        UUID id = UUID.randomUUID();
        LeaveRequest lr = requestWithStatus(id, LeaveStatus.PENDING);
        when(leaveRepo.findById(id)).thenReturn(Optional.of(lr));
        when(leaveRepo.save(any(LeaveRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        LeaveRequestResponseDTO dto = service.rejectLeaveRequest(id, COMPANY, "no");

        assertEquals("REJECTED", dto.getStatus());
        assertEquals(LeaveStatus.REJECTED, lr.getStatus());
        verify(leaveRepo).save(lr);
    }

    @Test
    void cannotApproveAnAlreadyRejectedRequest() {
        UUID id = UUID.randomUUID();
        LeaveRequest lr = requestWithStatus(id, LeaveStatus.REJECTED);
        when(leaveRepo.findById(id)).thenReturn(Optional.of(lr));

        assertThrows(InvalidLeaveRequestStateException.class, () -> service.approveLeaveRequest(id, COMPANY, "flip"));

        // The finalized decision must survive and nothing is persisted.
        assertEquals(LeaveStatus.REJECTED, lr.getStatus());
        verify(leaveRepo, never()).save(any());
    }

    @Test
    void cannotRejectAnAlreadyApprovedRequest() {
        UUID id = UUID.randomUUID();
        LeaveRequest lr = requestWithStatus(id, LeaveStatus.APPROVED);
        when(leaveRepo.findById(id)).thenReturn(Optional.of(lr));

        assertThrows(InvalidLeaveRequestStateException.class, () -> service.rejectLeaveRequest(id, COMPANY, "flip"));

        assertEquals(LeaveStatus.APPROVED, lr.getStatus());
        verify(leaveRepo, never()).save(any());
    }

    @Test
    void approveDeductsHolidayHoursFromBalance() {
        UUID id = UUID.randomUUID();
        LeaveRequest lr = requestWithStatus(id, LeaveStatus.PENDING); // VACATION, 24h, 2026
        when(leaveRepo.findById(id)).thenReturn(Optional.of(lr));
        when(leaveRepo.save(any(LeaveRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        service.approveLeaveRequest(id, COMPANY, "ok");

        verify(balanceService).reserveForApproval(
                lr.getUser().getUserId(), COMPANY, 2026, 24, LeaveType.VACATION);
        assertEquals(LeaveStatus.APPROVED, lr.getStatus());
    }

    @Test
    void approveWithInsufficientBalanceDoesNotApprove() {
        UUID id = UUID.randomUUID();
        LeaveRequest lr = requestWithStatus(id, LeaveStatus.PENDING);
        when(leaveRepo.findById(id)).thenReturn(Optional.of(lr));
        doThrow(new InsufficientLeaveBalanceException("not enough"))
                .when(balanceService).reserveForApproval(any(), any(), anyInt(), anyInt(), eq(LeaveType.VACATION));

        assertThrows(InsufficientLeaveBalanceException.class, () -> service.approveLeaveRequest(id, COMPANY, "ok"));

        assertEquals(LeaveStatus.PENDING, lr.getStatus());
        verify(leaveRepo, never()).save(any());
    }

    @Test
    void cancelApprovedHolidayRestoresBalance() {
        UUID id = UUID.randomUUID();
        LeaveRequest lr = requestWithStatus(id, LeaveStatus.APPROVED);
        when(leaveRepo.findById(id)).thenReturn(Optional.of(lr));
        when(leaveRepo.save(any(LeaveRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        LeaveRequestResponseDTO dto = service.cancelLeaveRequest(id, COMPANY, "changed plans");

        assertEquals("CANCELED", dto.getStatus());
        verify(balanceService).restore(lr.getUser().getUserId(), 2026, 24, LeaveType.VACATION);
    }

    @Test
    void cancelPendingHolidayDoesNotTouchBalance() {
        UUID id = UUID.randomUUID();
        LeaveRequest lr = requestWithStatus(id, LeaveStatus.PENDING);
        when(leaveRepo.findById(id)).thenReturn(Optional.of(lr));
        when(leaveRepo.save(any(LeaveRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        service.cancelLeaveRequest(id, COMPANY, "withdrew");

        assertEquals(LeaveStatus.CANCELED, lr.getStatus());
        verify(balanceService, never()).restore(any(), anyInt(), anyInt(), any());
    }

    @Test
    void cannotCancelAnAlreadyRejectedRequest() {
        UUID id = UUID.randomUUID();
        LeaveRequest lr = requestWithStatus(id, LeaveStatus.REJECTED);
        when(leaveRepo.findById(id)).thenReturn(Optional.of(lr));

        assertThrows(InvalidLeaveRequestStateException.class, () -> service.cancelLeaveRequest(id, COMPANY, "x"));
        verify(leaveRepo, never()).save(any());
    }
}
