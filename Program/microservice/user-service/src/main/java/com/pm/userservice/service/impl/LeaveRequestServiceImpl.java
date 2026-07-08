// src/main/java/com/pm/userservice/service/impl/LeaveRequestServiceImpl.java
package com.pm.userservice.service.impl;

import com.pm.userservice.dto.AuditLogCreateRequestDTO;
import com.pm.userservice.dto.AuditLogMessagePartDTO;
import com.pm.userservice.dto.LeaveRequestCreateDTO;
import com.pm.userservice.dto.LeaveRequestResponseDTO;
import com.pm.userservice.dto.LeaveRequestUpdateDTO;
import com.pm.userservice.exception.InvalidLeaveRequestStateException;
import com.pm.userservice.exception.LeaveRequestNotFoundException;
import com.pm.userservice.exception.UserNotFoundException;
import com.pm.userservice.mapper.LeaveRequestMapper;
import com.pm.userservice.model.LeaveRequest;
import com.pm.userservice.model.LeaveStatus;
import com.pm.userservice.model.LeaveType;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.LeaveRequestRepository;
import com.pm.userservice.repository.UserRepository;
import com.pm.userservice.service.AuditLogService;
import com.pm.userservice.service.LeaveBalanceService;
import com.pm.userservice.service.LeaveRequestService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

// open-in-view is disabled, so a Hibernate session is not held across the request.
// The response mapper reads the lazily-loaded User association (resolveDisplayName), so
// every method that maps an entity to a DTO must run inside a transaction or it fails
// with LazyInitializationException. The write methods are transactional so their
// multi-step work (e.g. approve: balance draw-down + status change) is atomic.
@Service
@Transactional
public class LeaveRequestServiceImpl implements LeaveRequestService {

    private final LeaveRequestRepository leaveRepo;
    private final UserRepository userRepo;
    private final LeaveBalanceService balanceService;

    // Optional so the many unit tests that build this impl by hand keep working (null =>
    // recordLeaveAudit no-ops). Wired by Spring in production.
    @Autowired(required = false)
    private AuditLogService auditLogService;

