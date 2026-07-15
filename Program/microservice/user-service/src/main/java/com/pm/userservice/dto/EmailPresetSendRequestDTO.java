package com.pm.userservice.dto;

import java.util.List;

/**
 * Sends a preset to a resolved set of users (e.g. everyone assigned to a shift or project, or a
 * single account). The caller supplies user ids; the service resolves their email addresses and
 * sends one message each. Applicant reject / request-changes emails do not use this path — those
 * go through the application decision endpoints so the reject vs. request-changes split is enforced.
 */
public class EmailPresetSendRequestDTO {
    private List<String> userIds;

    public List<String> getUserIds() {
        return userIds;
    }

    public void setUserIds(List<String> userIds) {
        this.userIds = userIds;
    }
}
