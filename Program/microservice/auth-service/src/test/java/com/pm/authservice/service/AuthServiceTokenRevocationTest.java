package com.pm.authservice.service;

import com.pm.authservice.dto.AuthResponseDTO;
import com.pm.authservice.kafka.KafkaProducer;
import com.pm.authservice.model.User;
import com.pm.authservice.repository.CompanyRepository;
import com.pm.authservice.repository.PasswordResetTokenRepository;
import com.pm.authservice.repository.PermissionRepository;
import com.pm.authservice.repository.RoleRepository;
import com.pm.authservice.repository.UserRepository;
import com.pm.authservice.security.AuthUserPrincipal;
import com.pm.authservice.util.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * B2 (disabled users cannot refresh) and B3 (server-side refresh-token revocation via a
 * per-user token version). Uses a real {@link JwtUtil} so the tv claim round-trips.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTokenRevocationTest {

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

    private JwtUtil jwtUtil;
    private AuthService authService;

    private static final String EMAIL = "worker@acme.test";

    @BeforeEach
    void setUp() {
        String secret = Base64.getEncoder()
                .encodeToString("test-secret-key-that-is-long-enough-0123456789".getBytes(StandardCharsets.UTF_8));
        jwtUtil = new JwtUtil(secret);
        authService = new AuthService(
                userService, passwordEncoder, jwtUtil, userRepository, kafkaProducer,
                roleRepository, permissionRepository, companyRepository,
                passwordResetService, passwordResetTokenRepository, emailSender);
    }

    private User user(UUID id, UUID companyId, int tokenVersion, boolean disabled) {
        User user = new User();
        user.setId(id);
        user.setEmail(EMAIL);
        user.setCompanyId(companyId);
        user.setTokenVersion(tokenVersion);
        user.setDisabled(disabled);
        user.setRoles(new ArrayList<>());
        return user;
    }

    private String refreshTokenFor(User user) {
        return jwtUtil.generateRefreshToken(
                user.getEmail(), user.getId().toString(), user.getRoles(),
                user.getCompanyId().toString(), user.getTokenVersion());
    }

    @Test
    void refresh_disabledUser_is401() {
        UUID id = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        User user = user(id, companyId, 0, false);
        String token = refreshTokenFor(user);

        user.setDisabled(true); // disabled after the token was issued
        when(userRepository.findById(id)).thenReturn(Optional.of(user));

        ResponseEntity<AuthResponseDTO> response = authService.refreshToken(token);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void refresh_staleTokenVersion_is401() {
        UUID id = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        User user = user(id, companyId, 0, false);
        String token = refreshTokenFor(user); // tv=0

        user.setTokenVersion(1); // a logout/disable/reset bumped the version
        when(userRepository.findById(id)).thenReturn(Optional.of(user));

        ResponseEntity<AuthResponseDTO> response = authService.refreshToken(token);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void refresh_currentTokenVersionAndEnabled_is200() {
        UUID id = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        User user = user(id, companyId, 3, false);
        String token = refreshTokenFor(user); // tv=3, matches

        when(userRepository.findById(id)).thenReturn(Optional.of(user));

        ResponseEntity<AuthResponseDTO> response = authService.refreshToken(token);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
    }

    @Test
    void logout_bumpsTokenVersion() {
        UUID id = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        User user = user(id, companyId, 2, false);
        when(userRepository.findById(id)).thenReturn(Optional.of(user));
        lenient().when(userRepository.save(user)).thenReturn(user);

        TestingAuthenticationToken auth = new TestingAuthenticationToken(
                new AuthUserPrincipal(EMAIL, id, companyId), null);
        auth.setAuthenticated(true);

        authService.logout(auth, null);

        assertThat(user.getTokenVersion()).isEqualTo(3);
        verify(userRepository).save(user);
    }

    @Test
    void setUserDisabled_disablingBumpsTokenVersion() {
        UUID id = UUID.randomUUID();
        User user = user(id, UUID.randomUUID(), 0, false);
        when(userRepository.findById(id)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        authService.setUserDisabled(id, true);

        assertThat(user.isDisabled()).isTrue();
        assertThat(user.getTokenVersion()).isEqualTo(1);
    }

    @Test
    void setUserDisabled_enablingDoesNotBumpTokenVersion() {
        UUID id = UUID.randomUUID();
        User user = user(id, UUID.randomUUID(), 5, true);
        when(userRepository.findById(id)).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);

        authService.setUserDisabled(id, false);

        assertThat(user.isDisabled()).isFalse();
        assertThat(user.getTokenVersion()).isEqualTo(5);
        verify(userRepository, never()).findById(UUID.randomUUID());
    }
}
