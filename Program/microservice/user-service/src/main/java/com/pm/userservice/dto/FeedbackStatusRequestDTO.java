package com.pm.userservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * Payload for flipping a feedback entry's triage status. Validated against the
 * {@link com.pm.userservice.model.FeedbackStatus} names so an unknown value 400s cleanly.
 */
public class FeedbackStatusRequestDTO {
    @NotBlank
    @Pattern(regexp = "PENDING|FINISHED", message = "status must be PENDING or FINISHED")
    private String status;

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
