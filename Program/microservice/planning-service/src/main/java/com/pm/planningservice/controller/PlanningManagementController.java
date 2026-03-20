package com.pm.planningservice.controller;

import com.pm.planningservice.dto.PlanningAssignmentMutationResponseDTO;
import com.pm.planningservice.dto.PlanningAssignmentSaveRequestDTO;
import com.pm.planningservice.dto.PlanningEventMutationResponseDTO;
import com.pm.planningservice.dto.PlanningEventSaveRequestDTO;
import com.pm.planningservice.dto.PlanningShiftMutationResponseDTO;
import com.pm.planningservice.dto.PlanningShiftSaveRequestDTO;
import com.pm.planningservice.security.PlanningAuthentication;
import com.pm.planningservice.service.PlanningManagementService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/planning")
public class PlanningManagementController {
    private final PlanningManagementService planningManagementService;

    public PlanningManagementController(PlanningManagementService planningManagementService) {
        this.planningManagementService = planningManagementService;
    }

    @PostMapping("/events")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING')")
    public ResponseEntity<?> createEvent(
            Authentication authentication,
            @Valid @RequestBody PlanningEventSaveRequestDTO request
    ) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            UUID userId = PlanningAuthentication.requireUserId(authentication);
            PlanningEventMutationResponseDTO response = planningManagementService.createEvent(companyId, userId, request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PutMapping("/events/{eventId}")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING')")
    public ResponseEntity<?> updateEvent(
            Authentication authentication,
            @PathVariable UUID eventId,
            @Valid @RequestBody PlanningEventSaveRequestDTO request
    ) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            PlanningEventMutationResponseDTO response = planningManagementService.updateEvent(companyId, eventId, request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @DeleteMapping("/events/{eventId}")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING')")
    public ResponseEntity<?> deleteEvent(Authentication authentication, @PathVariable UUID eventId) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            planningManagementService.deleteEvent(companyId, eventId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/events/{eventId}/shifts")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING')")
    public ResponseEntity<?> createShift(
            Authentication authentication,
            @PathVariable UUID eventId,
            @Valid @RequestBody PlanningShiftSaveRequestDTO request
    ) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            PlanningShiftMutationResponseDTO response = planningManagementService.createShift(companyId, eventId, request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PutMapping("/shifts/{shiftId}")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING')")
    public ResponseEntity<?> updateShift(
            Authentication authentication,
            @PathVariable UUID shiftId,
            @Valid @RequestBody PlanningShiftSaveRequestDTO request
    ) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            PlanningShiftMutationResponseDTO response = planningManagementService.updateShift(companyId, shiftId, request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @DeleteMapping("/shifts/{shiftId}")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING')")
    public ResponseEntity<?> deleteShift(Authentication authentication, @PathVariable UUID shiftId) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            planningManagementService.deleteShift(companyId, shiftId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/shifts/{shiftId}/assignments")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING')")
    public ResponseEntity<?> createAssignment(
            Authentication authentication,
            @PathVariable UUID shiftId,
            @Valid @RequestBody PlanningAssignmentSaveRequestDTO request
    ) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            PlanningAssignmentMutationResponseDTO response =
                    planningManagementService.createAssignment(companyId, shiftId, request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PutMapping("/assignments/{scheduleEntryId}")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING')")
    public ResponseEntity<?> updateAssignment(
            Authentication authentication,
            @PathVariable UUID scheduleEntryId,
            @Valid @RequestBody PlanningAssignmentSaveRequestDTO request
    ) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            PlanningAssignmentMutationResponseDTO response =
                    planningManagementService.updateAssignment(companyId, scheduleEntryId, request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @DeleteMapping("/assignments/{scheduleEntryId}")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING')")
    public ResponseEntity<?> deleteAssignment(Authentication authentication, @PathVariable UUID scheduleEntryId) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            planningManagementService.deleteAssignment(companyId, scheduleEntryId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }
}
