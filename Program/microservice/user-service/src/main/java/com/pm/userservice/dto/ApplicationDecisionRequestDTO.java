package com.pm.userservice.dto;

public class ApplicationDecisionRequestDTO {
    private String reviewNote;
    // Optional applicant-facing email. When a subject/body is supplied (e.g. resolved from a
    // reject or request-changes preset on the client) it is sent verbatim to the applicant;
    // when blank a sensible default template is used. The reject vs. request-changes split is
    // enforced by which endpoint is called, never by this payload.
    private String emailSubject;
    private String emailBody;

    public String getReviewNote() {
        return reviewNote;
    }

    public void setReviewNote(String reviewNote) {
        this.reviewNote = reviewNote;
    }

    public String getEmailSubject() {
        return emailSubject;
    }

    public void setEmailSubject(String emailSubject) {
        this.emailSubject = emailSubject;
    }

    public String getEmailBody() {
        return emailBody;
    }

    public void setEmailBody(String emailBody) {
        this.emailBody = emailBody;
    }
}
