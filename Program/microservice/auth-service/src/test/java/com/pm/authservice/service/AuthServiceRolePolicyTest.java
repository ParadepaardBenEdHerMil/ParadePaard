package com.pm.authservice.service;

import com.pm.authservice.dto.UpdateRoleRequestDTO;
import com.pm.authservice.kafka.KafkaProducer;
import com.pm.authservice.model.Role;
import com.pm.authservice.repository.CompanyRepository;
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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceRolePolicyTest {
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
                passwordResetService
        );
    }

    @Test
    void updateRoleRejectsManagementPermissionsOnBuiltInUserRole() {
        UUID companyId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();
        Role userRole = new Role("USER");
        userRole.setId(roleId);
        userRole.setCompanyId(companyId);

        UpdateRoleRequestDTO request = new UpdateRoleRequestDTO();
        request.setName("USER");
        request.setPermissions(List.of(
                "CAN_COMPLETE_ONBOARDING",
                "CAN_VIEW_OWN_CONTRACTS",
                "CAN_SIGN_OWN_CONTRACTS",
                "CAN_VIEW_PAYSLIPS",
                "CAN_REPORT_PAYSLIP_ERRORS",
                "CAN_VIEW_OWN_TIMESHEETS",
                "CAN_FINALIZE_CONTRACT"
        ));

        TestingAuthenticationToken authentication = new TestingAuthenticationToken(
                new AuthUserPrincipal("admin@example.com", UUID.randomUUID(), companyId),
                null
        );
        authentication.setAuthenticated(true);

        when(roleRepository.findByIdAndCompanyId(roleId, companyId)).thenReturn(Optional.of(userRole));

        assertThatThrownBy(() -> authService.updateRole(roleId, request, authentication))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("USER role");
        verifyNoInteractions(permissionRepository);
    }
}
