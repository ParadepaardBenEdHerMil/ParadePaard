package com.pm.authservice.service;

import com.pm.authservice.dto.AdminEmailSendResponseDTO;
import com.pm.authservice.kafka.KafkaProducer;
import com.pm.authservice.model.User;
import com.pm.authservice.repository.RoleRepository;
import com.pm.authservice.repository.UserRepository;
import com.pm.authservice.security.AuthUserPrincipal;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminOnboardingServiceTest {
    private final UserRepository userRepository = mock(UserRepository.class);
    private final RoleRepository roleRepository = mock(RoleRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final KafkaProducer kafkaProducer = mock(KafkaProducer.class);
    private final PasswordResetService passwordResetService = mock(PasswordResetService.class);
    private final EmailSender emailSender = mock(EmailSender.class);
    private final AdminOnboardingService service = new AdminOnboardingService(
            userRepository,
            roleRepository,
            passwordEncoder,
            kafkaProducer,
            passwordResetService,
            emailSender
    );

    @Test
    void resendOnboardingEmailSendsResetLinkForExistingUserInAdminCompany() {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setEmail("alex@example.com");
        user.setCompanyId(companyId);
        PasswordResetService.IssuedResetToken issued = new PasswordResetService.IssuedResetToken(
                "token",
                "http://localhost:5173/reset-password?token=token",
                Duration.ofMinutes(15)
        );
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordResetService.issueResetToken(user)).thenReturn(Optional.of(issued));

        AdminEmailSendResponseDTO response = service.resendOnboardingEmail(userId, authentication(companyId));

        verify(emailSender).sendPasswordResetEmail("alex@example.com", issued.getResetUrl(), issued.getTtl());
        assertThat(response.getUserId()).isEqualTo(userId.toString());
        assertThat(response.getEmail()).isEqualTo("alex@example.com");
        assertThat(response.isEmailSent()).isTrue();
    }

    private static TestingAuthenticationToken authentication(UUID companyId) {
        TestingAuthenticationToken authentication = new TestingAuthenticationToken(
                new AuthUserPrincipal("admin@example.com", UUID.randomUUID(), companyId),
                null
        );
        authentication.setAuthenticated(true);
        return authentication;
    }
}
