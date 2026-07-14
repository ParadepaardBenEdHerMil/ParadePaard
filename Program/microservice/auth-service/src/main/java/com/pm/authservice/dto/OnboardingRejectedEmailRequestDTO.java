package com.pm.authservice.dto;

/**
 * Body for the onboarding rejection email: the reviewer's reason, shown to the applicant.
 */
public class OnboardingRejectedEmailRequestDTO {
    private String reason;

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
