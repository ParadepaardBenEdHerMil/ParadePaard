package com.pm.planningservice.controller;

import com.pm.planningservice.dto.OpenShiftDTO;
import com.pm.planningservice.security.PlanningAuthentication;
import com.pm.planningservice.service.ShiftApplicationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/planning/open-shifts")
public class ShiftApplicationController {
    private final ShiftApplicationService shiftApplicationService;

    public ShiftApplicationController(ShiftApplicationService shiftApplicationService) {
        this.shiftApplicationService = shiftApplicationService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING') or hasAuthority('CAN_VIEW_OWN_TIMESHEETS')")
    public ResponseEntity<List<OpenShiftDTO>> getOpenShifts(Authentication authentication) {
        UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
        UUID userId = PlanningAuthentication.requireUserId(authentication);
        return ResponseEntity.ok(shiftApplicationService.getOpenShifts(companyId, userId));
    }

    @PostMapping("/{shiftId}/application")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING') or hasAuthority('CAN_VIEW_OWN_TIMESHEETS')")
    public ResponseEntity<?> apply(Authentication authentication, @PathVariable UUID shiftId) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            UUID userId = PlanningAuthentication.requireUserId(authentication);
            return ResponseEntity.ok(shiftApplicationService.apply(companyId, userId, shiftId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @DeleteMapping("/{shiftId}/application")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING') or hasAuthority('CAN_VIEW_OWN_TIMESHEETS')")
    public ResponseEntity<?> withdraw(Authentication authentication, @PathVariable UUID shiftId) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            UUID userId = PlanningAuthentication.requireUserId(authentication);
            return ResponseEntity.ok(shiftApplicationService.withdraw(companyId, userId, shiftId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }
}
