package com.pm.authservice.service;

import com.pm.authservice.dto.AdminEmailSendResponseDTO;
import com.pm.authservice.dto.AdminOnboardUserRequestDTO;
import com.pm.authservice.dto.AdminOnboardUserResponseDTO;
import com.pm.authservice.exception.EmailAlreadyExistsException;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
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
    void resendOnboardingEmailSendsAccountSetupEmailForExistingUserInAdminCompany() {
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

        verify(emailSender).sendEmployeeAccountSetupEmail("alex@example.com", issued.getResetUrl(), issued.getTtl());
        verify(emailSender, never()).sendPasswordResetEmail("alex@example.com", issued.getResetUrl(), issued.getTtl());
        assertThat(response.getUserId()).isEqualTo(userId.toString());
        assertThat(response.getEmail()).isEqualTo("alex@example.com");
        assertThat(response.isEmailSent()).isTrue();
    }

    @Test
    void onboardUserReonboardsExistingNotYetActivatedUserInsteadOfFailing() {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        User pendingUser = new User();
        pendingUser.setId(userId);
        pendingUser.setEmail("benjaminelivanrhee@gmail.com");
        pendingUser.setUsername("benjamin.eli.van.rhee");
        pendingUser.setCompanyId(companyId);
        pendingUser.setMustChangePassword(true);

        PasswordResetService.IssuedResetToken issued = new PasswordResetService.IssuedResetToken(
                "token",
                "http://localhost:5173/reset-password?token=token",
                Duration.ofMinutes(15)
        );
        when(userRepository.findByEmailAndCompanyId("benjaminelivanrhee@gmail.com", companyId))
                .thenReturn(Optional.of(pendingUser));
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(pendingUser)).thenReturn(pendingUser);
        when(passwordResetService.issueResetToken(pendingUser)).thenReturn(Optional.of(issued));

        AdminOnboardUserResponseDTO response = service.onboardUser(
                onboardRequest("benjaminelivanrhee@gmail.com"),
                authentication(companyId)
        );

        assertThat(response.getUserId()).isEqualTo(userId.toString());
        assertThat(response.getCompanyId()).isEqualTo(companyId.toString());
        assertThat(response.getOnboardingEmailSent()).isTrue();
        verify(emailSender).sendEmployeeOnboardingEmail(
                eq("benjaminelivanrhee@gmail.com"),
                eq("benjamin.eli.van.rhee"),
                anyString(),
                eq(issued.getResetUrl()),
                eq(issued.getTtl())
        );
        // Re-onboarding must not mint a fresh account: no new role lookup and no USER_CREATED event.
        verify(roleRepository, never()).findByNameAndCompanyId(any(), any());
        verify(kafkaProducer, never()).sendEvent(any());
    }

    @Test
    void onboardUserRejectsExistingActivatedUser() {
        UUID companyId = UUID.randomUUID();
        User activeUser = new User();
        activeUser.setId(UUID.randomUUID());
        activeUser.setEmail("active@example.com");
        activeUser.setCompanyId(companyId);
        activeUser.setMustChangePassword(false);

        when(userRepository.findByEmailAndCompanyId("active@example.com", companyId))
                .thenReturn(Optional.of(activeUser));

        assertThatThrownBy(() -> service.onboardUser(onboardRequest("active@example.com"), authentication(companyId)))
                .isInstanceOf(EmailAlreadyExistsException.class);

        verify(userRepository, never()).save(any());
        verify(emailSender, never()).sendEmployeeOnboardingEmail(any(), any(), any(), any(), any());
    }

    private static AdminOnboardUserRequestDTO onboardRequest(String email) {
        AdminOnboardUserRequestDTO request = new AdminOnboardUserRequestDTO();
        request.setEmail(email);
        request.setFirstName("Benjamin");
        request.setLastName("van Rhee");
        return request;
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
