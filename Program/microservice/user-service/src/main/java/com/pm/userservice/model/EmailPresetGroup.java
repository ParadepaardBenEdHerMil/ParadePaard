package com.pm.userservice.model;

/**
 * Which context a preset email belongs to. The context decides where its dropdown appears:
 * a shift detail, a project detail, a user's account page, the application review flow, or the
 * onboarding review flow.
 */
public enum EmailPresetGroup {
    SHIFTS,
    PROJECTS,
    USERS,
    APPLICATIONS,
    ONBOARDING
}
