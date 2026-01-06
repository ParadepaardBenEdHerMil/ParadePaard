package com.pm.timesheetservice.controller;


import com.pm.timesheetservice.dto.TimesheetRequestDTO;
import com.pm.timesheetservice.dto.TimesheetResponseDTO;
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

    @GetMapping("/me")
    @Operation(summary = "Get my work history (timesheets)")
    @PreAuthorize("hasAuthority('CAN_VIEW_OWN_TIMESHEETS')")
    public ResponseEntity<List<TimesheetResponseDTO>> getMyTimesheets(Authentication authentication) {
        UUID userId = requireUserId(authentication);
        return ResponseEntity.ok(timesheetService.getTimesheetsByUserId(userId));
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

}
