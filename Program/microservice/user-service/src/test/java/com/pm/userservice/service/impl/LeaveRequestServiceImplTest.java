package com.pm.userservice.service.impl;

import com.pm.userservice.dto.LeaveRequestResponseDTO;
import com.pm.userservice.exception.InvalidLeaveRequestStateException;
import com.pm.userservice.model.LeaveRequest;
import com.pm.userservice.model.LeaveStatus;
import com.pm.userservice.model.LeaveType;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.LeaveRequestRepository;
import com.pm.userservice.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LeaveRequestServiceImplTest {

    private final LeaveRequestRepository leaveRepo = mock(LeaveRequestRepository.class);
    private final UserRepository userRepo = mock(UserRepository.class);
    private final LeaveRequestServiceImpl service = new LeaveRequestServiceImpl(leaveRepo, userRepo);

    private LeaveRequest requestWithStatus(UUID id, LeaveStatus status) {
        User user = new User();
        user.setUserId(UUID.randomUUID());
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

        LeaveRequestResponseDTO dto = service.approveLeaveRequest(id, "ok");

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

        LeaveRequestResponseDTO dto = service.rejectLeaveRequest(id, "no");

        assertEquals("REJECTED", dto.getStatus());
        assertEquals(LeaveStatus.REJECTED, lr.getStatus());
        verify(leaveRepo).save(lr);
    }

    @Test
    void cannotApproveAnAlreadyRejectedRequest() {
        UUID id = UUID.randomUUID();
        LeaveRequest lr = requestWithStatus(id, LeaveStatus.REJECTED);
        when(leaveRepo.findById(id)).thenReturn(Optional.of(lr));

        assertThrows(InvalidLeaveRequestStateException.class, () -> service.approveLeaveRequest(id, "flip"));

        // The finalized decision must survive and nothing is persisted.
        assertEquals(LeaveStatus.REJECTED, lr.getStatus());
        verify(leaveRepo, never()).save(any());
    }

    @Test
    void cannotRejectAnAlreadyApprovedRequest() {
        UUID id = UUID.randomUUID();
        LeaveRequest lr = requestWithStatus(id, LeaveStatus.APPROVED);
        when(leaveRepo.findById(id)).thenReturn(Optional.of(lr));

        assertThrows(InvalidLeaveRequestStateException.class, () -> service.rejectLeaveRequest(id, "flip"));

        assertEquals(LeaveStatus.APPROVED, lr.getStatus());
        verify(leaveRepo, never()).save(any());
    }
}
