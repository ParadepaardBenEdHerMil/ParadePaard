package com.pm.planningservice.controller;

import com.pm.planningservice.dto.FinalizePlanningRequestDTO;
import com.pm.planningservice.dto.FinalizePlanningResponseDTO;
import com.pm.planningservice.security.PlanningAuthentication;
import com.pm.planningservice.service.PlanningFinalizationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/planning/finalization")
public class PlanningFinalizationController {
    private final PlanningFinalizationService planningFinalizationService;

    public PlanningFinalizationController(PlanningFinalizationService planningFinalizationService) {
        this.planningFinalizationService = planningFinalizationService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING')")
    public ResponseEntity<FinalizePlanningResponseDTO> finalizePlanning(
            Authentication authentication,
            @Valid @RequestBody FinalizePlanningRequestDTO request) {
        request.setCompanyId(PlanningAuthentication.requireCompanyId(authentication));
        return ResponseEntity.ok(planningFinalizationService.finalizePlanning(request));
    }
}
