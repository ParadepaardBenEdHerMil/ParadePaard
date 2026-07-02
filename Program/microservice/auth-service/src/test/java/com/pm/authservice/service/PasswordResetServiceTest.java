package com.pm.authservice.service;

import com.pm.authservice.dto.ResetPasswordErrorResponseDTO;
import com.pm.authservice.model.PasswordResetToken;
import com.pm.authservice.model.User;
import com.pm.authservice.repository.PasswordResetTokenRepository;
import com.pm.authservice.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PasswordResetServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final PasswordResetTokenRepository tokenRepository = mock(PasswordResetTokenRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final EmailSender emailSender = mock(EmailSender.class);

    @Test
    void resetLinkCanOnlyBeUsedOnce() {
        String hmacSecret = "test-secret";
        String rawToken = "raw-reset-token";
        String hashedToken = com.pm.authservice.util.PasswordResetTokenUtil.hmacSha256Hex(hmacSecret, rawToken);
        UUID userId = UUID.randomUUID();

        User user = new User();
        user.setId(userId);
        user.setPassword("old-password");
        user.setMustChangePassword(true);

        PasswordResetToken row = new PasswordResetToken();
        row.setUserId(userId);
        row.setTokenHash(hashedToken);
        row.setCreatedAt(Instant.parse("2030-07-02T12:00:00Z"));
        row.setExpiresAt(Instant.parse("2030-07-02T13:00:00Z"));

        when(tokenRepository.findByTokenHash(hashedToken)).thenReturn(Optional.of(row));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("NewPassword!123")).thenReturn("encoded-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(tokenRepository.save(any(PasswordResetToken.class))).thenAnswer(invocation -> invocation.getArgument(0));

        PasswordResetService service = new PasswordResetService(
                userRepository,
                tokenRepository,
                passwordEncoder,
                emailSender,
                Duration.ofMinutes(15),
                "http://localhost:5173/reset-password",
                hmacSecret
        );

        ResponseEntity<?> firstResponse = service.resetPassword(rawToken, "NewPassword!123");
        ResponseEntity<?> secondResponse = service.resetPassword(rawToken, "NewPassword!123");

        assertThat(firstResponse.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(user.getPassword()).isEqualTo("encoded-password");
        assertThat(user.isMustChangePassword()).isFalse();
        assertThat(row.getUsedAt()).isNotNull();
        verify(tokenRepository).deleteAllByUserIdAndTokenHashNot(userId, hashedToken);

        assertThat(secondResponse.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(secondResponse.getBody()).isInstanceOf(ResetPasswordErrorResponseDTO.class);
        ResetPasswordErrorResponseDTO error = (ResetPasswordErrorResponseDTO) secondResponse.getBody();
        assertThat(error.getCode()).isEqualTo(PasswordResetService.ERR_TOKEN_ALREADY_USED);
        verify(userRepository, never()).findAllByEmail(any());
    }
}
