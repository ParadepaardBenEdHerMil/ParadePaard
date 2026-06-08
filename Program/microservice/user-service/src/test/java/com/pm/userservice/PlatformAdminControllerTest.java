package com.pm.userservice;

import com.pm.userservice.controller.PlatformAdminController;
import com.pm.userservice.dto.PlatformCompanyDetailDTO;
import com.pm.userservice.dto.PlatformCompanyListItemDTO;
import com.pm.userservice.dto.PlatformCompanyOnboardingRequestDTO;
import com.pm.userservice.dto.PlatformCompanyOnboardingResponseDTO;
import com.pm.userservice.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.reflect.Method;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PlatformAdminControllerTest {
    private final UserService userService = mock(UserService.class);
    private final PlatformAdminController controller = new PlatformAdminController(userService);

    @Test
    void platformEndpointsRequirePlatformPermission() throws Exception {
        Method listMethod = PlatformAdminController.class.getMethod("listCompanies");
        Method detailMethod = PlatformAdminController.class.getMethod("getCompany", UUID.class);
        Method onboardMethod = PlatformAdminController.class.getMethod(
                "onboardCompany",
                PlatformCompanyOnboardingRequestDTO.class
        );

        assertThat(listMethod.getAnnotation(PreAuthorize.class).value()).contains("CAN_MANAGE_PLATFORM");
        assertThat(detailMethod.getAnnotation(PreAuthorize.class).value()).contains("CAN_MANAGE_PLATFORM");
        assertThat(onboardMethod.getAnnotation(PreAuthorize.class).value()).contains("CAN_MANAGE_PLATFORM");
    }

    @Test
    void listCompaniesDelegatesToUserService() {
        PlatformCompanyListItemDTO dto = new PlatformCompanyListItemDTO();
        dto.setCompanyId("company-1");
        dto.setName("Acme Events");
        when(userService.listPlatformCompanies()).thenReturn(List.of(dto));

        ResponseEntity<List<PlatformCompanyListItemDTO>> response = controller.listCompanies();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).containsExactly(dto);
        verify(userService).listPlatformCompanies();
    }

    @Test
    void onboardCompanyReturnsCreatedResponse() {
        PlatformCompanyOnboardingRequestDTO request = new PlatformCompanyOnboardingRequestDTO();
        request.setCompanyName("Acme Events");
        request.setAdminFirstNames("Alex");
        request.setAdminMiddleNamePrefix("van");
        request.setAdminLastName("Stone");
        request.setAdminEmail("alex@acme.test");

        PlatformCompanyOnboardingResponseDTO responseDto = new PlatformCompanyOnboardingResponseDTO();
        responseDto.setCompanyId("company-1");
        responseDto.setCompanyName("Acme Events");
        responseDto.setAdminUserId("user-1");
        responseDto.setAdminEmail("alex@acme.test");
        responseDto.setTemporaryPassword("Generated123");

        when(userService.onboardPlatformCompany(request)).thenReturn(responseDto);

        ResponseEntity<PlatformCompanyOnboardingResponseDTO> response = controller.onboardCompany(request);

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody()).isEqualTo(responseDto);
    }

    @Test
    void getCompanyDelegatesToUserService() {
        UUID companyId = UUID.randomUUID();
        PlatformCompanyDetailDTO dto = new PlatformCompanyDetailDTO();
        dto.setCompanyId(companyId.toString());
        dto.setName("Acme Events");
        when(userService.getPlatformCompany(companyId)).thenReturn(dto);

        ResponseEntity<PlatformCompanyDetailDTO> response = controller.getCompany(companyId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo(dto);
        verify(userService).getPlatformCompany(companyId);
    }
}
