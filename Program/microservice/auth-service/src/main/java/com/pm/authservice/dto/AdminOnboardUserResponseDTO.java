package com.pm.authservice.dto;

public class AdminOnboardUserResponseDTO {
    private String userId;
    private String email;
    private String username;
    private String temporaryPassword;
    private String companyId;
    private Boolean onboardingEmailSent;

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getTemporaryPassword() {
        return temporaryPassword;
    }

    public void setTemporaryPassword(String temporaryPassword) {
        this.temporaryPassword = temporaryPassword;
    }

    public String getCompanyId() {
        return companyId;
    }

    public void setCompanyId(String companyId) {
        this.companyId = companyId;
    }

    public Boolean getOnboardingEmailSent() {
        return onboardingEmailSent;
    }

    public void setOnboardingEmailSent(Boolean onboardingEmailSent) {
        this.onboardingEmailSent = onboardingEmailSent;
    }
}
