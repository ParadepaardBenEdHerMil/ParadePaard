package com.pm.userservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A single piece of feedback left through the navbar feedback widget. Feedback is
 * company-wide readable (everyone signed in sees every entry in the "read" tab), so
 * unlike messages there is no conversation grouping. {@code authorName} is a snapshot
 * of the author's display name at write time so the read tab never needs to fan out
 * to the users table.
 */
@Entity
@Table(name = "feedback_entries")
public class FeedbackEntry {
    @Id
    private UUID feedbackId;

    @Column(nullable = false)
    private UUID authorUserId;

    @Column(nullable = false, length = 255)
    private String authorName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private FeedbackCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private FeedbackStatus status;

    @Column(nullable = false, length = 4000)
    private String body;

    @Column(nullable = false)
    private OffsetDateTime createdAt;

    @Column
    private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (feedbackId == null) feedbackId = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
        if (status == null) status = FeedbackStatus.PENDING;
    }

    public UUID getFeedbackId() { return feedbackId; }
    public void setFeedbackId(UUID feedbackId) { this.feedbackId = feedbackId; }
    public UUID getAuthorUserId() { return authorUserId; }
    public void setAuthorUserId(UUID authorUserId) { this.authorUserId = authorUserId; }
    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }
    public FeedbackCategory getCategory() { return category; }
    public void setCategory(FeedbackCategory category) { this.category = category; }
    public FeedbackStatus getStatus() { return status; }
    public void setStatus(FeedbackStatus status) { this.status = status; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
