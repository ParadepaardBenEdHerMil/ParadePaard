// src/main/java/com/pm/userservice/service/LeaveRequestService.java
package com.pm.userservice.service;

import com.pm.userservice.dto.LeaveRequestCreateDTO;
import com.pm.userservice.dto.LeaveRequestResponseDTO;
import com.pm.userservice.dto.LeaveRequestUpdateDTO;

import java.util.List;
import java.util.UUID;

public interface LeaveRequestService {
    List<LeaveRequestResponseDTO> getUserLeaveRequests(UUID userId);
    List<LeaveRequestResponseDTO> getAllLeaveRequests();
    List<LeaveRequestResponseDTO> getAllLeaveRequests(String status);
    LeaveRequestResponseDTO getLeaveRequest(UUID requestId);
    LeaveRequestResponseDTO createLeaveRequest(UUID userId, LeaveRequestCreateDTO dto);
    LeaveRequestResponseDTO updateLeaveRequest(UUID requestId, LeaveRequestUpdateDTO dto);
    void deleteLeaveRequest(UUID requestId);
    LeaveRequestResponseDTO approveLeaveRequest(UUID requestId, UUID callerCompanyId, String reason);
    LeaveRequestResponseDTO rejectLeaveRequest(UUID requestId, UUID callerCompanyId, String reason);
}
