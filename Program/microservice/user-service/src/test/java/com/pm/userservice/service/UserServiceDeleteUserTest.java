package com.pm.userservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pm.userservice.integration.AuthServiceClient;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.CaoTemplateRepository;
import com.pm.userservice.repository.CompanyRepository;
import com.pm.userservice.repository.JobApplicationRepository;
import com.pm.userservice.repository.UserRepository;
import com.pm.userservice.validation.UserDuplicateValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClientException;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceDeleteUserTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private CompanyRepository companyRepository;
    @Mock
    private CaoTemplateRepository caoTemplateRepository;
    @Mock
    private UserDuplicateValidator userDuplicateValidator;
    @Mock
    private ObjectMapper objectMapper;
    @Mock
    private AuthServiceClient authServiceClient;
    @Mock
    private JobApplicationRepository jobApplicationRepository;

    @Test
    void deleteUserDeletesAuthCredentialsBeforeRemovingLocalProfile() {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        UUID actorUserId = UUID.randomUUID();
        User user = new User();
        user.setUserId(userId);

        when(userRepository.findByUserIdAndCompanyId(userId, companyId)).thenReturn(Optional.of(user));

        UserService service = service();
        service.deleteUser(userId, companyId, actorUserId, "access-token");

        InOrder inOrder = inOrder(authServiceClient, userRepository);
        inOrder.verify(authServiceClient).deleteUserAccount(userId, "access-token");
        inOrder.verify(userRepository).deleteByUserId(userId);
    }

    @Test
    void deleteUserAlsoRemovesTheApplicationTheUserWasOnboardedFrom() {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        UUID actorUserId = UUID.randomUUID();
        User user = new User();
        user.setUserId(userId);

        when(userRepository.findByUserIdAndCompanyId(userId, companyId)).thenReturn(Optional.of(user));

        UserService service = service();
        service.deleteUser(userId, companyId, actorUserId, "access-token");

        // Without this the accepted application row lingers and keeps the applicant's email
        // permanently "in use", blocking them from ever re-applying after deletion.
        verify(jobApplicationRepository).deleteByAcceptedUserId(userId);
    }

    @Test
    void deleteUserDoesNotRemoveLocalProfileWhenAuthCredentialDeletionFails() {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();
        UUID actorUserId = UUID.randomUUID();
        User user = new User();
        user.setUserId(userId);

        when(userRepository.findByUserIdAndCompanyId(userId, companyId)).thenReturn(Optional.of(user));
        doThrow(new RestClientException("auth delete failed"))
                .when(authServiceClient).deleteUserAccount(userId, "access-token");

        UserService service = service();

        assertThatThrownBy(() -> service.deleteUser(userId, companyId, actorUserId, "access-token"))
                .isInstanceOf(RestClientException.class)
                .hasMessageContaining("auth delete failed");

        verify(userRepository, never()).deleteByUserId(any());
    }

    private UserService service() {
        return new UserService(
                userRepository,
                companyRepository,
                caoTemplateRepository,
                userDuplicateValidator,
                objectMapper,
                authServiceClient,
                jobApplicationRepository
        );
    }
}
