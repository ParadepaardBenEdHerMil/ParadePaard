package com.pm.authservice.util;

import com.pm.authservice.model.Permission;
import com.pm.authservice.model.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;

@Component
public class JwtUtil {
    private final SecretKey secretKey;
    private static final long ACCESS_TOKEN_VALIDITY = 15 * 60 * 1000; // 15 min
    private static final long REFRESH_TOKEN_VALIDITY = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    public JwtUtil(@Value("${jwt.secret}") String secret) {
        byte[] keyBytes = Base64.getDecoder().decode(secret.getBytes(StandardCharsets.UTF_8));
        this.secretKey = Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateAccessToken(String email, String userId, List<Role> roles, String companyId, int tokenVersion) {
        return generateToken(email, userId, roles, companyId, tokenVersion, ACCESS_TOKEN_VALIDITY);
    }

    public String generateRefreshToken(String email, String userId, List<Role> roles, String companyId, int tokenVersion) {
        return generateToken(email, userId, roles, companyId, tokenVersion, REFRESH_TOKEN_VALIDITY);
    }

    /**
     * C4: the single token builder. Permissions are always derived from the roles'
     * permissions, so there is exactly one place that decides what claims a token
     * carries — removing the risk of issuing a token with the wrong claims from one of
     * several near-identical overloads.
     */
    private String generateToken(String email, String userId, List<Role> roles, String companyId, int tokenVersion, long validityMillis) {
        List<Role> safeRoles = Optional.ofNullable(roles).orElseGet(Collections::emptyList);

        List<String> roleNames = safeRoles.stream()
                .map(Role::getName)
                .filter(Objects::nonNull)
                .toList();

        List<String> permissionNames = safeRoles.stream()
                .flatMap(role -> Optional.ofNullable(role.getPermissions())
                        .orElseGet(Collections::emptyList)
                        .stream())
                .map(Permission::getName)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .toList();

        Instant now = Instant.now();
        Instant expiration = now.plusMillis(validityMillis);

        var builder = Jwts.builder()
                .subject(email)
                .claim("roles", roleNames)
                .claim("permissions", permissionNames)
                .claim("userId", userId)
                .claim("tv", tokenVersion)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiration))
                .signWith(secretKey, Jwts.SIG.HS256);

        if (companyId != null && !companyId.isBlank()) {
            builder.claim("companyId", companyId);
        }

        // only add a single role claim if present
        roleNames.stream().findFirst().ifPresent(r -> builder.claim("role", r));

        return builder.compact();
    }

    /**
     * The token-version ({@code tv}) claim, or 0 when absent. Tokens issued before this
     * claim existed are treated as version 0 so they keep working until the first
     * server-side revocation bumps the user's version (B3).
     */
    public int extractTokenVersion(String token) {
        Object raw = extractClaims(token).get("tv");
        if (raw instanceof Number number) {
            return number.intValue();
        }
        return 0;
    }


    public void validateToken(String token) throws JwtException {parse(token);}

    public Claims extractClaims(String token) {return parse(token).getPayload();}

    public String extractEmail(String token) {return extractClaims(token).getSubject();}

    public List<Role> extractRoles(String token) {
        Object raw = extractClaims(token).get("roles");
        if (raw == null) return Collections.emptyList();

        if (raw instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof String) {
            return ((List<String>) list).stream().map(name -> {
                        Role role = new Role();
                        role.setName(name);
                        return role;
                    })
                    .toList();
        }
        return Collections.emptyList();
    }

    public List<String> extractPermissions(String token) {
        Object raw = extractClaims(token).get("permissions");
        if (raw == null) return Collections.emptyList();

        if (raw instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof String) {
            return ((List<String>) list).stream()
                    .map(s -> s == null ? "" : s.trim())
                    .filter(s -> !s.isEmpty())
                    .distinct()
                    .toList();
        }
        return Collections.emptyList();
    }

    private Jws<Claims> parse(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token);
    }
}
