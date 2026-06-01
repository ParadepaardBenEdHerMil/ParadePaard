package com.pm.authservice.service;

import com.pm.authservice.dto.ResetPasswordErrorResponseDTO;
import com.pm.authservice.model.PasswordResetToken;
import com.pm.authservice.model.User;
import com.pm.authservice.repository.PasswordResetTokenRepository;
import com.pm.authservice.repository.UserRepository;
import com.pm.authservice.util.PasswordResetTokenUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class PasswordResetService {
    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailSender emailSender;
    private final Duration tokenTtl;
    private final String frontendResetUrl;
    private final String hmacSecret;

    public PasswordResetService(
            UserRepository userRepository,
            PasswordResetTokenRepository tokenRepository,
            PasswordEncoder passwordEncoder,
            EmailSender emailSender,
            @Value("${password-reset.token-ttl:PT15M}") Duration tokenTtl,
            @Value("${password-reset.frontend-reset-url:http://localhost:5173/reset-password}") String frontendResetUrl,
            @Value("${password-reset.hmac-secret:}") String hmacSecret
    ) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailSender = emailSender;
        this.tokenTtl = tokenTtl;
        this.frontendResetUrl = frontendResetUrl;
        this.hmacSecret = (hmacSecret == null) ? "" : hmacSecret.trim();
    }

    public static final class IssuedResetToken {
        private final String token;
        private final String resetUrl;
        private final Duration ttl;

        public IssuedResetToken(String token, String resetUrl, Duration ttl) {
            this.token = token;
            this.resetUrl = resetUrl;
            this.ttl = ttl;
        }

        public String getToken() {
            return token;
        }

        public String getResetUrl() {
            return resetUrl;
        }

        public Duration getTtl() {
            return ttl;
        }
    }

    @Transactional
    public ResponseEntity<Void> requestPasswordReset(String rawEmail) {
        try {
            String email = normalizeEmail(rawEmail);

            List<User> users = userRepository.findAllByEmail(email);
            if (users.isEmpty()) {
                return ResponseEntity.noContent().build();
            }

            for (User user : users) {
                Optional<IssuedResetToken> issuedOpt = issueResetToken(user);
                if (issuedOpt.isEmpty()) {
                    continue;
                }
                IssuedResetToken issued = issuedOpt.get();
                try {
                    emailSender.sendPasswordResetEmail(user.getEmail(), issued.getResetUrl(), issued.getTtl());
                } catch (Exception e) {
                    log.error("Failed to send password reset email", e);
                }
            }

            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            log.error("Failed to handle forgot-password request", e);
            return ResponseEntity.noContent().build();
        }
    }

    // Stable error codes returned in the response body so the frontend can show
    // a tailored message and so logs/clients can branch on the specific failure.
    public static final String ERR_MISSING_TOKEN = "MISSING_TOKEN";
    public static final String ERR_INVALID_TOKEN = "INVALID_TOKEN";
    public static final String ERR_EXPIRED_TOKEN = "EXPIRED_TOKEN";
    public static final String ERR_TOKEN_ALREADY_USED = "TOKEN_ALREADY_USED";
    public static final String ERR_USER_NOT_FOUND = "USER_NOT_FOUND";
    public static final String ERR_SERVER_MISCONFIGURED = "SERVER_MISCONFIGURED";

    @Transactional
    public ResponseEntity<?> resetPassword(String rawToken, String newPassword) {
        if (hmacSecret.isBlank()) {
            return ResponseEntity.internalServerError().body(new ResetPasswordErrorResponseDTO(
                    ERR_SERVER_MISCONFIGURED,
                    "Password reset is temporarily unavailable. Please contact support."
            ));
        }

        String token = (rawToken == null) ? "" : rawToken.trim();
        if (token.isEmpty()) {
            return ResponseEntity.badRequest().body(new ResetPasswordErrorResponseDTO(
                    ERR_MISSING_TOKEN,
                    "Reset token is missing. Please open the link from your password reset email again."
            ));
        }

        String tokenHash = PasswordResetTokenUtil.hmacSha256Hex(hmacSecret, token);
        Optional<PasswordResetToken> rowOpt = tokenRepository.findByTokenHash(tokenHash);
        if (rowOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(new ResetPasswordErrorResponseDTO(
                    ERR_INVALID_TOKEN,
                    "This password reset link is not valid. Please request a new one."
            ));
        }

        PasswordResetToken row = rowOpt.get();
        Instant now = Instant.now();
        if (row.getUsedAt() != null) {
            return ResponseEntity.badRequest().body(new ResetPasswordErrorResponseDTO(
                    ERR_TOKEN_ALREADY_USED,
                    "This reset link has already been used. Please request a new one to change your password again."
            ));
        }
        if (row.getExpiresAt().isBefore(now)) {
            return ResponseEntity.badRequest().body(new ResetPasswordErrorResponseDTO(
                    ERR_EXPIRED_TOKEN,
                    "Your password reset link has expired. Reset links are valid for "
                            + formatTtl(tokenTtl) + ". Please request a new one."
            ));
        }

        UUID userId = row.getUserId();
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(new ResetPasswordErrorResponseDTO(
                    ERR_USER_NOT_FOUND,
                    "We could not find an account for this reset link. Please request a new one."
            ));
        }

        User user = userOpt.get();
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(false);
        userRepository.save(user);

        row.setUsedAt(now);
        tokenRepository.save(row);
        tokenRepository.deleteAllByUserIdAndTokenHashNot(userId, tokenHash);

        return ResponseEntity.noContent().build();
    }

    private static String formatTtl(Duration ttl) {
        if (ttl == null) return "a limited time";
        long minutes = ttl.toMinutes();
        if (minutes >= 60 && minutes % 60 == 0) {
            long hours = minutes / 60;
            return hours + (hours == 1 ? " hour" : " hours");
        }
        if (minutes > 0) {
            return minutes + (minutes == 1 ? " minute" : " minutes");
        }
        return ttl.getSeconds() + " seconds";
    }

    @Transactional
    public Optional<IssuedResetToken> issueResetToken(User user) {
        try {
            if (user == null || user.getId() == null) {
                return Optional.empty();
            }
            if (hmacSecret.isBlank()) {
                log.error("password-reset.hmac-secret is not configured; refusing to issue password reset tokens");
                return Optional.empty();
            }

            Instant now = Instant.now();
            tokenRepository.deleteAllByExpiresAtBefore(now);
            tokenRepository.deleteAllByUserIdAndUsedAtIsNull(user.getId());

            String token = PasswordResetTokenUtil.generateToken();
            String tokenHash = PasswordResetTokenUtil.hmacSha256Hex(hmacSecret, token);

            PasswordResetToken row = new PasswordResetToken();
            row.setUserId(user.getId());
            row.setTokenHash(tokenHash);
            row.setCreatedAt(now);
            row.setExpiresAt(now.plus(tokenTtl));
            tokenRepository.save(row);

            String resetUrl = UriComponentsBuilder
                    .fromUriString(frontendResetUrl)
                    .queryParam("token", token)
                    .build()
                    .toUriString();

            return Optional.of(new IssuedResetToken(token, resetUrl, tokenTtl));
        } catch (Exception e) {
            log.error("Failed to issue reset token", e);
            return Optional.empty();
        }
    }

    private static String normalizeEmail(String email) {
        if (email == null) return "";
        return email.trim().toLowerCase();
    }
}
