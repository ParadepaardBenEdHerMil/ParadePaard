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
    public ResponseEntity<List<LeaveRequestResponseDTO>> getUserLeaveRequests(@PathVariable UUID userId) {
        return ResponseEntity.ok(leaveService.getUserLeaveRequests(userId));
    }

    @GetMapping("/leave-requests")
    @Operation(summary = "Get all leave requests, optional status filter, admin only")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_LEAVE_REQUESTS')")
    public ResponseEntity<List<LeaveRequestResponseDTO>> getAllLeaveRequests(
            @RequestParam(value = "status", required = false) String status) {
        return ResponseEntity.ok(leaveService.getAllLeaveRequests(status));
    }

    @GetMapping("/users/{userId}/leave-requests/{requestId}")
    @Operation(summary = "Get a leave request by id self or admin")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_LEAVE_REQUESTS') or @userPermission.isSelf(#userId, authentication)")
    public ResponseEntity<LeaveRequestResponseDTO> getLeaveRequest(
            @PathVariable UUID userId,
            @PathVariable UUID requestId) {
        return ResponseEntity.ok(leaveService.getLeaveRequest(requestId));
    }

    @PostMapping("/users/{userId}/leave-requests")
    @Operation(summary = "Create a leave request self or admin")
    @PreAuthorize("hasAuthority('CAN_MANAGE_LEAVE_REQUESTS') or @userPermission.isSelf(#userId, authentication)")
    public ResponseEntity<LeaveRequestResponseDTO> createLeaveRequest(
            @PathVariable UUID userId,
            @Validated({Default.class}) @RequestBody LeaveRequestCreateDTO dto) {
        return ResponseEntity.ok(leaveService.createLeaveRequest(userId, dto));
    }

    @PutMapping("/users/{userId}/leave-requests/{requestId}")
    @Operation(summary = "Update a leave request self or admin")
    @PreAuthorize("hasAuthority('CAN_MANAGE_LEAVE_REQUESTS') or @userPermission.isSelf(#userId, authentication)")
    public ResponseEntity<LeaveRequestResponseDTO> updateLeaveRequest(
            @PathVariable UUID userId,
            @PathVariable UUID requestId,
            @Validated({Default.class}) @RequestBody LeaveRequestUpdateDTO dto) {
        return ResponseEntity.ok(leaveService.updateLeaveRequest(requestId, dto));
    }

    @DeleteMapping("/users/{userId}/leave-requests/{requestId}")
    @Operation(summary = "Delete a leave request self or admin")
    @PreAuthorize("hasAuthority('CAN_MANAGE_LEAVE_REQUESTS') or @userPermission.isSelf(#userId, authentication)")
    public ResponseEntity<Void> deleteLeaveRequest(
            @PathVariable UUID userId,
            @PathVariable UUID requestId) {
        leaveService.deleteLeaveRequest(requestId);
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
                leaveService.approveLeaveRequest(requestId, companyId, body != null ? body.getReason() : null));
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
                leaveService.rejectLeaveRequest(requestId, companyId, body != null ? body.getReason() : null));
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
                leaveService.cancelLeaveRequest(requestId, companyId, body != null ? body.getReason() : null));
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
}
