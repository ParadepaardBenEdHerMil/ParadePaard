package com.pm.apigateway.filter;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * S2: verifies an access token's signature and expiry locally, using the same HS256
 * secret as auth-service, instead of making a per-request HTTP call to
 * {@code auth-service /validate}. This removes a network round-trip from every proxied
 * request and stops auth-service being a hot-path single point of failure.
 *
 * <p>Revocation is still honoured: access tokens are short-lived (15 min), and the
 * refresh flow — which mints new access tokens — remains a remote call to auth-service,
 * where the per-user token version (B3) is enforced. So a logout/disable/password-reset
 * stops new access tokens within one access-token lifetime.
 */
@Component
public class LocalJwtValidator {

    private static final Logger log = LoggerFactory.getLogger(LocalJwtValidator.class);

    private final SecretKey secretKey;

    public LocalJwtValidator(@Value("${jwt.secret}") String secret) {
        byte[] keyBytes = Base64.getDecoder().decode(secret.getBytes(StandardCharsets.UTF_8));
        this.secretKey = Keys.hmacShaKeyFor(keyBytes);
    }

    /** True when the token's signature is valid and it has not expired. */
    public boolean isValid(String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        try {
            Jwts.parser()
                    .verifyWith(secretKey)
                    .build()
                    .parseSignedClaims(token); // throws on bad signature or expiry
            return true;
        } catch (JwtException | IllegalArgumentException ex) {
            log.debug("Local JWT validation failed: {}", ex.getMessage());
            return false;
        }
    }
}
