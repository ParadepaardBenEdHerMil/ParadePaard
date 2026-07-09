package com.pm.userservice.model;

/**
 * The kind of feedback a user is leaving from the navbar feedback widget.
 * Stored as a string so new categories can be added without a numeric migration.
 */
public enum FeedbackCategory {
    FEATURE,
    BUG,
    CLEANUP
}
