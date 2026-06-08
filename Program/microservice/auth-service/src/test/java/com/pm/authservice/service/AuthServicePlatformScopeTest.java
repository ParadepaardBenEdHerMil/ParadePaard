package com.pm.authservice.service;

import com.pm.authservice.dto.AuthResponseDTO;
import com.pm.authservice.kafka.KafkaProducer;
import com.pm.authservice.model.Company;
import com.pm.authservice.model.Role;
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
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServicePlatformScopeTest {
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
    void switchPlatformCompanyScopeUsesRequestedCompanyInIssuedTokens() {
        UUID homeCompanyId = UUID.randomUUID();
        UUID targetCompanyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        User user = platformAdminUser(userId, homeCompanyId);
        Company targetCompany = new Company();
        targetCompany.setId(targetCompanyId);
        targetCompany.setName("Target Company");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(companyRepository.findById(targetCompanyId)).thenReturn(Optional.of(targetCompany));
        when(jwtUtil.generateAccessToken(eq(user.getEmail()), eq(userId.toString()), eq(user.getRoles()), eq(targetCompanyId.toString())))
                .thenReturn("scoped-access-token");
        when(jwtUtil.generateRefreshToken(eq(user.getEmail()), eq(userId.toString()), eq(user.getRoles()), eq(targetCompanyId.toString())))
                .thenReturn("scoped-refresh-token");

        ResponseEntity<AuthResponseDTO> response = authService.switchPlatformCompanyScope(
                authentication(userId, homeCompanyId),
                targetCompanyId
        );

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCompanyId()).isEqualTo(targetCompanyId.toString());
        assertThat(response.getHeaders().get(HttpHeaders.SET_COOKIE)).anySatisfy(cookie ->
                assertThat(cookie).contains("accessToken=scoped-access-token"));
        assertThat(response.getHeaders().get(HttpHeaders.SET_COOKIE)).anySatisfy(cookie ->
                assertThat(cookie).contains("refreshToken=scoped-refresh-token"));
    }

    @Test
    void switchPlatformCompanyScopeWithoutRequestedCompanyRestoresHomeCompany() {
        UUID homeCompanyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        User user = platformAdminUser(userId, homeCompanyId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(jwtUtil.generateAccessToken(eq(user.getEmail()), eq(userId.toString()), eq(user.getRoles()), eq(homeCompanyId.toString())))
                .thenReturn("home-access-token");
        when(jwtUtil.generateRefreshToken(eq(user.getEmail()), eq(userId.toString()), eq(user.getRoles()), eq(homeCompanyId.toString())))
                .thenReturn("home-refresh-token");

        ResponseEntity<AuthResponseDTO> response = authService.switchPlatformCompanyScope(
                authentication(userId, homeCompanyId),
                null
        );

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCompanyId()).isEqualTo(homeCompanyId.toString());
    }

    private static User platformAdminUser(UUID userId, UUID companyId) {
        User user = new User();
        user.setId(userId);
        user.setEmail("super.admin@example.com");
        user.setCompanyId(companyId);
        user.setRoles(List.of(new Role("SUPER_ADMIN")));
        return user;
    }

    private static TestingAuthenticationToken authentication(UUID userId, UUID companyId) {
        TestingAuthenticationToken authentication = new TestingAuthenticationToken(
                new AuthUserPrincipal("super.admin@example.com", userId, companyId),
                null,
                "CAN_MANAGE_PLATFORM"
        );
        authentication.setAuthenticated(true);
        return authentication;
    }
}
