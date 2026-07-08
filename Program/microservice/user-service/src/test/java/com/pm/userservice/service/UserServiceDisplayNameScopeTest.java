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

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * S1: display-name resolution is company-scoped for user callers, unscoped for internal
 * services (companyId == null).
 */
class UserServiceDisplayNameScopeTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserService service = new UserService(
            userRepository,
            mock(CompanyRepository.class),
            mock(CaoTemplateRepository.class),
            mock(UserDuplicateValidator.class),
            new ObjectMapper(),
            mock(AuthServiceClient.class),
            mock(JobApplicationRepository.class));

    private User user(UUID id, UUID companyId) {
        User u = new User();
        u.setUserId(id);
        u.setCompanyId(companyId);
        u.setPreferredName("Name-" + id);
        return u;
    }

    @Test
    void userCaller_onlyResolvesNamesInOwnCompany() {
        UUID companyA = UUID.randomUUID();
        UUID companyB = UUID.randomUUID();
        UUID inA = UUID.randomUUID();
        UUID inB = UUID.randomUUID();
        when(userRepository.findByUserIdIn(List.of(inA, inB)))
                .thenReturn(List.of(user(inA, companyA), user(inB, companyB)));

        Map<String, String> result = service.getDisplayNamesByUserIds(List.of(inA, inB), companyA);

        assertThat(result).containsKey(inA.toString());
        assertThat(result).doesNotContainKey(inB.toString());
    }

    @Test
    void internalCaller_resolvesAcrossCompanies() {
        UUID companyA = UUID.randomUUID();
        UUID companyB = UUID.randomUUID();
        UUID inA = UUID.randomUUID();
        UUID inB = UUID.randomUUID();
        when(userRepository.findByUserIdIn(List.of(inA, inB)))
                .thenReturn(List.of(user(inA, companyA), user(inB, companyB)));

        Map<String, String> result = service.getDisplayNamesByUserIds(List.of(inA, inB), null);

        assertThat(result).containsKeys(inA.toString(), inB.toString());
    }
}
