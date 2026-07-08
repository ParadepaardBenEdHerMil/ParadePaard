package com.pm.userservice.controller;

import com.pm.userservice.dto.AuditLogCreateRequestDTO;
import com.pm.userservice.dto.AuditLogEntryDTO;
import com.pm.userservice.dto.PagedResponseDTO;
import com.pm.userservice.service.AuditLogService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping
public class AuditLogController {
    private final AuditLogService auditLogService;

    public AuditLogController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @PostMapping("/internal/audit-log")
    @PreAuthorize(
            "hasAnyAuthority(" +
                    "'CAN_MANAGE_COMPANY'," +
                    "'CAN_MANAGE_USERS'," +
                    "'CAN_DELETE_USERS'," +
                    "'CAN_CREATE_ROLE'," +
                    "'CAN_EDIT_ROLES'," +
                    "'CAN_DELETE_ROLES'," +
                    "'CAN_ASSIGN_ROLES'," +
                    "'CAN_REMOVE_ROLES'," +
                    "'CAN_APPROVE_LEAVE_REQUESTS'," +
                    "'CAN_REJECT_LEAVE_REQUESTS'," +
                    "'CAN_MANAGE_LEAVE_REQUESTS'," +
                    "'CAN_REVIEW_ONBOARDING'," +
                    "'CAN_REVIEW_APPLICATIONS'," +
                    "'CAN_MANAGE_MESSAGES'," +
                    "'CAN_MANAGE_PLANNING'," +
                    "'CAN_MANAGE_TIMESHEETS'," +
                    "'CAN_VIEW_OWN_TIMESHEETS'," +
                    "'CAN_VIEW_BILLING_RATES'," +
                    "'CAN_MANAGE_BILLING_RATES'," +
                    "'CAN_MANAGE_CONTRACTS'," +
                    "'CAN_REVIEW_CONTRACTS'," +
                    "'CAN_FINALIZE_CONTRACT'," +
                    "'CAN_SIGN_OWN_CONTRACTS'," +
                    "'CAN_MANAGE_PAYSLIPS'," +
                    "'CAN_REVIEW_PAYSLIPS'," +
                    "'CAN_REPORT_PAYSLIP_ERRORS'," +
                    "'CAN_VIEW_PAYROLL_FINANCE'," +
                    "'CAN_MANAGE_PAYROLL_FINANCE'" +
                    ")"
    )
    public ResponseEntity<AuditLogEntryDTO> record(Authentication authentication, @RequestBody AuditLogCreateRequestDTO request) {
        return ResponseEntity.ok(auditLogService.record(resolveCompanyId(authentication), resolveUserId(authentication), request));
    }

    @GetMapping("/admin/audit-log")
    @PreAuthorize("hasAuthority('CAN_MANAGE_COMPANY')")
    public ResponseEntity<PagedResponseDTO<AuditLogEntryDTO>> list(
            Authentication authentication,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) UUID actorUserId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate occurredFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate occurredTo,
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        return ResponseEntity.ok(
                auditLogService.list(
                        resolveCompanyId(authentication),
                        category,
                        action,
                        entityType,
                        actorUserId,
                        occurredFrom,
                        occurredTo,
                        query,
                        Math.max(page, 0),
                        Math.min(Math.max(size, 1), 200)
                )
        );
    }

    private UUID resolveCompanyId(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwtAuthenticationToken) {
            String companyId = jwtAuthenticationToken.getToken().getClaimAsString("companyId");
            if (companyId != null && !companyId.isBlank()) {
                return UUID.fromString(companyId);
            }
        }
        throw new IllegalArgumentException("Missing companyId claim");
    }

    private UUID resolveUserId(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwtAuthenticationToken) {
            String userId = jwtAuthenticationToken.getToken().getClaimAsString("userId");
            if (userId != null && !userId.isBlank()) {
                return UUID.fromString(userId);
            }
        }
        if (authentication != null && authentication.getName() != null && !authentication.getName().isBlank()) {
            return UUID.fromString(authentication.getName());
        }
        throw new IllegalArgumentException("Missing userId claim");
    }
}
