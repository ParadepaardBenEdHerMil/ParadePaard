package com.pm.authservice.service;

import com.pm.authservice.dto.AuthResponseDTO;
import com.pm.authservice.dto.LoginRequestDTO;
import com.pm.authservice.kafka.KafkaProducer;
import com.pm.authservice.model.User;
import com.pm.authservice.repository.CompanyRepository;
import com.pm.authservice.repository.PasswordResetTokenRepository;
import com.pm.authservice.repository.PermissionRepository;
import com.pm.authservice.repository.RoleRepository;
import com.pm.authservice.repository.UserRepository;
import com.pm.authservice.util.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * B8: per-account brute-force lockout on login.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceBruteForceTest {

    @Mock private UserService userService;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private UserRepository userRepository;
    @Mock private KafkaProducer kafkaProducer;
    @Mock private RoleRepository roleRepository;
    @Mock private PermissionRepository permissionRepository;
    @Mock private CompanyRepository companyRepository;
    @Mock private PasswordResetService passwordResetService;
    @Mock private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock private EmailSender emailSender;

    private AuthService authService;

    private static final String USERNAME = "worker";

    @BeforeEach
    void setUp() {
        String secret = Base64.getEncoder()
                .encodeToString("test-secret-key-that-is-long-enough-0123456789".getBytes(StandardCharsets.UTF_8));
        authService = new AuthService(
                userService, passwordEncoder, new JwtUtil(secret), userRepository, kafkaProducer,
                roleRepository, permissionRepository, companyRepository,
                passwordResetService, passwordResetTokenRepository, emailSender);
    }

    private User user(int failedAttempts, Instant lockedUntil) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("worker@acme.test");
        user.setUsername(USERNAME);
        user.setPassword("$2a$hashed");
        user.setCompanyId(UUID.randomUUID());
        user.setRoles(new ArrayList<>());
        user.setFailedLoginAttempts(failedAttempts);
        user.setLockedUntil(lockedUntil);
        return user;
    }

    private LoginRequestDTO login(String password) {
        LoginRequestDTO dto = new LoginRequestDTO();
        dto.setUsername(USERNAME);
        dto.setPassword(password);
        return dto;
    }

    @Test
    void fifthConsecutiveFailure_locksAccount() {
        User user = user(4, null); // one more failure crosses the threshold of 5
        when(userService.findByUsername(USERNAME)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);
        lenient().when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<AuthResponseDTO> response = authService.authenticate(login("wrong-password"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(user.getLockedUntil()).isNotNull();
        assertThat(user.getLockedUntil()).isAfter(Instant.now());
        verify(userRepository).save(user);
    }

    @Test
    void failureBelowThreshold_incrementsWithoutLocking() {
        User user = user(1, null);
        when(userService.findByUsername(USERNAME)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);
        lenient().when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<AuthResponseDTO> response = authService.authenticate(login("wrong-password"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(user.getFailedLoginAttempts()).isEqualTo(2);
        assertThat(user.getLockedUntil()).isNull();
    }

    @Test
    void lockedAccount_rejectsWithoutCheckingPassword() {
        User user = user(0, Instant.now().plusSeconds(600));
        when(userService.findByUsername(USERNAME)).thenReturn(Optional.of(user));

        ResponseEntity<AuthResponseDTO> response = authService.authenticate(login("any-password"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(passwordEncoder, never()).matches(anyString(), anyString());
    }

    @Test
    void successfulLogin_clearsFailureState() {
        User user = user(3, null);
        when(userService.findByUsername(USERNAME)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<AuthResponseDTO> response = authService.authenticate(login("correct-password"));

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(user.getFailedLoginAttempts()).isEqualTo(0);
        assertThat(user.getLockedUntil()).isNull();
    }
}
