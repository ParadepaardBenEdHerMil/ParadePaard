package com.pm.timesheetservice.controller;


import com.pm.timesheetservice.dto.TimesheetRequestDTO;
import com.pm.timesheetservice.dto.TimesheetResponseDTO;
import com.pm.timesheetservice.service.TimesheetService;
import com.pm.timesheetservice.dto.validators.CreateTimesheetValidationGroup;
import com.pm.timesheetservice.security.TimesheetPermission;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.groups.Default;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<List<TimesheetResponseDTO>> getTimesheets(){
        List<TimesheetResponseDTO> timesheets = timesheetService.getTimesheets();
        return ResponseEntity.ok().body(timesheets);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a Timesheet by id")
    @PreAuthorize("hasAuthority('ADMIN') or ")
    public ResponseEntity<TimesheetResponseDTO> getTimesheetById(@PathVariable UUID id) {
        TimesheetResponseDTO dto = timesheetService.getTimesheetById(id);
        return ResponseEntity.ok(dto);
    }

    @PostMapping
    @Operation(summary = "Create new Timesheet")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<TimesheetResponseDTO> createTimesheet(@Validated({Default.class, CreateTimesheetValidationGroup.class}) @RequestBody TimesheetRequestDTO timesheetRequestDTO){
        TimesheetResponseDTO timesheetResponseDTO = timesheetService.createTimesheet(timesheetRequestDTO);
        return ResponseEntity.ok().body(timesheetResponseDTO);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a Timesheet")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<TimesheetResponseDTO> updateTimesheet(@PathVariable UUID id, @Validated({Default.class}) @RequestBody TimesheetRequestDTO timesheetRequestDTO){
        TimesheetResponseDTO timesheetResponseDTO = timesheetService.updateTimesheet(id, timesheetRequestDTO);
        return ResponseEntity.ok().body(timesheetResponseDTO);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a Timesheet")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<TimesheetResponseDTO> deleteTimesheet(@PathVariable UUID id){
        timesheetService.deleteTimesheet(id);
        return ResponseEntity.noContent().build();
    }


}
