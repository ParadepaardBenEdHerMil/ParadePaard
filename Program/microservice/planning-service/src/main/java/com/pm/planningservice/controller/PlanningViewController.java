package com.pm.planningservice.controller;

import com.pm.planningservice.dto.PlanningViewResponseDTO;
import com.pm.planningservice.security.PlanningAuthentication;
import com.pm.planningservice.service.PlanningViewService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/planning")
public class PlanningViewController {
    private final PlanningViewService planningViewService;

    public PlanningViewController(PlanningViewService planningViewService) {
        this.planningViewService = planningViewService;
    }

    @GetMapping("/view")
    public ResponseEntity<List<PlanningViewResponseDTO>> getPlanningView(
            Authentication authentication,
            @RequestParam(required = false) UUID companyId,
            @RequestParam(required = false) UUID eventId) {
        UUID companyIdFromToken = PlanningAuthentication.requireCompanyId(authentication);
        if (companyId != null && !companyIdFromToken.equals(companyId)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(planningViewService.getPlanningHierarchy(companyIdFromToken, eventId));
    }
}
