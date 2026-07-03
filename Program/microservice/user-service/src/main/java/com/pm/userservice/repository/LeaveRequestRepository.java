// src/main/java/com/pm/userservice/repository/LeaveRequestRepository.java
package com.pm.userservice.repository;

import com.pm.userservice.model.LeaveRequest;
import com.pm.userservice.model.LeaveStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, UUID> {
    List<LeaveRequest> findAllByUser_UserId(UUID userId);
    List<LeaveRequest> findByUser_UserId(UUID userId);
    List<LeaveRequest> findByStatus(LeaveStatus status);
    List<LeaveRequest> findByUser_UserIdAndStatus(UUID userId, LeaveStatus status);

    // B4: company-scoped variants. A leave request's owning company is the company of
    // the requesting user, so every cross-tenant read is filtered on user.companyId.
    List<LeaveRequest> findAllByUser_UserIdAndUser_CompanyId(UUID userId, UUID companyId);
    List<LeaveRequest> findByUser_CompanyId(UUID companyId);
    List<LeaveRequest> findByUser_CompanyIdAndStatus(UUID companyId, LeaveStatus status);
}
