package com.pm.userservice.dto;

public class EmployeeTaxProfileDTO {
    private String bsn;
    private Boolean applyLoonheffingskorting;
    private Boolean pensionParticipant;
    private Boolean specialZvwContribution;
    private String payrollNotes;

    public String getBsn() {
        return bsn;
    }

    public void setBsn(String bsn) {
        this.bsn = bsn;
    }

    public Boolean getApplyLoonheffingskorting() {
        return applyLoonheffingskorting;
    }

    public void setApplyLoonheffingskorting(Boolean applyLoonheffingskorting) {
        this.applyLoonheffingskorting = applyLoonheffingskorting;
    }

    public Boolean getPensionParticipant() {
        return pensionParticipant;
    }

    public void setPensionParticipant(Boolean pensionParticipant) {
        this.pensionParticipant = pensionParticipant;
    }

    public Boolean getSpecialZvwContribution() {
        return specialZvwContribution;
    }

    public void setSpecialZvwContribution(Boolean specialZvwContribution) {
        this.specialZvwContribution = specialZvwContribution;
    }

    public String getPayrollNotes() {
        return payrollNotes;
    }

    public void setPayrollNotes(String payrollNotes) {
        this.payrollNotes = payrollNotes;
    }
}
