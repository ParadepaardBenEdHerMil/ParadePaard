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

    public String generateAccessToken(String email, String userId, List<Role> roles) {
        return generateToken(email, userId, roles, ACCESS_TOKEN_VALIDITY);
    }

    public String generateRefreshToken(String email, String userId, List<Role> roles) {
        return generateToken(email, userId, roles,  REFRESH_TOKEN_VALIDITY);
    }

    public String generateToken(String email, String userId, List<Role> roles, Long validity) {
        List<String> roleNames = roles.stream().map(Role::getName).toList();

        Instant now = Instant.now();
        Instant expiration = now.plusSeconds(validity);

        var builder = Jwts.builder()
                .subject(email)
                .claim("roles", roleNames)
                .claim("userId", userId)
                .claim("role", roleNames.get(0))
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiration))
                .signWith(secretKey, Jwts.SIG.HS256);

        return builder.compact();
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

    private Jws<Claims> parse(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token);
    }
}
