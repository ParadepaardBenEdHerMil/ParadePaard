package com.pm.userservice;

import com.pm.userservice.dto.UserSetupRequestDTO;
import com.pm.userservice.integration.AuthServiceClient;
import com.pm.userservice.integration.ContractServiceClient;
import com.pm.userservice.grpc.AuthServiceGrpcClient;
import com.pm.userservice.model.User;
import com.pm.userservice.model.UserStatus;
import com.pm.userservice.repository.CompanyRepository;
import com.pm.userservice.repository.UserRepository;
import com.pm.userservice.service.OnboardingService;
import com.pm.userservice.exception.InvalidIdentifierException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;

class OnboardingServiceSetupTest {
    private final UserRepository userRepository = mock(UserRepository.class);
    private final CompanyRepository companyRepository = mock(CompanyRepository.class);
    private final AuthServiceClient authServiceClient = mock(AuthServiceClient.class);
    private final ContractServiceClient contractServiceClient = mock(ContractServiceClient.class);
    private final AuthServiceGrpcClient authServiceGrpcClient = mock(AuthServiceGrpcClient.class);
    private final OnboardingService service = new OnboardingService(
            userRepository,
            companyRepository,
            authServiceClient,
            contractServiceClient,
            authServiceGrpcClient
    );

    @Test
    void completeUserSetupStoresAcceptedOnboardingDataAndMovesToProfileReview() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setUserId(userId);
        user.setStatus(UserStatus.PENDING_SETUP);
        when(userRepository.findByUserId(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.completeUserSetup(userId, setupRequest(), "access-token");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User savedUser = captor.getValue();
        assertThat(savedUser.getStreet()).isEqualTo("Keizersgracht");
        assertThat(savedUser.getIban()).isEqualTo("NL91ABNA0417164300");
        assertThat(savedUser.getNationality()).isEqualTo("Dutch");
        assertThat(savedUser.getBankAccountHolderName()).isEqualTo("Ava Jansen");
        assertThat(savedUser.getBsn()).isEqualTo("111222333");
        assertThat(savedUser.isApplyLoonheffingskorting()).isTrue();
        assertThat(savedUser.isPensionParticipant()).isTrue();
        assertThat(savedUser.isSpecialZvwContribution()).isFalse();
        assertThat(savedUser.getPayrollNotes()).isEqualTo("Student tax note");
        assertThat(savedUser.getIdDocumentType()).isEqualTo("Passport");
        assertThat(savedUser.getIdDocumentNumber()).isEqualTo("AB1234567");
        assertThat(savedUser.getIdIssueDate()).isEqualTo(LocalDate.of(2024, 1, 12));
        assertThat(savedUser.getIdExpirationDate()).isEqualTo(LocalDate.of(2034, 1, 12));
        assertThat(savedUser.getIdIssuingCountry()).isEqualTo("Netherlands");
        assertThat(savedUser.getEmergencyContactName()).isEqualTo("Mila Jansen");
        assertThat(savedUser.getEmergencyContactRelationship()).isEqualTo("Sister");
        assertThat(savedUser.getEmergencyContactPhone()).isEqualTo("+31687654321");
        assertThat(savedUser.getEmergencyContactEmail()).isEqualTo("mila@example.com");
        assertThat(savedUser.getStatus()).isEqualTo(UserStatus.PENDING_PROFILE_REVIEW);
    }

    @Test
    void updateIdDocumentImagesStoresBytesAndContentTypes() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setUserId(userId);
        when(userRepository.findByUserId(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        byte[] frontBytes = "front-image-bytes".getBytes(StandardCharsets.UTF_8);
        byte[] backBytes = "back-image-bytes".getBytes(StandardCharsets.UTF_8);

        service.updateIdDocumentImages(userId, frontBytes, "image/png", backBytes, "image/jpeg");

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User savedUser = captor.getValue();
        assertThat(savedUser.getIdDocumentImage()).isEqualTo(frontBytes);
        assertThat(savedUser.getIdDocumentImageContentType()).isEqualTo("image/png");
        assertThat(savedUser.getIdDocumentBackImage()).isEqualTo(backBytes);
        assertThat(savedUser.getIdDocumentBackImageContentType()).isEqualTo("image/jpeg");
    }

    @Test
    void completeUserSetupRejectsInvalidBsn() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setUserId(userId);
        when(userRepository.findByUserId(userId)).thenReturn(Optional.of(user));
        UserSetupRequestDTO request = setupRequest();
        request.setBsn("123456789"); // fails 11-proef

        assertThatThrownBy(() -> service.completeUserSetup(userId, request, "access-token"))
                .isInstanceOf(InvalidIdentifierException.class);
        verify(userRepository, never()).save(any());
    }

    @Test
    void completeUserSetupRejectsInvalidIban() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setUserId(userId);
        when(userRepository.findByUserId(userId)).thenReturn(Optional.of(user));
        UserSetupRequestDTO request = setupRequest();
        request.setIban("NL91ABNA0417164301"); // wrong check digits

        assertThatThrownBy(() -> service.completeUserSetup(userId, request, "access-token"))
                .isInstanceOf(InvalidIdentifierException.class);
        verify(userRepository, never()).save(any());
    }

    private static UserSetupRequestDTO setupRequest() {
        UserSetupRequestDTO request = new UserSetupRequestDTO();
        request.setStreet("Keizersgracht");
        request.setHouseNumber("12");
        request.setHouseNumberSuffix("A");
        request.setPostalCode("1015 CJ");
        request.setCity("Amsterdam");
        request.setCountry("Netherlands");
        request.setIban("NL91ABNA0417164300");
        request.setNationality("Dutch");
        request.setBankAccountHolderName("Ava Jansen");
        request.setBsn("111222333");
        request.setApplyLoonheffingskorting(true);
        request.setPensionParticipant(true);
        request.setSpecialZvwContribution(false);
        request.setPayrollNotes("Student tax note");
        request.setIdDocumentType("Passport");
        request.setIdDocumentNumber("AB1234567");
        request.setIdIssueDate("2024-01-12");
        request.setIdExpirationDate("2034-01-12");
        request.setIdIssuingCountry("Netherlands");
        request.setEmergencyContactName("Mila Jansen");
        request.setEmergencyContactRelationship("Sister");
        request.setEmergencyContactPhone("+31687654321");
        request.setEmergencyContactEmail("mila@example.com");
        return request;
    }
}
