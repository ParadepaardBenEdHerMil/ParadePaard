package com.pm.userservice.service.impl;

import com.pm.userservice.dto.LeaveRequestResponseDTO;
import com.pm.userservice.dto.LeaveRequestUpdateDTO;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * B4: cross-tenant leak and IDOR protection on the leave list and by-id endpoints.
 */
class LeaveRequestServiceIdorTest {

    private final LeaveRequestRepository leaveRepo = mock(LeaveRequestRepository.class);
    private final UserRepository userRepo = mock(UserRepository.class);
    private final com.pm.userservice.service.LeaveBalanceService balanceService =
            mock(com.pm.userservice.service.LeaveBalanceService.class);
    private final LeaveRequestServiceImpl service = new LeaveRequestServiceImpl(leaveRepo, userRepo, balanceService);

    private LeaveRequest requestOwnedBy(UUID requestId, UUID ownerUserId, UUID ownerCompanyId) {
        User owner = new User();
        owner.setUserId(ownerUserId);
        owner.setCompanyId(ownerCompanyId);
        owner.setPreferredName("Owner");

        LeaveRequest lr = new LeaveRequest();
        lr.setRequestId(requestId);
        lr.setUser(owner);
        lr.setType(LeaveType.VACATION);
        lr.setStartDate(LocalDate.of(2026, 7, 1));
        lr.setEndDate(LocalDate.of(2026, 7, 5));
        lr.setHours(24);
        lr.setStatus(LeaveStatus.PENDING);
        lr.setCreatedAt(OffsetDateTime.parse("2026-06-29T10:00:00Z"));
        lr.setUpdatedAt(OffsetDateTime.parse("2026-06-29T10:00:00Z"));
        return lr;
    }

    // ---- by-id IDOR: a user passing their own {userId} but someone else's {requestId} ----

    @Test
    void getById_deniesRequestOwnedByAnotherUser() {
        UUID company = UUID.randomUUID();
        UUID attacker = UUID.randomUUID();
        UUID victim = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        // Same company (attacker guesses a colleague's requestId), different owner.
        LeaveRequest lr = requestOwnedBy(requestId, victim, company);
        when(leaveRepo.findById(requestId)).thenReturn(Optional.of(lr));

        assertThrows(LeaveRequestNotFoundException.class,
                () -> service.getLeaveRequest(attacker, requestId, company));
    }

    @Test
    void getById_deniesRequestOwnedByAnotherCompany() {
        UUID callerCompany = UUID.randomUUID();
        UUID ownerCompany = UUID.randomUUID();
        UUID ownerUserId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        LeaveRequest lr = requestOwnedBy(requestId, ownerUserId, ownerCompany);
        when(leaveRepo.findById(requestId)).thenReturn(Optional.of(lr));

        // Even with the correct owner userId, a cross-company caller is denied.
        assertThrows(LeaveRequestNotFoundException.class,
                () -> service.getLeaveRequest(ownerUserId, requestId, callerCompany));
    }

    @Test
    void getById_allowsOwnerInSameCompany() {
        UUID company = UUID.randomUUID();
        UUID ownerUserId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        LeaveRequest lr = requestOwnedBy(requestId, ownerUserId, company);
        when(leaveRepo.findById(requestId)).thenReturn(Optional.of(lr));

        LeaveRequestResponseDTO dto = service.getLeaveRequest(ownerUserId, requestId, company);
        assertEquals(requestId.toString(), dto.getRequestId());
    }

    @Test
    void update_deniesRequestOwnedByAnotherUser_andDoesNotSave() {
        UUID company = UUID.randomUUID();
        UUID attacker = UUID.randomUUID();
        UUID victim = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        LeaveRequest lr = requestOwnedBy(requestId, victim, company);
        when(leaveRepo.findById(requestId)).thenReturn(Optional.of(lr));

        assertThrows(LeaveRequestNotFoundException.class,
                () -> service.updateLeaveRequest(attacker, requestId, company, new LeaveRequestUpdateDTO()));
        verify(leaveRepo, never()).save(any());
    }

    @Test
    void delete_deniesRequestOwnedByAnotherUser_andDoesNotDelete() {
        UUID company = UUID.randomUUID();
        UUID attacker = UUID.randomUUID();
        UUID victim = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        LeaveRequest lr = requestOwnedBy(requestId, victim, company);
        when(leaveRepo.findById(requestId)).thenReturn(Optional.of(lr));

        assertThrows(LeaveRequestNotFoundException.class,
                () -> service.deleteLeaveRequest(attacker, requestId, company));
        verify(leaveRepo, never()).delete(any());
        verify(leaveRepo, never()).deleteById(any());
    }

    // ---- list scoping ----

    @Test
    void getAll_isFilteredByCallerCompany() {
        UUID company = UUID.randomUUID();
        UUID ownerUserId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        LeaveRequest lr = requestOwnedBy(requestId, ownerUserId, company);
        when(leaveRepo.findByUser_CompanyId(company)).thenReturn(List.of(lr));

        List<LeaveRequestResponseDTO> result = service.getAllLeaveRequests(company);

        assertEquals(1, result.size());
        assertEquals(requestId.toString(), result.get(0).getRequestId());
        verify(leaveRepo, never()).findAll();
    }

    @Test
    void getAll_withNullCompany_returnsEmptyAndTouchesNoData() {
        assertEquals(List.of(), service.getAllLeaveRequests((UUID) null));
        verifyNoInteractions(leaveRepo);
    }

    @Test
    void getUserRequests_withNullCompany_returnsEmpty() {
        assertEquals(List.of(), service.getUserLeaveRequests(UUID.randomUUID(), null));
        verifyNoInteractions(leaveRepo);
    }

    @Test
    void getUserRequests_isScopedToUserAndCompany() {
        UUID company = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        LeaveRequest lr = requestOwnedBy(requestId, userId, company);
        when(leaveRepo.findAllByUser_UserIdAndUser_CompanyId(userId, company)).thenReturn(List.of(lr));

        List<LeaveRequestResponseDTO> result = service.getUserLeaveRequests(userId, company);

        assertEquals(1, result.size());
        assertEquals(requestId.toString(), result.get(0).getRequestId());
    }
}
