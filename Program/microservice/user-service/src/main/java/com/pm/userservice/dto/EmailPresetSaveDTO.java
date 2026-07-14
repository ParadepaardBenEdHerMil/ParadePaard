package com.pm.userservice.dto;

import jakarta.validation.constraints.NotBlank;

public class EmailPresetSaveDTO {
    @NotBlank
    private String groupType;
    // Optional; defaults to GENERAL. Must be REJECT or REQUEST_CHANGES for APPLICATIONS/ONBOARDING.
    private String category;
    @NotBlank
    private String name;
    @NotBlank
    private String subject;
    @NotBlank
    private String body;

    public String getGroupType() {
        return groupType;
    }

    public void setGroupType(String groupType) {
        this.groupType = groupType;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }
}
