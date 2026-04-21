package com.pm.planningservice.controller;

import com.pm.planningservice.service.EmployeePlanningService;
import com.pm.planningservice.dto.PlanningViewResponseDTO;
import com.pm.planningservice.security.PlanningAuthentication;
import com.pm.planningservice.service.PlanningViewService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/planning")
public class PlanningViewController {
    private final PlanningViewService planningViewService;
    private final EmployeePlanningService employeePlanningService;

    public PlanningViewController(
            PlanningViewService planningViewService,
            EmployeePlanningService employeePlanningService
    ) {
        this.planningViewService = planningViewService;
        this.employeePlanningService = employeePlanningService;
    }

    @GetMapping("/view")
    public ResponseEntity<List<PlanningViewResponseDTO>> getPlanningView(
            Authentication authentication,
            @RequestParam(required = false) UUID companyId,
            @RequestParam(required = false) UUID eventId,
            @RequestParam(required = false) LocalDate startDate,
            @RequestParam(required = false) LocalDate endDate,
            @RequestParam(defaultValue = "true") boolean includeAllocationDetails) {
        UUID companyIdFromToken = PlanningAuthentication.requireCompanyId(authentication);
        if (companyId != null && !companyIdFromToken.equals(companyId)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(planningViewService.getPlanningHierarchy(
                companyIdFromToken,
                eventId,
                startDate,
                endDate,
                includeAllocationDetails
        ));
    }

    @GetMapping("/assignments/{scheduleEntryId}")
    @PreAuthorize("hasAnyAuthority('CAN_VIEW_ALL_TIMESHEETS', 'CAN_MANAGE_TIMESHEETS')")
    public ResponseEntity<?> getAssignmentDetailForAdmin(
            Authentication authentication,
            @PathVariable UUID scheduleEntryId
    ) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            return ResponseEntity.ok(employeePlanningService.getAssignmentDetailForAdmin(companyId, scheduleEntryId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", ex.getMessage()));
        }
    }
}
