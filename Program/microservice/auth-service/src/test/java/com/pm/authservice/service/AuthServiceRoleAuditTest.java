package com.pm.authservice.service;

import com.pm.authservice.dto.AuditLogCreateRequestDTO;
import com.pm.authservice.dto.AuditLogMessagePartDTO;
import com.pm.authservice.dto.CreateRoleRequestDTO;
import com.pm.authservice.dto.UpdateRoleRequestDTO;
import com.pm.authservice.integration.AuditLogClient;
import com.pm.authservice.kafka.KafkaProducer;
import com.pm.authservice.model.Permission;
import com.pm.authservice.model.Role;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceRoleAuditTest {
    @Mock private UserService userService;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtUtil jwtUtil;
    @Mock private UserRepository userRepository;
    @Mock private KafkaProducer kafkaProducer;
    @Mock private RoleRepository roleRepository;
    @Mock private PermissionRepository permissionRepository;
    @Mock private CompanyRepository companyRepository;
    @Mock private PasswordResetService passwordResetService;
    @Mock private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock private EmailSender emailSender;
    @Mock private AuditLogClient auditLogClient;

    private AuthService authService;
    private final UUID companyId = UUID.randomUUID();

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
        ReflectionTestUtils.setField(authService, "auditLogClient", auditLogClient);
    }

    private Authentication admin() {
        TestingAuthenticationToken authentication = new TestingAuthenticationToken(
                new AuthUserPrincipal("admin@example.com", UUID.randomUUID(), companyId),
                null
        );
        authentication.setAuthenticated(true);
        return authentication;
    }

    private static String textOf(AuditLogCreateRequestDTO request) {
        return request.getMessageParts().stream()
                .filter(part -> "TEXT".equalsIgnoreCase(part.getType()))
                .map(AuditLogMessagePartDTO::getText)
                .filter(Objects::nonNull)
                .reduce("", String::concat);
    }

    @Test
    void createRoleRecordsAuditWithForwardedToken() {
        CreateRoleRequestDTO request = new CreateRoleRequestDTO();
        request.setName("MANAGER");
        request.setPermissions(List.of("CAN_VIEW_USERS"));
        request.setColor("#ff0000");

        when(roleRepository.findByNameAndCompanyId("MANAGER", companyId)).thenReturn(Optional.empty());
        when(permissionRepository.findByName("CAN_VIEW_USERS")).thenReturn(Optional.of(new Permission("CAN_VIEW_USERS")));
        when(roleRepository.save(any(Role.class))).thenAnswer(invocation -> {
            Role saved = invocation.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });

        authService.createRole(request, admin(), "admin-token");

        ArgumentCaptor<AuditLogCreateRequestDTO> captor = ArgumentCaptor.forClass(AuditLogCreateRequestDTO.class);
        verify(auditLogClient).record(eq("admin-token"), captor.capture());
        AuditLogCreateRequestDTO recorded = captor.getValue();
        assertThat(recorded.getCategory()).isEqualTo("ROLES");
        assertThat(recorded.getAction()).isEqualTo("CREATED");
        assertThat(recorded.getEntityType()).isEqualTo("ROLE");
        assertThat(textOf(recorded)).contains("created role").contains("colour #ff0000").contains("CAN_VIEW_USERS");
    }

    @Test
    void createRoleWithoutTokenDoesNotCallAuditClient() {
        CreateRoleRequestDTO request = new CreateRoleRequestDTO();
        request.setName("MANAGER");
        request.setPermissions(List.of("CAN_VIEW_USERS"));

        when(roleRepository.findByNameAndCompanyId("MANAGER", companyId)).thenReturn(Optional.empty());
        when(permissionRepository.findByName("CAN_VIEW_USERS")).thenReturn(Optional.of(new Permission("CAN_VIEW_USERS")));
        when(roleRepository.save(any(Role.class))).thenAnswer(invocation -> invocation.getArgument(0));

        authService.createRole(request, admin(), null);

        verify(auditLogClient, never()).record(any(), any());
    }

    @Test
    void updateRoleRecordsColourChange() {
        UUID roleId = UUID.randomUUID();
        Role existing = new Role("MANAGER", List.of(new Permission("CAN_VIEW_USERS")));
        existing.setId(roleId);
        existing.setCompanyId(companyId);
        existing.setColor("#111111");

        UpdateRoleRequestDTO request = new UpdateRoleRequestDTO();
        request.setName("MANAGER");
        request.setPermissions(List.of("CAN_VIEW_USERS"));
        request.setColor("#ff0000");

        when(roleRepository.findByIdAndCompanyId(roleId, companyId)).thenReturn(Optional.of(existing));
        when(permissionRepository.findByName("CAN_VIEW_USERS")).thenReturn(Optional.of(new Permission("CAN_VIEW_USERS")));
        when(roleRepository.save(any(Role.class))).thenAnswer(invocation -> invocation.getArgument(0));

        authService.updateRole(roleId, request, admin(), "admin-token");

        ArgumentCaptor<AuditLogCreateRequestDTO> captor = ArgumentCaptor.forClass(AuditLogCreateRequestDTO.class);
        verify(auditLogClient).record(eq("admin-token"), captor.capture());
        AuditLogCreateRequestDTO recorded = captor.getValue();
        assertThat(recorded.getAction()).isEqualTo("UPDATED");
        assertThat(recorded.getEntityType()).isEqualTo("ROLE");
        assertThat(textOf(recorded)).contains("colour #111111 -> #ff0000");
    }
}
