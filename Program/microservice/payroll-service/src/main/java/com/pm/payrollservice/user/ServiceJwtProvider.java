package com.pm.payrollservice.user;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.UUID;

@Component
public class ServiceJwtProvider {
    private final byte[] keyBytes;
    private final String serviceUserId;

    public ServiceJwtProvider(@Value("${jwt.secret}") String secretBase64) {
        this.keyBytes = Base64.getDecoder().decode(secretBase64.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        this.serviceUserId = UUID.nameUUIDFromBytes("payroll-service".getBytes()).toString();
    }

    public String adminToken() {
        try {
            Instant now = Instant.now();
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .subject("payroll-service")
                    .claim("userId", serviceUserId)
                    .claim("roles", List.of("ADMIN"))
                    .claim("permissions", List.of("CAN_VIEW_USERS"))
                    .issueTime(Date.from(now))
                    .expirationTime(Date.from(now.plusSeconds(300)))
                    .build();

            SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
            jwt.sign(new MACSigner(keyBytes));
            return jwt.serialize();
        } catch (JOSEException e) {
            throw new IllegalStateException("Could not sign service JWT", e);
        }
    }
}

