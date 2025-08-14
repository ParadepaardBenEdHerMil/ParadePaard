// src/main/java/com/pm/contractservice/security/ContractPermission.java
package com.pm.contractservice.security;

import com.pm.contractservice.model.Contract;
import com.pm.contractservice.repository.ContractRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

@Component("contractPermission")
public class ContractPermission {
    private static final Logger log = LoggerFactory.getLogger(ContractPermission.class);
    private final ContractRepository repo;

    public ContractPermission(ContractRepository repo) {
        this.repo = repo;
    }

    public boolean isOwner(UUID contractId, Authentication auth) {
        if (auth == null) {
            log.warn("Authentication is null for contractId={}", contractId);
            return false;
        }
        if (!(auth.getPrincipal() instanceof Jwt jwt)) {
            log.warn("Principal is not JWT for contractId={}", contractId);
            return false;
        }

        UUID currentUserId = extractUserId(jwt);
        if (currentUserId == null) {
            log.warn("Missing userId claim in JWT for contractId={}", contractId);
            return false;
        }

        Optional<Contract> contractOpt = repo.findById(contractId);
        if (contractOpt.isEmpty()) {
            log.warn("Contract not found contractId={}", contractId);
            return false;
        }

        UUID ownerId = contractOpt.get().getUserId();
        boolean isOwner = currentUserId.equals(ownerId);

        log.debug("Permission check currentUserId={} ownerId={} contractId={} result={}",
                currentUserId, ownerId, contractId, isOwner ? "GRANTED" : "DENIED");

        return isOwner;
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
