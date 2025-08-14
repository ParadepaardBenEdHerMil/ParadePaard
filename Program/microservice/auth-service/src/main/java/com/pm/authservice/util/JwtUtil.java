package com.pm.authservice.util;

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
import java.util.Base64;
import java.util.Collections;
import java.util.Date;
import java.util.List;

@Component
public class JwtUtil {
    private final SecretKey secretKey;

    public JwtUtil(@Value("${jwt.secret}") String secret) {
        byte[] keyBytes = Base64.getDecoder().decode(secret.getBytes(StandardCharsets.UTF_8));
        this.secretKey = Keys.hmacShaKeyFor(keyBytes);
    }

    // preferred call, includes userId claim
    public String generateToken(String email, String userId, List<Role> roles) {
        List<String> roleNames = roles == null
                ? Collections.emptyList()
                : roles.stream().map(Role::getName).toList();

        long now = System.currentTimeMillis();

        var builder = Jwts.builder()
                .subject(email)
                .claim("roles", roleNames)
                .issuedAt(new Date(now))
                .expiration(new Date(now + 1000L * 60 * 60 * 10)) // 10 hours
                .signWith(secretKey, Jwts.SIG.HS256);

        if (userId != null && !userId.isBlank()) {
            builder.claim("userId", userId);
        }

        // keep a single "role" claim too if there is exactly one role
        if (roleNames.size() == 1) {
            builder.claim("role", roleNames.get(0));
        }

        return builder.compact();
    }

    public void validateToken(String token) throws JwtException {
        parse(token); // throws if invalid
    }

    public Claims extractClaims(String token) {
        return parse(token).getPayload();
    }

    public String extractEmail(String token) {
        return extractClaims(token).getSubject();
    }

    public List<String> extractRoles(String token) {
        Object raw = extractClaims(token).get("roles");
        if (raw instanceof List<?> list) {
            return list.stream().map(Object::toString).toList();
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
