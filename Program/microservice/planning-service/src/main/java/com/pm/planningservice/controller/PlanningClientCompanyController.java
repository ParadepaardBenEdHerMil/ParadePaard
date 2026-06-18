package com.pm.planningservice.controller;

import com.pm.planningservice.dto.PlanningClientCompanyDTO;
import com.pm.planningservice.dto.PlanningClientCompanySaveRequestDTO;
import com.pm.planningservice.dto.PagedResponseDTO;
import com.pm.planningservice.security.PlanningAuthentication;
import com.pm.planningservice.service.PlanningManagementService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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

    @GetMapping("/paged")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING')")
    public ResponseEntity<PagedResponseDTO<PlanningClientCompanyDTO>> listClientCompaniesPage(
            Authentication authentication,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") int page,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "50") int size
    ) {
        UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
        return ResponseEntity.ok(
                planningManagementService.listClientCompaniesPage(
                        companyId,
                        Math.max(page, 0),
                        Math.min(Math.max(size, 1), 100)
                )
        );
    }

    @PostMapping
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING')")
    public ResponseEntity<?> createClientCompany(
            Authentication authentication,
            @Valid @RequestBody PlanningClientCompanySaveRequestDTO request,
            HttpServletRequest httpRequest
    ) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            PlanningClientCompanyDTO response = planningManagementService.createClientCompany(
                    companyId,
                    request,
                    PlanningAuthentication.bearerToken(httpRequest)
            );
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PutMapping("/{clientCompanyId}")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING')")
    public ResponseEntity<?> updateClientCompany(
            Authentication authentication,
            @PathVariable UUID clientCompanyId,
            @Valid @RequestBody PlanningClientCompanySaveRequestDTO request,
            HttpServletRequest httpRequest
    ) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            PlanningClientCompanyDTO response =
                    planningManagementService.updateClientCompany(
                            companyId,
                            clientCompanyId,
                            request,
                            PlanningAuthentication.bearerToken(httpRequest)
                    );
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @DeleteMapping("/{clientCompanyId}")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING')")
    public ResponseEntity<?> deleteClientCompany(
            Authentication authentication,
            @PathVariable UUID clientCompanyId,
            HttpServletRequest httpRequest
    ) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            planningManagementService.deleteClientCompany(
                    companyId,
                    clientCompanyId,
                    PlanningAuthentication.bearerToken(httpRequest)
            );
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }
}
