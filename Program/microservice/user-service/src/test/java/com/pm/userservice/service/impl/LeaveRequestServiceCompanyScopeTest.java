package com.pm.userservice.service.impl;

import com.pm.userservice.dto.LeaveRequestResponseDTO;
import com.pm.userservice.exception.InvalidLeaveRequestStateException;
import com.pm.userservice.exception.LeaveRequestNotFoundException;
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

/**
 * R-8 / R-10 / LV cross-tenant access control on the leave decision endpoints.
 */
class LeaveRequestServiceCompanyScopeTest {

    private final LeaveRequestRepository leaveRepo = mock(LeaveRequestRepository.class);
    private final UserRepository userRepo = mock(UserRepository.class);
    private final com.pm.userservice.service.LeaveBalanceService balanceService =
            mock(com.pm.userservice.service.LeaveBalanceService.class);
    private final LeaveRequestServiceImpl service = new LeaveRequestServiceImpl(leaveRepo, userRepo, balanceService);

    private LeaveRequest requestOwnedBy(UUID id, UUID ownerCompanyId, LeaveStatus status) {
        User owner = new User();
        owner.setUserId(UUID.randomUUID());
        owner.setCompanyId(ownerCompanyId);
        owner.setPreferredName("Owner");

        LeaveRequest lr = new LeaveRequest();
        lr.setRequestId(id);
        lr.setUser(owner);
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
    void approve_deniesRequestOwnedByAnotherCompany() {
        UUID callerCompany = UUID.randomUUID();
        UUID ownerCompany = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        LeaveRequest lr = requestOwnedBy(requestId, ownerCompany, LeaveStatus.PENDING);
        when(leaveRepo.findById(requestId)).thenReturn(Optional.of(lr));

        assertThrows(LeaveRequestNotFoundException.class,
                () -> service.approveLeaveRequest(requestId, callerCompany, "ok"));

        assertEquals(LeaveStatus.PENDING, lr.getStatus());
        verify(leaveRepo, never()).save(any());
    }

    @Test
    void reject_deniesRequestOwnedByAnotherCompany() {
        UUID callerCompany = UUID.randomUUID();
        UUID ownerCompany = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        LeaveRequest lr = requestOwnedBy(requestId, ownerCompany, LeaveStatus.PENDING);
        when(leaveRepo.findById(requestId)).thenReturn(Optional.of(lr));

        assertThrows(LeaveRequestNotFoundException.class,
                () -> service.rejectLeaveRequest(requestId, callerCompany, "no"));

        assertEquals(LeaveStatus.PENDING, lr.getStatus());
        verify(leaveRepo, never()).save(any());
    }

    @Test
    void approve_crossCompanyAlreadyDecided_isNotFoundNotStateConflict() {
        UUID callerCompany = UUID.randomUUID();
        UUID ownerCompany = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        LeaveRequest lr = requestOwnedBy(requestId, ownerCompany, LeaveStatus.APPROVED);
        when(leaveRepo.findById(requestId)).thenReturn(Optional.of(lr));

        assertThrows(LeaveRequestNotFoundException.class,
                () -> service.approveLeaveRequest(requestId, callerCompany, "flip"));
        verify(leaveRepo, never()).save(any());
    }

    @Test
    void approve_deniesWhenCallerCompanyIsNull() {
        UUID ownerCompany = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        LeaveRequest lr = requestOwnedBy(requestId, ownerCompany, LeaveStatus.PENDING);
        when(leaveRepo.findById(requestId)).thenReturn(Optional.of(lr));

        assertThrows(LeaveRequestNotFoundException.class,
                () -> service.approveLeaveRequest(requestId, null, "ok"));

        assertEquals(LeaveStatus.PENDING, lr.getStatus());
        verify(leaveRepo, never()).save(any());
    }

    @Test
    void approve_allowsRequestInSameCompany() {
        UUID company = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        LeaveRequest lr = requestOwnedBy(requestId, company, LeaveStatus.PENDING);
        when(leaveRepo.findById(requestId)).thenReturn(Optional.of(lr));
        when(leaveRepo.save(any(LeaveRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        LeaveRequestResponseDTO dto = service.approveLeaveRequest(requestId, company, "ok");

        assertEquals("APPROVED", dto.getStatus());
        assertEquals(LeaveStatus.APPROVED, lr.getStatus());
        verify(leaveRepo).save(lr);
    }

    @Test
    void reject_allowsRequestInSameCompany() {
        UUID company = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        LeaveRequest lr = requestOwnedBy(requestId, company, LeaveStatus.PENDING);
        when(leaveRepo.findById(requestId)).thenReturn(Optional.of(lr));
        when(leaveRepo.save(any(LeaveRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        LeaveRequestResponseDTO dto = service.rejectLeaveRequest(requestId, company, "no");

        assertEquals("REJECTED", dto.getStatus());
        assertEquals(LeaveStatus.REJECTED, lr.getStatus());
        verify(leaveRepo).save(lr);
    }

    @Test
    void approve_sameCompanyButAlreadyDecided_stillStateConflict() {
        UUID company = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        LeaveRequest lr = requestOwnedBy(requestId, company, LeaveStatus.REJECTED);
        when(leaveRepo.findById(requestId)).thenReturn(Optional.of(lr));

        assertThrows(InvalidLeaveRequestStateException.class,
                () -> service.approveLeaveRequest(requestId, company, "flip"));

        assertEquals(LeaveStatus.REJECTED, lr.getStatus());
        verify(leaveRepo, never()).save(any());
    }
}
