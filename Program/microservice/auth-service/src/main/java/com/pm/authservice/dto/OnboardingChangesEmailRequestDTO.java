package com.pm.authservice.dto;

import java.util.List;

/**
 * Body for the "request changes" onboarding email: the reviewer's overall note plus the
 * per-field flags already formatted as display lines ("Section - Field: explanation").
 */
public class OnboardingChangesEmailRequestDTO {
    private String note;
    private List<String> flags;

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public List<String> getFlags() {
        return flags;
    }

    public void setFlags(List<String> flags) {
        this.flags = flags;
    }
}
