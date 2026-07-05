package com.pm.userservice.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * S1: shared-secret authentication for the internal {@code /users/public/**} endpoints,
 * which are meant for service-to-service calls (payroll, planning) — not the browser.
 *
 * <p>Enforcement is opt-in by configuration: when {@code internal.service.token} is set,
 * those endpoints require the matching {@code X-Internal-Service-Token} header (or a
 * normal user JWT, for the display-names case). When it is left blank (the default in
 * local dev and tests) the endpoints keep their previous behaviour, so nothing breaks
 * before the secret is rolled out. Production MUST set INTERNAL_SERVICE_TOKEN.
 */
@Component
public class InternalServiceTokenService {

    public static final String HEADER = "X-Internal-Service-Token";
    public static final String INTERNAL_SERVICE_AUTHORITY = "INTERNAL_SERVICE";

    private final String token;

    public InternalServiceTokenService(@Value("${internal.service.token:}") String token) {
        this.token = token == null ? "" : token.trim();
    }

    /** True when a token is configured and enforcement is therefore active. */
    public boolean isConfigured() {
        return !token.isEmpty();
    }

    /** Constant-time comparison of a presented token against the configured one. */
    public boolean matches(String presented) {
        if (!isConfigured() || presented == null) {
            return false;
        }
        return MessageDigest.isEqual(
                token.getBytes(StandardCharsets.UTF_8),
                presented.trim().getBytes(StandardCharsets.UTF_8));
    }
}
