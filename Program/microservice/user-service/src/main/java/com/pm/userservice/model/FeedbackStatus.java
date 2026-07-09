package com.pm.userservice.model;

/**
 * Triage state of a feedback entry. New feedback starts {@code PENDING}; anyone can
 * mark it {@code FINISHED} once it has been addressed.
 */
public enum FeedbackStatus {
    PENDING,
    FINISHED
}
