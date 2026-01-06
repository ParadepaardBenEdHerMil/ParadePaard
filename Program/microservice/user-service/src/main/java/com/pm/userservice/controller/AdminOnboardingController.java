package com.pm.userservice.controller;

import com.pm.userservice.dto.AdminOnboardingRequestDTO;
import com.pm.userservice.dto.AdminOnboardingResponseDTO;
import com.pm.userservice.security.TokenExtractor;
import com.pm.userservice.service.OnboardingService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin")
public class AdminOnboardingController {

    private final OnboardingService onboardingService;

    public AdminOnboardingController(OnboardingService onboardingService) {
        this.onboardingService = onboardingService;
    }

    @PostMapping("/onboarding")
    @PreAuthorize("hasAuthority('CAN_ONBOARD_USERS')")
    public ResponseEntity<AdminOnboardingResponseDTO> adminOnboarding(
            @Valid @RequestBody AdminOnboardingRequestDTO request,
            HttpServletRequest httpServletRequest) {
        String accessToken = TokenExtractor.extractAccessToken(httpServletRequest);
        AdminOnboardingResponseDTO response = onboardingService.adminOnboard(request, accessToken);
        return ResponseEntity.ok(response);
    }
}
