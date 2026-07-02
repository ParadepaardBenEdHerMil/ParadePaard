// src/main/java/com/pm/userservice/service/impl/LeaveRequestServiceImpl.java
package com.pm.userservice.service.impl;

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
import com.pm.userservice.service.LeaveBalanceService;
import com.pm.userservice.service.LeaveRequestService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class LeaveRequestServiceImpl implements LeaveRequestService {

    private final LeaveRequestRepository leaveRepo;
    private final UserRepository userRepo;
    private final LeaveBalanceService balanceService;

    public LeaveRequestServiceImpl(LeaveRequestRepository leaveRepo, UserRepository userRepo,
                                   LeaveBalanceService balanceService) {
        this.leaveRepo = leaveRepo;
        this.userRepo = userRepo;
        this.balanceService = balanceService;
    }

    @Override
    public List<LeaveRequestResponseDTO> getUserLeaveRequests(UUID userId) {
        return leaveRepo.findAllByUser_UserId(userId).stream().map(LeaveRequestMapper::toDTO).toList();
    }

    @Override
    public List<LeaveRequestResponseDTO> getAllLeaveRequests() {
        return leaveRepo.findAll().stream().map(LeaveRequestMapper::toDTO).toList();
    }

    @Override
    public List<LeaveRequestResponseDTO> getAllLeaveRequests(String status) {
        if (status == null || status.isBlank()) {
            return getAllLeaveRequests();
        }
        LeaveStatus st = LeaveStatus.valueOf(status);
        return leaveRepo.findByStatus(st).stream().map(LeaveRequestMapper::toDTO).toList();
    }

    @Override
    public LeaveRequestResponseDTO getLeaveRequest(UUID requestId) {
        LeaveRequest lr = getOrThrow(requestId);
        return LeaveRequestMapper.toDTO(lr);
    }

    @Override
    public LeaveRequestResponseDTO createLeaveRequest(UUID userId, LeaveRequestCreateDTO dto) {
        User user = userRepo.findByUserId(userId)
                .orElseThrow(() -> new UserNotFoundException("User " + userId + " not found"));
        LeaveRequest lr = LeaveRequestMapper.toNewEntity(user, dto);
        lr.setRequestId(UUID.randomUUID());
        return LeaveRequestMapper.toDTO(leaveRepo.save(lr));
    }

    @Override
    public LeaveRequestResponseDTO updateLeaveRequest(UUID requestId, LeaveRequestUpdateDTO dto) {
        LeaveRequest lr = getOrThrow(requestId);
        LeaveRequestMapper.applyUpdates(lr, dto);
        return LeaveRequestMapper.toDTO(leaveRepo.save(lr));
    }

    @Override
    public void deleteLeaveRequest(UUID requestId) {
        if (!leaveRepo.existsById(requestId)) {
            throw new LeaveRequestNotFoundException("Leave request " + requestId + " not found");
        }
        leaveRepo.deleteById(requestId);
    }

    @Override
    public LeaveRequestResponseDTO approveLeaveRequest(UUID requestId, UUID callerCompanyId, String reason) {
        LeaveRequest lr = getScopedOrThrow(requestId, callerCompanyId);
        requirePending(lr, "approved");
        // Draw down the holiday balance first: if it is insufficient this throws and the
        // request stays PENDING (no partial state change).
        balanceService.reserveForApproval(userIdOf(lr), companyIdOf(lr), yearOf(lr), hoursOf(lr), lr.getType());
        lr.setStatus(LeaveStatus.APPROVED);
        return LeaveRequestMapper.toDTO(leaveRepo.save(lr));
    }

    @Override
    public LeaveRequestResponseDTO rejectLeaveRequest(UUID requestId, UUID callerCompanyId, String reason) {
        LeaveRequest lr = getScopedOrThrow(requestId, callerCompanyId);
        requirePending(lr, "rejected");
        lr.setStatus(LeaveStatus.REJECTED);
        return LeaveRequestMapper.toDTO(leaveRepo.save(lr));
    }

    @Override
    public LeaveRequestResponseDTO cancelLeaveRequest(UUID requestId, UUID callerCompanyId, String reason) {
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
        return LeaveRequestMapper.toDTO(leaveRepo.save(lr));
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
}
