// src/main/java/com/pm/userservice/controller/LeaveRequestController.java
package com.pm.userservice.controller;

import com.pm.userservice.dto.LeaveBalanceResponseDTO;
import com.pm.userservice.dto.LeaveDecisionDTO;
import com.pm.userservice.dto.LeaveRequestCreateDTO;
import com.pm.userservice.dto.LeaveRequestResponseDTO;
import com.pm.userservice.dto.LeaveRequestUpdateDTO;
import com.pm.userservice.service.LeaveBalanceService;
import com.pm.userservice.service.LeaveRequestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.groups.Default;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping
@Tag(name = "Leave Requests", description = "API for managing leave requests")
public class LeaveRequestController {

    private final LeaveRequestService leaveService;
    private final LeaveBalanceService balanceService;

    public LeaveRequestController(LeaveRequestService leaveService, LeaveBalanceService balanceService) {
        this.leaveService = leaveService;
        this.balanceService = balanceService;
    }

    @GetMapping("/users/{userId}/leave-requests")
    @Operation(summary = "Get leave requests for a user self or admin")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_LEAVE_REQUESTS') or @userPermission.isSelf(#userId, authentication)")
    public ResponseEntity<List<LeaveRequestResponseDTO>> getUserLeaveRequests(
            Authentication authentication,
            @PathVariable UUID userId) {
        UUID companyId = resolveCompanyId(authentication);
        return ResponseEntity.ok(leaveService.getUserLeaveRequests(userId, companyId));
    }

    @GetMapping("/leave-requests")
    @Operation(summary = "Get all leave requests, optional status filter, admin only")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_LEAVE_REQUESTS')")
    public ResponseEntity<List<LeaveRequestResponseDTO>> getAllLeaveRequests(
            Authentication authentication,
            @RequestParam(value = "status", required = false) String status) {
        UUID companyId = resolveCompanyId(authentication);
        return ResponseEntity.ok(leaveService.getAllLeaveRequests(status, companyId));
    }

    @GetMapping("/users/{userId}/leave-requests/{requestId}")
    @Operation(summary = "Get a leave request by id self or admin")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_LEAVE_REQUESTS') or @userPermission.isSelf(#userId, authentication)")
    public ResponseEntity<LeaveRequestResponseDTO> getLeaveRequest(
            Authentication authentication,
            @PathVariable UUID userId,
            @PathVariable UUID requestId) {
        UUID companyId = resolveCompanyId(authentication);
        return ResponseEntity.ok(leaveService.getLeaveRequest(userId, requestId, companyId));
    }

    @PostMapping("/users/{userId}/leave-requests")
    @Operation(summary = "Create a leave request self or admin")
    @PreAuthorize("hasAuthority('CAN_MANAGE_LEAVE_REQUESTS') or @userPermission.isSelf(#userId, authentication)")
    public ResponseEntity<LeaveRequestResponseDTO> createLeaveRequest(
            Authentication authentication,
            @PathVariable UUID userId,
            @Validated({Default.class}) @RequestBody LeaveRequestCreateDTO dto) {
        UUID companyId = resolveCompanyId(authentication);
        return ResponseEntity.ok(leaveService.createLeaveRequest(userId, companyId, dto));
    }

    @PutMapping("/users/{userId}/leave-requests/{requestId}")
    @Operation(summary = "Update a leave request self or admin")
    @PreAuthorize("hasAuthority('CAN_MANAGE_LEAVE_REQUESTS') or @userPermission.isSelf(#userId, authentication)")
    public ResponseEntity<LeaveRequestResponseDTO> updateLeaveRequest(
            Authentication authentication,
            @PathVariable UUID userId,
            @PathVariable UUID requestId,
            @Validated({Default.class}) @RequestBody LeaveRequestUpdateDTO dto) {
        UUID companyId = resolveCompanyId(authentication);
        return ResponseEntity.ok(leaveService.updateLeaveRequest(userId, requestId, companyId, dto));
    }

