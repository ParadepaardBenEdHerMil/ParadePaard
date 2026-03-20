package com.pm.planningservice.controller;

import com.pm.planningservice.dto.PlanningClientCompanyDTO;
import com.pm.planningservice.dto.PlanningClientCompanySaveRequestDTO;
import com.pm.planningservice.security.PlanningAuthentication;
import com.pm.planningservice.service.PlanningManagementService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/planning/clients")
public class PlanningClientCompanyController {
    private final PlanningManagementService planningManagementService;

    public PlanningClientCompanyController(PlanningManagementService planningManagementService) {
        this.planningManagementService = planningManagementService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING')")
    public ResponseEntity<List<PlanningClientCompanyDTO>> listClientCompanies(Authentication authentication) {
        UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
        return ResponseEntity.ok(planningManagementService.listClientCompanies(companyId));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING')")
    public ResponseEntity<?> createClientCompany(
            Authentication authentication,
            @Valid @RequestBody PlanningClientCompanySaveRequestDTO request
    ) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            PlanningClientCompanyDTO response = planningManagementService.createClientCompany(companyId, request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }
}
