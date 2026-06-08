package com.pm.userservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pm.userservice.dto.AuthRegisterResponseDTO;
import com.pm.userservice.dto.PlatformCompanyDetailDTO;
import com.pm.userservice.dto.PlatformCompanyListItemDTO;
import com.pm.userservice.dto.PlatformCompanyOnboardingRequestDTO;
import com.pm.userservice.dto.PlatformCompanyOnboardingResponseDTO;
import com.pm.userservice.integration.AuthServiceClient;
import com.pm.userservice.model.Company;
import com.pm.userservice.model.UserStatus;
import com.pm.userservice.repository.CaoTemplateRepository;
import com.pm.userservice.repository.CompanyRepository;
import com.pm.userservice.repository.UserRepository;
import com.pm.userservice.validation.UserDuplicateValidator;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PlatformAdminServiceTest {
    private final UserRepository userRepository = mock(UserRepository.class);
    private final CompanyRepository companyRepository = mock(CompanyRepository.class);
    private final CaoTemplateRepository caoTemplateRepository = mock(CaoTemplateRepository.class);
    private final UserDuplicateValidator userDuplicateValidator = mock(UserDuplicateValidator.class);
    private final AuthServiceClient authServiceClient = mock(AuthServiceClient.class);
    private final UserService service = new UserService(
            userRepository,
            companyRepository,
            caoTemplateRepository,
            userDuplicateValidator,
            new ObjectMapper(),
            authServiceClient
    );

    @Test
    void listPlatformCompaniesBuildsSummaryCounts() {
        Company company = company("Acme Events");
        when(companyRepository.findAllByOrderByNameAsc()).thenReturn(List.of(company));
        when(userRepository.countByCompanyId(company.getId())).thenReturn(12L);
        when(userRepository.countByCompanyIdAndStatus(company.getId(), UserStatus.ACTIVE)).thenReturn(9L);
        when(
                userRepository.countByCompanyIdAndStatusIn(
                        company.getId(),
                        List.of(
                                UserStatus.PENDING_PROFILE_REVIEW,
                                UserStatus.CHANGES_REQUESTED,
                                UserStatus.PENDING_CONTRACT_SIGNATURE,
                                UserStatus.PENDING_CONTRACT_REVIEW
                        )
                )
        ).thenReturn(2L);

        List<PlatformCompanyListItemDTO> result = service.listPlatformCompanies();

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().getName()).isEqualTo("Acme Events");
        assertThat(result.getFirst().getTotalUsers()).isEqualTo(12);
        assertThat(result.getFirst().getActiveUsers()).isEqualTo(9);
        assertThat(result.getFirst().getPendingOnboardingReview()).isEqualTo(2);
    }

    @Test
    void getPlatformCompanyBuildsACompanySnapshot() {
        Company company = company("Acme Events");
        when(companyRepository.findById(company.getId())).thenReturn(Optional.of(company));
        when(userRepository.countByCompanyId(company.getId())).thenReturn(12L);
        when(userRepository.countByCompanyIdAndStatus(company.getId(), UserStatus.ACTIVE)).thenReturn(9L);
        when(userRepository.countByCompanyIdAndStatusIn(company.getId(), List.of(
                UserStatus.PENDING_PROFILE_REVIEW,
                UserStatus.CHANGES_REQUESTED,
                UserStatus.PENDING_CONTRACT_SIGNATURE,
                UserStatus.PENDING_CONTRACT_REVIEW
        ))).thenReturn(2L);

        PlatformCompanyDetailDTO result = service.getPlatformCompany(company.getId());

        assertThat(result.getCompanyId()).isEqualTo(company.getId().toString());
        assertThat(result.getName()).isEqualTo("Acme Events");
        assertThat(result.getTotalUsers()).isEqualTo(12);
    }

    @Test
    void onboardPlatformCompanyDelegatesToAuthRegister() {
        PlatformCompanyOnboardingRequestDTO request = new PlatformCompanyOnboardingRequestDTO();
        request.setCompanyName("Acme Events");
        request.setAdminFirstNames("Alex");
        request.setAdminMiddleNamePrefix("van");
        request.setAdminLastName("Stone");
        request.setAdminEmail("alex@acme.test");

        AuthRegisterResponseDTO authResponse = new AuthRegisterResponseDTO();
        authResponse.setCompanyId("company-1");
        authResponse.setUserId("user-1");
        authResponse.setEmail("alex@acme.test");
        authResponse.setUsername("alex.stone");
        when(authServiceClient.register(org.mockito.ArgumentMatchers.any())).thenReturn(authResponse);

        PlatformCompanyOnboardingResponseDTO response = service.onboardPlatformCompany(request);

        ArgumentCaptor<com.pm.userservice.dto.AuthRegisterRequestDTO> captor =
                ArgumentCaptor.forClass(com.pm.userservice.dto.AuthRegisterRequestDTO.class);
        verify(authServiceClient).register(captor.capture());
        assertThat(captor.getValue().getCompanyName()).isEqualTo("Acme Events");
        assertThat(captor.getValue().getFirstName()).isEqualTo("Alex");
        assertThat(captor.getValue().getMiddleNamePrefix()).isEqualTo("van");
        assertThat(captor.getValue().getLastName()).isEqualTo("Stone");
        assertThat(captor.getValue().isMustChangePassword()).isTrue();
        assertThat(captor.getValue().getPassword()).isNotBlank();
        assertThat(response.getCompanyId()).isEqualTo("company-1");
        assertThat(response.getAdminUserId()).isEqualTo("user-1");
        assertThat(response.getUsername()).isEqualTo("alex.stone");
        assertThat(response.getTemporaryPassword()).isNotBlank();
    }

    private static Company company(String name) {
        Company company = new Company();
        company.setId(UUID.randomUUID());
        company.setName(name);
        company.setPayoutFrequencyMinutes(10080);
        company.setTimesheetLoggingMode("ADMIN_FINALIZE");
        company.setTravelClaimMode("REQUIRES_APPROVAL");
        return company;
    }
}
