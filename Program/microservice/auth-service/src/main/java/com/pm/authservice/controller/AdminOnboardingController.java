package com.pm.authservice.controller;

import com.pm.authservice.dto.AdminEmailSendResponseDTO;
import com.pm.authservice.dto.AdminOnboardUserRequestDTO;
import com.pm.authservice.dto.AdminOnboardUserResponseDTO;
import com.pm.authservice.dto.OnboardingChangesEmailRequestDTO;
import com.pm.authservice.dto.OnboardingRejectedEmailRequestDTO;
import com.pm.authservice.service.AdminOnboardingService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/admin")
public class AdminOnboardingController {
    private final AdminOnboardingService adminOnboardingService;

    public AdminOnboardingController(AdminOnboardingService adminOnboardingService) {
        this.adminOnboardingService = adminOnboardingService;
    }

    @Operation(summary = "Admin creates a new user and sends onboarding email")
    @PreAuthorize("hasAuthority('CAN_ONBOARD_USERS')")
    @PostMapping("/onboard-user")
    public ResponseEntity<AdminOnboardUserResponseDTO> onboardUser(
            @Valid @RequestBody AdminOnboardUserRequestDTO body,
            Authentication authentication) {
        return ResponseEntity.ok(adminOnboardingService.onboardUser(body, authentication));
    }

    @Operation(summary = "Admin resends onboarding password setup email")
    @PreAuthorize("hasAuthority('CAN_ONBOARD_USERS')")
    @PostMapping("/users/{userId}/resend-onboarding-email")
    public ResponseEntity<AdminEmailSendResponseDTO> resendOnboardingEmail(
            @PathVariable UUID userId,
            Authentication authentication) {
        return ResponseEntity.ok(adminOnboardingService.resendOnboardingEmail(userId, authentication));
    }

    @Operation(summary = "Email the employee that onboarding changes are requested")
    @PreAuthorize("hasAuthority('CAN_REVIEW_ONBOARDING')")
    @PostMapping("/users/{userId}/onboarding-changes-email")
    public ResponseEntity<AdminEmailSendResponseDTO> sendOnboardingChangesEmail(
            @PathVariable UUID userId,
            @RequestBody OnboardingChangesEmailRequestDTO body,
            Authentication authentication) {
        return ResponseEntity.ok(adminOnboardingService.sendOnboardingChangesEmail(
                userId, body.getNote(), body.getFlags(), authentication));
    }

    @Operation(summary = "Email the applicant that onboarding was rejected")
    @PreAuthorize("hasAuthority('CAN_REVIEW_ONBOARDING')")
    @PostMapping("/users/{userId}/onboarding-rejected-email")
    public ResponseEntity<AdminEmailSendResponseDTO> sendOnboardingRejectedEmail(
            @PathVariable UUID userId,
            @RequestBody OnboardingRejectedEmailRequestDTO body,
            Authentication authentication) {
        return ResponseEntity.ok(adminOnboardingService.sendOnboardingRejectedEmail(
                userId, body.getReason(), authentication));
    }
}

