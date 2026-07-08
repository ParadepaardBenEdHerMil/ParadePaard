package com.pm.timesheetservice.controller;


import com.pm.timesheetservice.dto.TimesheetRequestDTO;
import com.pm.timesheetservice.dto.PagedResponseDTO;
import com.pm.timesheetservice.dto.TimesheetResponseDTO;
import com.pm.timesheetservice.dto.TimesheetDecisionRequestDTO;
import com.pm.timesheetservice.service.TimesheetService;
import com.pm.timesheetservice.dto.validators.CreateTimesheetValidationGroup;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.groups.Default;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;


@RestController
@RequestMapping("/timesheet")
@Tag(name = "Timesheet", description = "API for managing Timesheets")
public class TimesheetController {
    private final TimesheetService timesheetService;

    public TimesheetController(TimesheetService timesheetService){
        this.timesheetService = timesheetService;
    }

    @GetMapping
    @Operation(summary = "Get all Timesheets")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_TIMESHEETS')")
    public ResponseEntity<List<TimesheetResponseDTO>> getTimesheets(){
        List<TimesheetResponseDTO> timesheets = timesheetService.getTimesheets();
        return ResponseEntity.ok().body(timesheets);
    }

    @GetMapping("/paged")
    @Operation(summary = "Get paged timesheets")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_TIMESHEETS')")
    public ResponseEntity<PagedResponseDTO<TimesheetResponseDTO>> getTimesheetsPage(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        return ResponseEntity.ok(
                timesheetService.getTimesheetsPage(
                        Math.max(page, 0),
                        Math.min(Math.max(size, 1), 100)
                )
        );
    }

    @GetMapping("/me")
    @Operation(summary = "Get my work history (timesheets)")
    @PreAuthorize("hasAnyAuthority('CAN_VIEW_OWN_TIMESHEETS', 'CAN_VIEW_ALL_TIMESHEETS')")
    public ResponseEntity<List<TimesheetResponseDTO>> getMyTimesheets(Authentication authentication) {
        UUID userId = requireUserId(authentication);
        return ResponseEntity.ok(timesheetService.getTimesheetsByUserId(userId));
    }

    @GetMapping("/me/paged")
    @Operation(summary = "Get my paged work history (timesheets)")
    @PreAuthorize("hasAnyAuthority('CAN_VIEW_OWN_TIMESHEETS', 'CAN_VIEW_ALL_TIMESHEETS')")
    public ResponseEntity<PagedResponseDTO<TimesheetResponseDTO>> getMyTimesheetsPage(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        UUID userId = requireUserId(authentication);
        return ResponseEntity.ok(
                timesheetService.getTimesheetsByUserIdPage(
                        userId,
                        Math.max(page, 0),
                        Math.min(Math.max(size, 1), 100)
                )
        );
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a Timesheet by id")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_TIMESHEETS') or (hasAuthority('CAN_VIEW_OWN_TIMESHEETS') and @timesheetPermission.isOwner(#id, authentication))")
    public ResponseEntity<TimesheetResponseDTO> getTimesheetById(@PathVariable UUID id) {
        TimesheetResponseDTO dto = timesheetService.getTimesheetById(id);
        return ResponseEntity.ok(dto);
    }

    @PostMapping
    @Operation(summary = "Create new Timesheet")
    @PreAuthorize("hasAuthority('CAN_MANAGE_TIMESHEETS')")
    public ResponseEntity<TimesheetResponseDTO> createTimesheet(@Validated({Default.class, CreateTimesheetValidationGroup.class}) @RequestBody TimesheetRequestDTO timesheetRequestDTO){
        TimesheetResponseDTO timesheetResponseDTO = timesheetService.createTimesheet(timesheetRequestDTO);
        return ResponseEntity.ok().body(timesheetResponseDTO);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a Timesheet")
    @PreAuthorize("hasAuthority('CAN_MANAGE_TIMESHEETS')")
    public ResponseEntity<TimesheetResponseDTO> updateTimesheet(@PathVariable UUID id, @Validated({Default.class}) @RequestBody TimesheetRequestDTO timesheetRequestDTO){
        TimesheetResponseDTO timesheetResponseDTO = timesheetService.updateTimesheet(id, timesheetRequestDTO);
        return ResponseEntity.ok().body(timesheetResponseDTO);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a Timesheet")
    @PreAuthorize("hasAuthority('CAN_MANAGE_TIMESHEETS')")
    public ResponseEntity<TimesheetResponseDTO> deleteTimesheet(@PathVariable UUID id){
        timesheetService.deleteTimesheet(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/approve")
    @Operation(summary = "Approve a pending timesheet")
    @PreAuthorize("hasAuthority('CAN_MANAGE_TIMESHEETS')")
    public ResponseEntity<TimesheetResponseDTO> approveTimesheet(
            @PathVariable UUID id,
            @RequestBody(required = false) TimesheetDecisionRequestDTO body,
            Authentication authentication) {
        UUID actor = requireUserId(authentication);
        String reason = body == null ? null : body.getReason();
        return ResponseEntity.ok(timesheetService.approveTimesheet(id, actor, reason, bearerToken(authentication)));
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "Reject a pending timesheet")
    @PreAuthorize("hasAuthority('CAN_MANAGE_TIMESHEETS')")
    public ResponseEntity<TimesheetResponseDTO> rejectTimesheet(
            @PathVariable UUID id,
            @RequestBody(required = false) TimesheetDecisionRequestDTO body,
            Authentication authentication) {
        UUID actor = requireUserId(authentication);
        String reason = body == null ? null : body.getReason();
        return ResponseEntity.ok(timesheetService.rejectTimesheet(id, actor, reason, bearerToken(authentication)));
    }

    private UUID requireUserId(Authentication authentication) {
        if (authentication == null) {
            throw new IllegalArgumentException("Missing authentication");
        }

        String raw = authentication.getName();
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            String claim = jwtAuth.getToken().getClaimAsString("userId");
            if (claim != null && !claim.isBlank()) {
                raw = claim;
            }
        }

        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("Missing userId");
        }
        return UUID.fromString(raw);
    }

    // The acting admin's raw access token, forwarded to user-service so the timesheet
    // decision is attributed to them in the central audit log.
    private static String bearerToken(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            return jwtAuth.getToken().getTokenValue();
        }
        return null;
    }

}
