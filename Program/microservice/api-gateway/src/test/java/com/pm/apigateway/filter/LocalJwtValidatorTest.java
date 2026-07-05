package com.pm.apigateway.filter;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * S2: the gateway validates access-token signature and expiry locally.
 */
class LocalJwtValidatorTest {

    private static final String SECRET = Base64.getEncoder()
            .encodeToString("gateway-test-secret-key-that-is-long-enough-0123456789".getBytes(StandardCharsets.UTF_8));

    private final LocalJwtValidator validator = new LocalJwtValidator(SECRET);

    private static SecretKey key(String base64Secret) {
        return Keys.hmacShaKeyFor(Base64.getDecoder().decode(base64Secret.getBytes(StandardCharsets.UTF_8)));
    }

    private String token(String signingSecret, long expiryOffsetMillis) {
        Date now = new Date();
        return Jwts.builder()
                .subject("user@acme.test")
                .claim("userId", "u1")
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expiryOffsetMillis))
                .signWith(key(signingSecret), Jwts.SIG.HS256)
                .compact();
    }

    @Test
    void validSignatureAndNotExpired_isValid() {
        assertThat(validator.isValid(token(SECRET, 60_000))).isTrue();
    }

    @Test
    void expiredToken_isInvalid() {
        assertThat(validator.isValid(token(SECRET, -1_000))).isFalse();
    }

    @Test
    void wrongSigningKey_isInvalid() {
        String otherSecret = Base64.getEncoder()
                .encodeToString("a-totally-different-secret-key-long-enough-9876543210".getBytes(StandardCharsets.UTF_8));
        assertThat(validator.isValid(token(otherSecret, 60_000))).isFalse();
    }

    @Test
    void garbageOrBlank_isInvalid() {
        assertThat(validator.isValid("not-a-jwt")).isFalse();
        assertThat(validator.isValid("")).isFalse();
        assertThat(validator.isValid(null)).isFalse();
    }
}
