// src/main/java/com/pm/userservice/service/LeaveRequestService.java
package com.pm.userservice.service;

import com.pm.userservice.dto.LeaveRequestCreateDTO;
import com.pm.userservice.dto.LeaveRequestResponseDTO;
import com.pm.userservice.dto.LeaveRequestUpdateDTO;

import java.util.List;
import java.util.UUID;

public interface LeaveRequestService {
    // B4: reads/writes are scoped to the caller's company, and the by-id operations also
    // verify the request belongs to the {userId} in the path (defeating cross-tenant
    // leaks and same-authority IDOR via a guessed requestId).
    List<LeaveRequestResponseDTO> getUserLeaveRequests(UUID userId, UUID callerCompanyId);
    List<LeaveRequestResponseDTO> getAllLeaveRequests(UUID callerCompanyId);
    List<LeaveRequestResponseDTO> getAllLeaveRequests(String status, UUID callerCompanyId);
    LeaveRequestResponseDTO getLeaveRequest(UUID userId, UUID requestId, UUID callerCompanyId);
    LeaveRequestResponseDTO createLeaveRequest(UUID userId, UUID callerCompanyId, LeaveRequestCreateDTO dto);
    LeaveRequestResponseDTO updateLeaveRequest(UUID userId, UUID requestId, UUID callerCompanyId, LeaveRequestUpdateDTO dto);
    void deleteLeaveRequest(UUID userId, UUID requestId, UUID callerCompanyId);
    LeaveRequestResponseDTO approveLeaveRequest(UUID requestId, UUID callerCompanyId, String reason);
    LeaveRequestResponseDTO rejectLeaveRequest(UUID requestId, UUID callerCompanyId, String reason);
    LeaveRequestResponseDTO cancelLeaveRequest(UUID requestId, UUID callerCompanyId, String reason);
}
