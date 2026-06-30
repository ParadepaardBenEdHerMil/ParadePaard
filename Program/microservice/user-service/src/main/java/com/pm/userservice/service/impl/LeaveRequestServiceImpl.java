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
import com.pm.userservice.model.User;
import com.pm.userservice.repository.LeaveRequestRepository;
import com.pm.userservice.repository.UserRepository;
import com.pm.userservice.service.LeaveRequestService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class LeaveRequestServiceImpl implements LeaveRequestService {

    private final LeaveRequestRepository leaveRepo;
    private final UserRepository userRepo;

    public LeaveRequestServiceImpl(LeaveRequestRepository leaveRepo, UserRepository userRepo) {
        this.leaveRepo = leaveRepo;
        this.userRepo = userRepo;
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
    public LeaveRequestResponseDTO approveLeaveRequest(UUID requestId, String reason) {
        LeaveRequest lr = getOrThrow(requestId);
        requirePending(lr, "approved");
        lr.setStatus(LeaveStatus.APPROVED);
        return LeaveRequestMapper.toDTO(leaveRepo.save(lr));
    }

    @Override
    public LeaveRequestResponseDTO rejectLeaveRequest(UUID requestId, String reason) {
        LeaveRequest lr = getOrThrow(requestId);
        requirePending(lr, "rejected");
        lr.setStatus(LeaveStatus.REJECTED);
        return LeaveRequestMapper.toDTO(leaveRepo.save(lr));
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

    private LeaveRequest getOrThrow(UUID id) {
        return leaveRepo.findById(id)
                .orElseThrow(() -> new LeaveRequestNotFoundException("Leave request " + id + " not found"));
    }
}
