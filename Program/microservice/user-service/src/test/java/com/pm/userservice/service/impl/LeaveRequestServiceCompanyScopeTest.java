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
 *
 * <p>{@code /leave-requests/{id}/approve} and {@code .../reject} are gated only by the
 * {@code CAN_APPROVE/REJECT_LEAVE_REQUESTS} authority, which is not company-bound. Before the
 * scope guard, an admin of company A could approve or reject a leave request owned by an
 * employee of company B simply by guessing its requestId (an IDOR / horizontal privilege
 * escalation). These tests pin that the decision is always scoped to the caller's own company
 * and that a cross-company probe is indistinguishable from an unknown id.
 */
class LeaveRequestServiceCompanyScopeTest {

    private final LeaveRequestRepository leaveRepo = mock(LeaveRequestRepository.class);
    private final UserRepository userRepo = mock(UserRepository.class);
    private final LeaveRequestServiceImpl service = new LeaveRequestServiceImpl(leaveRepo, userRepo);

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

    // ---- deny: another company's request ----

    @Test
    void approve_deniesRequestOwnedByAnotherCompany() {
        UUID callerCompany = UUID.randomUUID();   // admin is scoped into company A
        UUID ownerCompany = UUID.randomUUID();     // the request belongs to company B
        UUID requestId = UUID.randomUUID();        // attacker guesses company B's requestId
        LeaveRequest lr = requestOwnedBy(requestId, ownerCompany, LeaveStatus.PENDING);
        when(leaveRepo.findById(requestId)).thenReturn(Optional.of(lr));

        assertThrows(LeaveRequestNotFoundException.class,
                () -> service.approveLeaveRequest(requestId, callerCompany, "ok"));

        // The other company's request is untouched and nothing is persisted.
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

    /**
     * The scope check must run before the PENDING state check. Otherwise an attacker could
     * distinguish "exists but already decided" (409) from "unknown id" (not found) and use the
     * decision endpoint as an existence oracle across tenants. A cross-company request that is
     * already APPROVED must still come back as not-found, never as a 409 state conflict.
     */
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

    // ---- deny: unscoped caller (missing companyId claim) ----

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

    // ---- allow: same company ----

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

    /**
     * Same-company callers still get the LV-2 PENDING-only guard: scope being satisfied must
     * not weaken the state machine.
     */
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
