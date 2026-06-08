package com.pm.userservice.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class PlatformCompanyOnboardingRequestDTO {
    @NotBlank
    private String companyName;

    @NotBlank
    private String adminFirstNames;

    private String adminMiddleNamePrefix;

    @NotBlank
    private String adminLastName;

    @NotBlank
    @Email
    private String adminEmail;

    public String getCompanyName() {
        return companyName;
    }

    public void setCompanyName(String companyName) {
        this.companyName = companyName;
    }

    public String getAdminFirstNames() {
        return adminFirstNames;
    }

    public void setAdminFirstNames(String adminFirstNames) {
        this.adminFirstNames = adminFirstNames;
    }

    public String getAdminMiddleNamePrefix() {
        return adminMiddleNamePrefix;
    }

    public void setAdminMiddleNamePrefix(String adminMiddleNamePrefix) {
        this.adminMiddleNamePrefix = adminMiddleNamePrefix;
    }

    public String getAdminLastName() {
        return adminLastName;
    }

    public void setAdminLastName(String adminLastName) {
        this.adminLastName = adminLastName;
    }

    public String getAdminEmail() {
        return adminEmail;
    }

    public void setAdminEmail(String adminEmail) {
        this.adminEmail = adminEmail;
    }
}
