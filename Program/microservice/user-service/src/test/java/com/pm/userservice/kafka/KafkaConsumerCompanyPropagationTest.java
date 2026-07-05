package com.pm.userservice.kafka;

import com.pm.userservice.model.Company;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.CompanyRepository;
import com.pm.userservice.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import user.events.UserRegisteredEvent;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KafkaConsumerCompanyPropagationTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private CompanyRepository companyRepository;

    private KafkaConsumer consumer;

    @BeforeEach
    void setUp() {
        consumer = new KafkaConsumer(userRepository, companyRepository);
        when(userRepository.existsById(any(UUID.class))).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void createsDistinctCompanyStubsWhenMultipleCompaniesRegisterUsersWithoutNames() {
        UUID firstCompanyId = UUID.fromString("10000000-0000-0000-0000-000000000001");
        UUID secondCompanyId = UUID.fromString("20000000-0000-0000-0000-000000000002");
        when(companyRepository.findById(firstCompanyId)).thenReturn(Optional.empty());
        when(companyRepository.findById(secondCompanyId)).thenReturn(Optional.empty());

        consumer.consumeEvent(userRegisteredEvent(UUID.randomUUID(), firstCompanyId, "").toByteArray());
        consumer.consumeEvent(userRegisteredEvent(UUID.randomUUID(), secondCompanyId, "").toByteArray());

        ArgumentCaptor<Company> companyCaptor = ArgumentCaptor.forClass(Company.class);
        verify(companyRepository, org.mockito.Mockito.times(2)).save(companyCaptor.capture());

        List<Company> savedCompanies = companyCaptor.getAllValues();
        assertEquals("company-" + firstCompanyId, savedCompanies.get(0).getName());
        assertEquals("company-" + secondCompanyId, savedCompanies.get(1).getName());
        assertNotEquals(savedCompanies.get(0).getName(), savedCompanies.get(1).getName());
    }

    @Test
    void fallsBackToCompanyIdWhenEventCompanyNameAlreadyExists() {
        UUID companyId = UUID.fromString("30000000-0000-0000-0000-000000000003");
        Company existing = new Company();
        existing.setId(UUID.randomUUID());
        existing.setName("Acme");
        when(companyRepository.findById(companyId)).thenReturn(Optional.empty());
        when(companyRepository.findByName("Acme")).thenReturn(Optional.of(existing));

        consumer.consumeEvent(userRegisteredEvent(UUID.randomUUID(), companyId, "Acme").toByteArray());

        ArgumentCaptor<Company> companyCaptor = ArgumentCaptor.forClass(Company.class);
        verify(companyRepository).save(companyCaptor.capture());
        assertEquals("company-" + companyId, companyCaptor.getValue().getName());
    }

    private static UserRegisteredEvent userRegisteredEvent(UUID userId, UUID companyId, String companyName) {
        return UserRegisteredEvent.newBuilder()
                .setUserId(userId.toString())
                .setEmail(userId + "@example.test")
                .setEventType("USER_REGISTERED")
                .setCompanyId(companyId.toString())
                .setCompanyName(companyName)
                .build();
    }
}
