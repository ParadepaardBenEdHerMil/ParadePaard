package com.pm.userservice.grpc;

import com.pm.userservice.model.User;
import com.pm.userservice.repository.UserRepository;
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import user.UserDataRequest;
import user.UserDataResponse;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserGrpcServiceContractTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    @SuppressWarnings("unchecked")
    private final StreamObserver<UserDataResponse> responseObserver = mock(StreamObserver.class);

    @Test
    void requestUserDataReturnsTheContractExpectedByDownstreamConsumers() {
        UUID userId = UUID.randomUUID();
        UUID companyId = UUID.randomUUID();

        User user = new User();
        user.setUserId(userId);
        user.setCompanyId(companyId);
        user.setFirstNames("Alex Maria");
        user.setMiddleNamePrefix("van");
        user.setLastName("Jansen");
        user.setPreferredName("Alex");
        user.setGender("Female");
        user.setDateOfBirth(LocalDate.of(1995, 2, 12));
        user.setStreet("Hoogstraat");
        user.setHouseNumber("14");
        user.setHouseNumberSuffix("A");
        user.setPostalCode("3011 PV");
        user.setCity("Rotterdam");
        user.setCountry("Netherlands");
        user.setEmail("alex@example.com");
        user.setMobileNumber("+31612345678");
        user.setIban("NL91ABNA0417164300");
        user.setBsn("123456782");
        user.setApplyLoonheffingskorting(true);
        user.setPensionParticipant(true);
        user.setSpecialZvwContribution(false);
        user.setPayrollNotes("Bring safety shoes");

        when(userRepository.findByUserId(userId)).thenReturn(Optional.of(user));

        UserGrpcService service = new UserGrpcService(
                userRepository, mock(com.pm.userservice.service.LeaveQueryService.class));

        service.requestUserData(
                UserDataRequest.newBuilder().setUserId(userId.toString()).build(),
                responseObserver
        );

        ArgumentCaptor<UserDataResponse> responseCaptor = ArgumentCaptor.forClass(UserDataResponse.class);
        verify(responseObserver).onNext(responseCaptor.capture());
        verify(responseObserver).onCompleted();

        UserDataResponse response = responseCaptor.getValue();
        assertThat(response.getName()).isEqualTo("Alex Maria van Jansen");
        assertThat(response.getPreferredName()).isEqualTo("Alex");
        assertThat(response.getDateOfBirth()).isEqualTo("1995-02-12");
        assertThat(response.getStreetName()).isEqualTo("Hoogstraat");
        assertThat(response.getHouseNumber()).isEqualTo("14");
        assertThat(response.getHouseNumberSuffix()).isEqualTo("A");
        assertThat(response.getPostalCode()).isEqualTo("3011 PV");
        assertThat(response.getCity()).isEqualTo("Rotterdam");
        assertThat(response.getCountry()).isEqualTo("Netherlands");
        assertThat(response.getEmail()).isEqualTo("alex@example.com");
        assertThat(response.getMobileNumber()).isEqualTo("+31612345678");
        assertThat(response.getIban()).isEqualTo("NL91ABNA0417164300");
        assertThat(response.getCompanyId()).isEqualTo(companyId.toString());
        assertThat(response.getBsn()).isEqualTo("123456782");
        assertThat(response.getApplyLoonheffingskorting()).isTrue();
        assertThat(response.getPensionParticipant()).isTrue();
        assertThat(response.getSpecialZvwContribution()).isFalse();
        assertThat(response.getPayrollNotes()).isEqualTo("Bring safety shoes");
    }
}
