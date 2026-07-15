package com.pm.userservice.model;

/**
 * Sub-category within a group. For the APPLICATIONS and ONBOARDING groups this is what keeps a
 * reject email and a request-changes email strictly separated: the reject flow only ever offers
 * REJECT presets and the request-changes flow only ever offers REQUEST_CHANGES presets, so the two
 * can never be crossed. Other groups use GENERAL.
 */
public enum EmailPresetCategory {
    GENERAL,
    REJECT,
    REQUEST_CHANGES
}
