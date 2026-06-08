package com.pm.authservice.service;

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
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceDeleteUserAccountTest {

    @Mock
    private UserService userService;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtUtil jwtUtil;
    @Mock
    private UserRepository userRepository;
    @Mock
    private KafkaProducer kafkaProducer;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private PermissionRepository permissionRepository;
    @Mock
    private CompanyRepository companyRepository;
    @Mock
    private PasswordResetService passwordResetService;
    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock
    private EmailSender emailSender;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                userService,
                passwordEncoder,
                jwtUtil,
                userRepository,
                kafkaProducer,
                roleRepository,
                permissionRepository,
                companyRepository,
                passwordResetService,
                passwordResetTokenRepository,
                emailSender
        );
    }

    @Test
    void deleteUserAccountDeletesResetTokensAndAuthUserForSameCompany() {
        UUID managerUserId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setCompanyId(companyId);

        TestingAuthenticationToken authentication = new TestingAuthenticationToken(
                new AuthUserPrincipal("admin@example.com", managerUserId, companyId),
                null
        );
        authentication.setAuthenticated(true);

        when(userRepository.findByIdAndCompanyId(userId, companyId)).thenReturn(Optional.of(user));

        authService.deleteUserAccount(userId, authentication);

        verify(passwordResetTokenRepository).deleteAllByUserId(userId);
        verify(userRepository).delete(user);
    }

    @Test
    void deleteUserAccountRejectsSelfDelete() {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        TestingAuthenticationToken authentication = new TestingAuthenticationToken(
                new AuthUserPrincipal("admin@example.com", userId, companyId),
                null
        );
        authentication.setAuthenticated(true);

        assertThatThrownBy(() -> authService.deleteUserAccount(userId, authentication))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot delete your own account");

        verify(passwordResetTokenRepository, never()).deleteAllByUserId(userId);
        verify(userRepository, never()).delete(any(User.class));
    }
}
