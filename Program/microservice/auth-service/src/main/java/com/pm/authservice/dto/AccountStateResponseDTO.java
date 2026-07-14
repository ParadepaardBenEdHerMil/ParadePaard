package com.pm.authservice.dto;

/**
 * Exposes the auth-account gate to admin UIs so the Users page can show "Disabled" and gate
 * the resend-onboarding action until the account has been re-enabled.
 */
public class AccountStateResponseDTO {
    private String userId;
    private boolean disabled;

    public AccountStateResponseDTO() {
    }

    public AccountStateResponseDTO(String userId, boolean disabled) {
        this.userId = userId;
        this.disabled = disabled;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public boolean isDisabled() {
        return disabled;
    }

    public void setDisabled(boolean disabled) {
        this.disabled = disabled;
    }
}
