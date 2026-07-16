package com.pm.userservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A reusable, admin-authored email template scoped to a company. Grouped by context
 * ({@link EmailPresetGroup}) and, for reject/request-changes flows, a {@link EmailPresetCategory}.
 */
@Entity
@Table(name = "email_presets")
public class EmailPreset {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private UUID companyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "group_type", nullable = false, length = 32)
    private EmailPresetGroup groupType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private EmailPresetCategory category = EmailPresetCategory.GENERAL;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 255)
    private String subject;

    // Rich HTML (bold / size / colour / lists / links). Resolved for merge fields at send time.
    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private OffsetDateTime updatedAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getCompanyId() {
        return companyId;
    }

    public void setCompanyId(UUID companyId) {
        this.companyId = companyId;
    }

    public EmailPresetGroup getGroupType() {
        return groupType;
    }

    public void setGroupType(EmailPresetGroup groupType) {
        this.groupType = groupType;
    }

    public EmailPresetCategory getCategory() {
        return category;
    }

    public void setCategory(EmailPresetCategory category) {
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

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
