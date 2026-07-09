package com.pm.userservice.dto;

/**
 * Read model for one feedback entry shown in the navbar feedback widget's "read" tab.
 * {@code mine} is resolved per request so the frontend can show edit/delete only on
 * the signed-in user's own entries without leaking author ids for ownership checks.
 */
public class FeedbackEntryDTO {
    private String feedbackId;
    private String authorUserId;
    private String authorName;
    private String category;
    private String status;
    private String body;
    private String createdAt;
    private String updatedAt;
    private boolean mine;

    public String getFeedbackId() { return feedbackId; }
    public void setFeedbackId(String feedbackId) { this.feedbackId = feedbackId; }
    public String getAuthorUserId() { return authorUserId; }
    public void setAuthorUserId(String authorUserId) { this.authorUserId = authorUserId; }
    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
    public boolean isMine() { return mine; }
    public void setMine(boolean mine) { this.mine = mine; }
}