    @DeleteMapping("/users/{userId}/leave-requests/{requestId}")
    @Operation(summary = "Delete a leave request self or admin")
    @PreAuthorize("hasAuthority('CAN_MANAGE_LEAVE_REQUESTS') or @userPermission.isSelf(#userId, authentication)")
    public ResponseEntity<Void> deleteLeaveRequest(
            Authentication authentication,
            @PathVariable UUID userId,
            @PathVariable UUID requestId) {
        UUID companyId = resolveCompanyId(authentication);
        leaveService.deleteLeaveRequest(userId, requestId, companyId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/leave-requests/{requestId}/approve")
    @Operation(summary = "Approve a leave request, admin only")
    @PreAuthorize("hasAuthority('CAN_APPROVE_LEAVE_REQUESTS')")
    public ResponseEntity<LeaveRequestResponseDTO> approveLeaveRequest(
            Authentication authentication,
            @PathVariable UUID requestId,
            @RequestBody(required = false) LeaveDecisionDTO body) {
        UUID companyId = resolveCompanyId(authentication);
        return ResponseEntity.ok(
                leaveService.approveLeaveRequest(requestId, companyId, body != null ? body.getReason() : null,
                        resolveUserId(authentication)));
    }

    @PutMapping("/leave-requests/{requestId}/reject")
    @Operation(summary = "Reject a leave request, admin only")
    @PreAuthorize("hasAuthority('CAN_REJECT_LEAVE_REQUESTS')")
    public ResponseEntity<LeaveRequestResponseDTO> rejectLeaveRequest(
            Authentication authentication,
            @PathVariable UUID requestId,
            @RequestBody(required = false) LeaveDecisionDTO body) {
        UUID companyId = resolveCompanyId(authentication);
        return ResponseEntity.ok(
                leaveService.rejectLeaveRequest(requestId, companyId, body != null ? body.getReason() : null,
                        resolveUserId(authentication)));
    }

    @PutMapping("/leave-requests/{requestId}/cancel")
    @Operation(summary = "Cancel a leave request, restoring balance if it was approved")
    @PreAuthorize("hasAuthority('CAN_MANAGE_LEAVE_REQUESTS')")
    public ResponseEntity<LeaveRequestResponseDTO> cancelLeaveRequest(
            Authentication authentication,
            @PathVariable UUID requestId,
            @RequestBody(required = false) LeaveDecisionDTO body) {
        UUID companyId = resolveCompanyId(authentication);
        return ResponseEntity.ok(
                leaveService.cancelLeaveRequest(requestId, companyId, body != null ? body.getReason() : null,
                        resolveUserId(authentication)));
    }

    @GetMapping("/users/{userId}/leave-balance")
    @Operation(summary = "Get an employee's holiday-hours balance for a year, self or admin")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_LEAVE_REQUESTS') or @userPermission.isSelf(#userId, authentication)")
    public ResponseEntity<LeaveBalanceResponseDTO> getLeaveBalance(
            @PathVariable UUID userId,
            @RequestParam(value = "year", required = false) Integer year) {
        int resolvedYear = year != null ? year : LocalDate.now().getYear();
        return ResponseEntity.ok(balanceService.getBalance(userId, resolvedYear));
    }

    /**
     * The caller's company is taken from the verified JWT (the {@code companyId} claim),
     * never from the request body, so a leave decision is always scoped to the admin's
     * own tenant. Mirrors UserController#resolveCompanyId.
     */
    private UUID resolveCompanyId(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            String claim = jwtAuth.getToken().getClaimAsString("companyId");
            if (claim != null && !claim.isBlank()) {
                return UUID.fromString(claim.trim());
            }
        }
        return null;
    }

    /** The acting admin who made the leave decision, taken from the verified JWT. */
    private UUID resolveUserId(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            String claim = jwtAuth.getToken().getClaimAsString("userId");
            if (claim != null && !claim.isBlank()) {
                return UUID.fromString(claim.trim());
            }
        }
        return null;
    }
}
