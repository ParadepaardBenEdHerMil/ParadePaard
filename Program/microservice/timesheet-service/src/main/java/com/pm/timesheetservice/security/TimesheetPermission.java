package com.pm.timesheetservice.security;

import com.pm.timesheetservice.model.Timesheet;
import com.pm.timesheetservice.repository.TimesheetRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

@Component("timesheetPermission")
public class TimesheetPermission {
    private static final Logger log = LoggerFactory.getLogger(TimesheetPermission.class);
    private final TimesheetRepository repo;

    public TimesheetPermission(TimesheetRepository repo) {
        this.repo = repo;
    }

    public boolean isOwner(UUID timesheetId, Authentication auth) {
        if (auth == null) {
            log.warn("Authentication is null for timesheetId={}", timesheetId);
            return false;
        }
        if (!(auth.getPrincipal() instanceof Jwt jwt)) {
            log.warn("Principal is not JWT for timesheetId={}", timesheetId);
            return false;
        }

        UUID currentUserId = extractUserId(jwt);
        if (currentUserId == null) {
            log.warn("Missing userId claim in JWT for timesheetId={}", timesheetId);
            return false;
        }

        Optional<Timesheet> timesheetOpt = repo.findById(timesheetId);
        if (timesheetOpt.isEmpty()) {
            log.warn("Timesheet not found: timesheetId={}", timesheetId);
            return false;
        }

        UUID ownerId = timesheetOpt.get().getUserId();
        boolean isOwner = currentUserId.equals(ownerId);

        log.debug("Permission check currentUserId={} ownerId={} timesheetId={} result={}",
                currentUserId, ownerId, timesheetId, isOwner ? "GRANTED" : "DENIED");

        return isOwner;
    }

    private UUID extractUserId(Jwt jwt) {
        // try common claim names first
        String[] keys = new String[] { "userId", "user_id", "uid", "userid", "UserId" };
        for (String k : keys) {
            Object v = jwt.getClaims().get(k);
            if (v instanceof String s && !s.isBlank()) {
                try {
                    return parseFlexibleUUID(s.trim());
                } catch (IllegalArgumentException ignore) {
                    // not a uuid, keep trying
                }
            }
        }
        // finally, try sub if it looks like a uuid
        String sub = jwt.getSubject();
        if (sub != null && !sub.isBlank()) {
            try {
                return parseFlexibleUUID(sub.trim());
            } catch (IllegalArgumentException ignore) {
                // sub is not a uuid, give up
            }
        }
        return null;
    }

    private UUID parseFlexibleUUID(String value) {
        if (value.indexOf('-') >= 0) {
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
