package com.pm.planningservice.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.UUID;

public final class PlanningAuthentication {

    private PlanningAuthentication() {
    }

    public static UUID requireCompanyId(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwtAuthenticationToken) {
            String claim = jwtAuthenticationToken.getToken().getClaimAsString("companyId");
            if (claim != null && !claim.isBlank()) {
                return UUID.fromString(claim.trim());
            }
        }
        throw new IllegalArgumentException("Missing companyId");
    }

    public static UUID requireUserId(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwtAuthenticationToken) {
            String claim = jwtAuthenticationToken.getToken().getClaimAsString("userId");
            if (claim != null && !claim.isBlank()) {
                return UUID.fromString(claim.trim());
            }
        }
        throw new IllegalArgumentException("Missing userId");
    }
}