    public LeaveRequestServiceImpl(LeaveRequestRepository leaveRepo, UserRepository userRepo,
                                   LeaveBalanceService balanceService) {
        this.leaveRepo = leaveRepo;
        this.userRepo = userRepo;
        this.balanceService = balanceService;
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeaveRequestResponseDTO> getUserLeaveRequests(UUID userId, UUID callerCompanyId) {
        // B4: only return this user's requests when the user belongs to the caller's
        // company. A cross-company (or unscoped) caller sees an empty list rather than
        // another tenant's data.
        if (callerCompanyId == null) {
            return List.of();
        }
        return leaveRepo.findAllByUser_UserIdAndUser_CompanyId(userId, callerCompanyId)
                .stream().map(LeaveRequestMapper::toDTO).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeaveRequestResponseDTO> getAllLeaveRequests(UUID callerCompanyId) {
        // B4: never return every company's data — always filter to the caller's tenant.
        if (callerCompanyId == null) {
            return List.of();
        }
        return leaveRepo.findByUser_CompanyId(callerCompanyId).stream().map(LeaveRequestMapper::toDTO).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<LeaveRequestResponseDTO> getAllLeaveRequests(String status, UUID callerCompanyId) {
        if (callerCompanyId == null) {
            return List.of();
        }
        if (status == null || status.isBlank()) {
            return getAllLeaveRequests(callerCompanyId);
        }
        LeaveStatus st = LeaveStatus.valueOf(status);
        return leaveRepo.findByUser_CompanyIdAndStatus(callerCompanyId, st)
                .stream().map(LeaveRequestMapper::toDTO).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public LeaveRequestResponseDTO getLeaveRequest(UUID userId, UUID requestId, UUID callerCompanyId) {
        LeaveRequest lr = getOwnedOrThrow(userId, requestId, callerCompanyId);
        return LeaveRequestMapper.toDTO(lr);
    }

    @Override
    public LeaveRequestResponseDTO createLeaveRequest(UUID userId, UUID callerCompanyId, LeaveRequestCreateDTO dto) {
        User user = userRepo.findByUserId(userId)
                .orElseThrow(() -> new UserNotFoundException("User " + userId + " not found"));
        // B4: a caller may only create leave for a user inside their own company.
        if (callerCompanyId == null || user.getCompanyId() == null || !user.getCompanyId().equals(callerCompanyId)) {
            throw new UserNotFoundException("User " + userId + " not found");
        }
        LeaveRequest lr = LeaveRequestMapper.toNewEntity(user, dto);
        lr.setRequestId(UUID.randomUUID());
        return LeaveRequestMapper.toDTO(leaveRepo.save(lr));
    }

    @Override
    public LeaveRequestResponseDTO updateLeaveRequest(UUID userId, UUID requestId, UUID callerCompanyId, LeaveRequestUpdateDTO dto) {
        LeaveRequest lr = getOwnedOrThrow(userId, requestId, callerCompanyId);
        LeaveRequestMapper.applyUpdates(lr, dto);
        return LeaveRequestMapper.toDTO(leaveRepo.save(lr));
    }

    @Override
    public void deleteLeaveRequest(UUID userId, UUID requestId, UUID callerCompanyId) {
        LeaveRequest lr = getOwnedOrThrow(userId, requestId, callerCompanyId);
        leaveRepo.delete(lr);
    }

    @Override
    public LeaveRequestResponseDTO approveLeaveRequest(UUID requestId, UUID callerCompanyId, String reason, UUID actorUserId) {
        LeaveRequest lr = getScopedOrThrow(requestId, callerCompanyId);
        requirePending(lr, "approved");
        // Draw down the holiday balance first: if it is insufficient this throws and the
        // request stays PENDING (no partial state change).
        balanceService.reserveForApproval(userIdOf(lr), companyIdOf(lr), yearOf(lr), hoursOf(lr), lr.getType());
        lr.setStatus(LeaveStatus.APPROVED);
        LeaveRequest saved = leaveRepo.save(lr);
        recordLeaveAudit(callerCompanyId, actorUserId, "APPROVED", saved);
        return LeaveRequestMapper.toDTO(saved);
    }

    @Override
    public LeaveRequestResponseDTO rejectLeaveRequest(UUID requestId, UUID callerCompanyId, String reason, UUID actorUserId) {
        LeaveRequest lr = getScopedOrThrow(requestId, callerCompanyId);
        requirePending(lr, "rejected");
        lr.setStatus(LeaveStatus.REJECTED);
        LeaveRequest saved = leaveRepo.save(lr);
        recordLeaveAudit(callerCompanyId, actorUserId, "REJECTED", saved);
        return LeaveRequestMapper.toDTO(saved);
    }

    @Override
    public LeaveRequestResponseDTO cancelLeaveRequest(UUID requestId, UUID callerCompanyId, String reason, UUID actorUserId) {
        LeaveRequest lr = getScopedOrThrow(requestId, callerCompanyId);
        LeaveStatus current = lr.getStatus();
        if (current != LeaveStatus.PENDING && current != LeaveStatus.APPROVED) {
            throw new InvalidLeaveRequestStateException(
                    "Leave request " + lr.getRequestId() + " cannot be canceled because it is " + current);
        }
        // Only an already-approved holiday request has drawn down the balance; give it back.
        if (current == LeaveStatus.APPROVED) {
            balanceService.restore(userIdOf(lr), yearOf(lr), hoursOf(lr), lr.getType());
        }
        lr.setStatus(LeaveStatus.CANCELED);
        LeaveRequest saved = leaveRepo.save(lr);
        recordLeaveAudit(callerCompanyId, actorUserId, "CANCELED", saved);
        return LeaveRequestMapper.toDTO(saved);
    }

    // A leave decision changes an employee's approved time off (and their holiday balance),
    // so it is recorded in the central audit log. The requester link has no explicit label;
    // AuditLogService resolves it to their display name from the user id.
    private void recordLeaveAudit(UUID companyId, UUID actorUserId, String action, LeaveRequest lr) {
        if (auditLogService == null || companyId == null) {
            return;
        }
        UUID requesterId = userIdOf(lr);

        AuditLogMessagePartDTO verb = new AuditLogMessagePartDTO();
        verb.setType("TEXT");
        verb.setText(" " + action.toLowerCase(Locale.ROOT) + " the leave request for ");

        AuditLogMessagePartDTO who = new AuditLogMessagePartDTO();
        who.setType("LINK");
        who.setEntityType("USER");
        who.setEntityId(requesterId == null ? null : requesterId.toString());
        who.setRoute(requesterId == null ? null : "/management/users/" + requesterId);

        AuditLogMessagePartDTO detail = new AuditLogMessagePartDTO();
        detail.setType("TEXT");
        detail.setText(" (" + lr.getType() + " " + lr.getStartDate() + " to " + lr.getEndDate() + ")");

        AuditLogCreateRequestDTO request = new AuditLogCreateRequestDTO();
        request.setCategory("LEAVE");
        request.setAction(action);
        request.setEntityType("LEAVE_REQUEST");
        request.setEntityId(lr.getRequestId() == null ? null : lr.getRequestId().toString());
        request.setMessageParts(List.of(verb, who, detail));

        auditLogService.record(companyId, actorUserId, request);
    }

    private UUID userIdOf(LeaveRequest lr) {
        return lr.getUser() != null ? lr.getUser().getUserId() : null;
    }

    private UUID companyIdOf(LeaveRequest lr) {
        return lr.getUser() != null ? lr.getUser().getCompanyId() : null;
    }

    private int yearOf(LeaveRequest lr) {
        return lr.getStartDate().getYear();
    }

    private int hoursOf(LeaveRequest lr) {
        return lr.getHours() == null ? 0 : lr.getHours();
    }

    /**
     * A leave decision can only be made on a request that is still PENDING.
     * Without this guard an already APPROVED/REJECTED/CANCELED request could be
     * silently flipped to a different outcome.
     */
    private void requirePending(LeaveRequest lr, String action) {
        if (lr.getStatus() != LeaveStatus.PENDING) {
            throw new InvalidLeaveRequestStateException(
                    "Leave request " + lr.getRequestId() + " cannot be " + action
                            + " because it is " + lr.getStatus());
        }
    }

    /**
     * Resolve a request only if it belongs to the caller's company.
     *
     * <p>The decision endpoints are authority-gated (CAN_APPROVE/REJECT_LEAVE_REQUESTS)
     * but an authority is not company-bound: without this guard an admin of company A
     * could approve or reject a leave request owned by an employee of company B by
     * guessing its requestId (cross-tenant IDOR). The leave request's owning company
     * is the company of the requesting user.
     *
     * <p>A cross-company (or unscoped) caller is treated exactly as if the request did
     * not exist — same {@link LeaveRequestNotFoundException} as an unknown id — so the
     * response never reveals whether another company's request exists, and the scope
     * check runs before the PENDING state check so its 409 can't be used as an oracle
     * either.
     */
    private LeaveRequest getScopedOrThrow(UUID requestId, UUID callerCompanyId) {
        LeaveRequest lr = getOrThrow(requestId);
        UUID ownerCompanyId = lr.getUser() != null ? lr.getUser().getCompanyId() : null;
        if (callerCompanyId == null || ownerCompanyId == null || !ownerCompanyId.equals(callerCompanyId)) {
            throw new LeaveRequestNotFoundException("Leave request " + requestId + " not found");
        }
        return lr;
    }

    private LeaveRequest getOrThrow(UUID id) {
        return leaveRepo.findById(id)
                .orElseThrow(() -> new LeaveRequestNotFoundException("Leave request " + id + " not found"));
    }

    /**
     * B4: resolve a request by id only if it both belongs to the {@code userId} in the
     * path and is owned by the caller's company. This closes the IDOR on the by-id
     * endpoints: previously a user who passed the self-check on their own {userId} could
     * supply another person's {requestId} to read, edit, or delete that request. A
     * mismatch on either axis is reported as a plain not-found, so the response never
     * reveals that a request owned by someone else (or another tenant) exists.
     */
    private LeaveRequest getOwnedOrThrow(UUID userId, UUID requestId, UUID callerCompanyId) {
        LeaveRequest lr = getOrThrow(requestId);
        User owner = lr.getUser();
        UUID ownerUserId = owner != null ? owner.getUserId() : null;
        UUID ownerCompanyId = owner != null ? owner.getCompanyId() : null;
        boolean sameUser = userId != null && userId.equals(ownerUserId);
        boolean sameCompany = callerCompanyId != null && callerCompanyId.equals(ownerCompanyId);
        if (!sameUser || !sameCompany) {
            throw new LeaveRequestNotFoundException("Leave request " + requestId + " not found");
        }
        return lr;
    }
}
