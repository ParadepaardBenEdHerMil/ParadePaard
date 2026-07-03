package com.pm.authservice.service;

import com.pm.authservice.dto.RegisterRequestDTO;
import com.pm.authservice.kafka.KafkaProducer;
import com.pm.authservice.model.Company;
import com.pm.authservice.model.Permission;
import com.pm.authservice.model.Role;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceRegistrationTest {
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
    void registerWithMustChangePasswordSendsOnboardingEmail() {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        RegisterRequestDTO request = new RegisterRequestDTO();
        request.setCompanyName("Acme Events");
        request.setFirstName("Alex");
        request.setMiddleNamePrefix("van");
        request.setLastName("Stone");
        request.setEmail("alex@acme.test");
        request.setPassword("Secret123!");
        request.setMustChangePassword(true);

        Company company = new Company();
        company.setId(companyId);
        company.setName("Acme Events");

        Role userRole = new Role("USER");
        userRole.setId(UUID.randomUUID());
        userRole.setCompanyId(companyId);
        userRole.setPermissions(List.of(
                permission("CAN_COMPLETE_ONBOARDING"),
                permission("CAN_VIEW_OWN_CONTRACTS"),
                permission("CAN_SIGN_OWN_CONTRACTS"),
                permission("CAN_VIEW_PAYSLIPS"),
                permission("CAN_REPORT_PAYSLIP_ERRORS"),
                permission("CAN_VIEW_OWN_TIMESHEETS")
        ));

        Role adminRole = new Role("ADMIN");
        adminRole.setId(UUID.randomUUID());
        adminRole.setCompanyId(companyId);

        User savedUser = new User();
        savedUser.setId(userId);
        savedUser.setEmail("alex@acme.test");
        savedUser.setUsername("alex.stone");
        savedUser.setCompanyId(companyId);
        savedUser.setRoles(List.of(userRole));

        PasswordResetService.IssuedResetToken issued = new PasswordResetService.IssuedResetToken(
                "token",
                "http://localhost:5173/reset-password?token=token",
                Duration.ofMinutes(15)
        );

        when(companyRepository.findByName("Acme Events")).thenReturn(Optional.empty());
        when(companyRepository.save(any(Company.class))).thenReturn(company);
        when(userRepository.existsByEmailAndCompanyId("alex@acme.test", companyId)).thenReturn(false);
        when(roleRepository.existsByNameAndCompanyId("ADMIN", companyId)).thenReturn(true);
        when(roleRepository.findByNameAndCompanyId("ADMIN", companyId)).thenReturn(Optional.of(adminRole));
        when(roleRepository.findByNameAndCompanyId("USER", companyId)).thenReturn(Optional.of(userRole));
        when(userRepository.existsByUsername("alex.stone")).thenReturn(false);
        when(passwordEncoder.encode("Secret123!")).thenReturn("encoded-password");
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(passwordResetService.issueResetToken(savedUser)).thenReturn(Optional.of(issued));
        when(jwtUtil.generateAccessToken(eq("alex@acme.test"), eq(userId.toString()), any(), eq(companyId.toString()), anyInt()))
                .thenReturn("access-token");
        when(jwtUtil.generateRefreshToken(eq("alex@acme.test"), eq(userId.toString()), any(), eq(companyId.toString()), anyInt()))
                .thenReturn("refresh-token");

        ResponseEntity<?> response = authService.register(request);

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().isMustChangePassword()).isTrue();
        verify(emailSender).sendEmployeeOnboardingEmail(
                "alex@acme.test",
                "alex.stone",
                "Secret123!",
                issued.getResetUrl(),
                issued.getTtl()
        );
        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
    }

    @Test
    void registerCreatesDefaultAdminRoleWithBillingRatePermissions() {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        RegisterRequestDTO request = new RegisterRequestDTO();
        request.setCompanyName("Billing Events");
        request.setFirstName("Bill");
        request.setLastName("Owner");
        request.setEmail("bill@events.test");
        request.setPassword("Secret123!");

        Company company = new Company();
        company.setId(companyId);
        company.setName("Billing Events");

        when(companyRepository.findByName("Billing Events")).thenReturn(Optional.empty());
        when(companyRepository.save(any(Company.class))).thenReturn(company);
        when(roleRepository.findByNameAndCompanyId("USER", companyId)).thenReturn(Optional.empty());
        when(permissionRepository.findByName(anyString())).thenAnswer(invocation ->
                Optional.of(permission(invocation.getArgument(0)))
        );
        when(roleRepository.save(any(Role.class))).thenAnswer(invocation -> {
            Role role = invocation.getArgument(0);
            role.setId(UUID.randomUUID());
            return role;
        });
        when(userRepository.existsByEmailAndCompanyId("bill@events.test", companyId)).thenReturn(false);
        when(userRepository.existsByUsername("bill.owner")).thenReturn(false);
        when(passwordEncoder.encode("Secret123!")).thenReturn("encoded-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(userId);
            return user;
        });
        when(jwtUtil.generateAccessToken(eq("bill@events.test"), eq(userId.toString()), any(), eq(companyId.toString()), anyInt()))
                .thenReturn("access-token");
        when(jwtUtil.generateRefreshToken(eq("bill@events.test"), eq(userId.toString()), any(), eq(companyId.toString()), anyInt()))
                .thenReturn("refresh-token");

        authService.register(request);

        ArgumentCaptor<Role> roleCaptor = ArgumentCaptor.forClass(Role.class);
        verify(roleRepository, atLeastOnce()).save(roleCaptor.capture());

        assertThat(roleCaptor.getAllValues())
                .filteredOn(role -> "ADMIN".equals(role.getName()))
                .anySatisfy(role -> assertThat(role.getPermissions())
                        .extracting(Permission::getName)
                        .contains("CAN_VIEW_BILLING_RATES", "CAN_MANAGE_BILLING_RATES"));
    }

    private static Permission permission(String name) {
        Permission permission = new Permission();
        permission.setName(name);
        return permission;
    }
}
