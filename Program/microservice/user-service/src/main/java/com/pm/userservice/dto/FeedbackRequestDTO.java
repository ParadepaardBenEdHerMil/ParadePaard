package com.pm.userservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Payload for creating or updating a feedback entry. {@code category} is validated
 * against the {@link com.pm.userservice.model.FeedbackCategory} names so an unknown
 * value fails with a clean 400 rather than a 500 on enum conversion.
 */
public class FeedbackRequestDTO {
    @NotBlank
    @Pattern(regexp = "FEATURE|BUG|CLEANUP", message = "category must be FEATURE, BUG or CLEANUP")
    private String category;

    @NotBlank
    @Size(max = 4000)
    private String body;

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
}
