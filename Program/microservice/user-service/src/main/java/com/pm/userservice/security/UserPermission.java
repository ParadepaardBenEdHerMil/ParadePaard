// src/main/java/com/pm/userservice/security/UserPermission.java
package com.pm.userservice.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component("userPermission")
public class UserPermission {
    private static final Logger log = LoggerFactory.getLogger(UserPermission.class);

    public boolean isSelf(UUID targetUserId, Authentication auth) {
        if (auth == null) {
            log.warn("Authentication is null for userId={}", targetUserId);
            return false;
        }
        if (!(auth.getPrincipal() instanceof Jwt jwt)) {
            log.warn("Principal is not JWT for userId={}", targetUserId);
            return false;
        }

        UUID current = extractUserId(jwt);
        if (current == null) {
            log.warn("Missing userId claim in JWT for userId={}", targetUserId);
            return false;
        }

        boolean ok = current.equals(targetUserId);
        log.debug("User self check current={} target={} result={}",
                current, targetUserId, ok ? "GRANTED" : "DENIED");
        return ok;
    }

    private UUID extractUserId(Jwt jwt) {
        String[] keys = new String[] { "userId", "user_id", "uid", "userid", "UserId" };
        for (String k : keys) {
            Object v = jwt.getClaims().get(k);
            if (v instanceof String s && !s.isBlank()) {
                try {
                    return parseFlexibleUUID(s.trim());
                } catch (IllegalArgumentException ignore) { }
            }
        }
        String sub = jwt.getSubject();
        if (sub != null && !sub.isBlank()) {
            try {
                return parseFlexibleUUID(sub.trim());
            } catch (IllegalArgumentException ignore) { }
        }
        return null;
    }

    private UUID parseFlexibleUUID(String value) {
        if (value.contains("-")) {
            return UUID.fromString(value);
        }
        if (value.length() == 32) {
            String formatted = value.replaceFirst(
                    "(\\w{8})(\\w{4})(\\w{4})(\\w{4})(\\w{12})",
                    "$1-$2-$3-$4-$5"
            );
            return UUID.fromString(formatted);
        }
        return UUID.fromString(value);
    }
}
