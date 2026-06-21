package com.pm.planningservice.controller;

import com.pm.planningservice.dto.BillingRateSaveRequestDTO;
import com.pm.planningservice.security.PlanningAuthentication;
import com.pm.planningservice.service.BillingRateService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/planning/billing-rates")
public class BillingRateController {
    private final BillingRateService billingRateService;

    public BillingRateController(BillingRateService billingRateService) {
        this.billingRateService = billingRateService;
    }

    @GetMapping("/clients/{clientCompanyId}")
    @PreAuthorize("hasAnyAuthority('CAN_VIEW_BILLING_RATES','CAN_MANAGE_BILLING_RATES')")
    public ResponseEntity<?> listClientBillingRates(Authentication authentication, @PathVariable UUID clientCompanyId) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            return ResponseEntity.ok(billingRateService.listClientBillingRates(companyId, clientCompanyId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @GetMapping("/users/{userId}")
    @PreAuthorize("hasAnyAuthority('CAN_VIEW_BILLING_RATES','CAN_MANAGE_BILLING_RATES')")
    public ResponseEntity<?> listUserBillingRates(Authentication authentication, @PathVariable UUID userId) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            return ResponseEntity.ok(billingRateService.listUserBillingRates(companyId, userId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/clients/{clientCompanyId}/defaults")
    @PreAuthorize("hasAuthority('CAN_MANAGE_BILLING_RATES')")
    public ResponseEntity<?> saveClientDefaultRate(
            Authentication authentication,
            @PathVariable UUID clientCompanyId,
            @Valid @RequestBody BillingRateSaveRequestDTO request
    ) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            UUID userId = PlanningAuthentication.requireUserId(authentication);
            return ResponseEntity.ok(billingRateService.saveClientDefaultRate(companyId, userId, clientCompanyId, request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/clients/{clientCompanyId}/project-rates")
    @PreAuthorize("hasAuthority('CAN_MANAGE_BILLING_RATES')")
    public ResponseEntity<?> saveProjectRate(
            Authentication authentication,
            @PathVariable UUID clientCompanyId,
            @Valid @RequestBody BillingRateSaveRequestDTO request
    ) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            UUID userId = PlanningAuthentication.requireUserId(authentication);
            return ResponseEntity.ok(billingRateService.saveProjectRate(companyId, userId, clientCompanyId, request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/clients/{clientCompanyId}/employee-overrides")
    @PreAuthorize("hasAuthority('CAN_MANAGE_BILLING_RATES')")
    public ResponseEntity<?> saveClientEmployeeOverride(
            Authentication authentication,
            @PathVariable UUID clientCompanyId,
            @Valid @RequestBody BillingRateSaveRequestDTO request
    ) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            UUID userId = PlanningAuthentication.requireUserId(authentication);
            return ResponseEntity.ok(billingRateService.saveClientEmployeeOverride(companyId, userId, clientCompanyId, request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/clients/{clientCompanyId}/project-employee-overrides")
    @PreAuthorize("hasAuthority('CAN_MANAGE_BILLING_RATES')")
    public ResponseEntity<?> saveProjectEmployeeOverride(
            Authentication authentication,
            @PathVariable UUID clientCompanyId,
            @Valid @RequestBody BillingRateSaveRequestDTO request
    ) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            UUID userId = PlanningAuthentication.requireUserId(authentication);
            return ResponseEntity.ok(billingRateService.saveProjectEmployeeOverride(companyId, userId, clientCompanyId, request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @DeleteMapping("/clients/{clientCompanyId}/{scope}/{rateId}")
    @PreAuthorize("hasAuthority('CAN_MANAGE_BILLING_RATES')")
    public ResponseEntity<?> deleteBillingRate(
            Authentication authentication,
            @PathVariable UUID clientCompanyId,
            @PathVariable String scope,
            @PathVariable UUID rateId
    ) {
        try {
            UUID companyId = PlanningAuthentication.requireCompanyId(authentication);
            billingRateService.deleteBillingRate(companyId, clientCompanyId, scope, rateId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }
}
