package com.pm.planningservice.integration;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

public interface UserDirectoryClient {
    Map<UUID, String> getDisplayNamesByUserIds(Set<UUID> userIds);
}
