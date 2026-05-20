package com.pm.userservice.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.Map;

public class OnboardingReviewUpdateDTO {
    @NotBlank
    private String decision;

    private String note;

    private String status;

    private Map<String, Boolean> checkedSections;

    private OnboardingReviewContractSetupDraftDTO contractSetupDraft;

    public String getDecision() {
        return decision;
    }

    public void setDecision(String decision) {
        this.decision = decision;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Map<String, Boolean> getCheckedSections() {
        return checkedSections;
    }

    public void setCheckedSections(Map<String, Boolean> checkedSections) {
        this.checkedSections = checkedSections;
    }

    public OnboardingReviewContractSetupDraftDTO getContractSetupDraft() {
        return contractSetupDraft;
    }

    public void setContractSetupDraft(OnboardingReviewContractSetupDraftDTO contractSetupDraft) {
        this.contractSetupDraft = contractSetupDraft;
    }
}
