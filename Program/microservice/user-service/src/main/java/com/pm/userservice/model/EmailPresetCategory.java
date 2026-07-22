package com.pm.userservice.model;

/**
 * Sub-category within a group. For the APPLICATIONS and ONBOARDING groups this is what keeps the
 * decision emails strictly separated: the reject flow only ever offers REJECT presets, the
 * request-changes flow only ever offers REQUEST_CHANGES presets, and (applications only) the accept
 * flow only ever offers ACCEPT presets, so the categories can never be crossed. Other groups use
 * GENERAL.
 */
public enum EmailPresetCategory {
    GENERAL,
    REJECT,
    REQUEST_CHANGES,
    ACCEPT
}
