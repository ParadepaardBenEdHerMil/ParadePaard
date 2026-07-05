package com.pm.userservice;

import com.pm.userservice.controller.UserController;
import com.pm.userservice.dto.WorkHistoryColumnsPreferenceDTO;
import com.pm.userservice.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UserControllerTest {

    private final UserService userService = mock(UserService.class);
    private final UserController controller = new UserController(
            userService,
            new com.pm.userservice.security.InternalServiceTokenService(""));

    @Test
    void idDocumentImageEndpointAllowsUserAndOnboardingReviewPermissions() throws Exception {
        Method method = UserController.class.getMethod("getUserIdDocumentImage", UUID.class, org.springframework.security.core.Authentication.class);
        PreAuthorize annotation = method.getAnnotation(PreAuthorize.class);

        assertThat(annotation).isNotNull();
        assertThat(annotation.value()).contains("CAN_VIEW_USERS");
        assertThat(annotation.value()).contains("CAN_VIEW_ONBOARDING_QUEUE");
        assertThat(annotation.value()).contains("CAN_REVIEW_ONBOARDING");
    }

    @Test
    void idDocumentBackImageEndpointAllowsUserAndOnboardingReviewPermissions() throws Exception {
        Method method = UserController.class.getMethod("getUserIdDocumentBackImage", UUID.class, org.springframework.security.core.Authentication.class);
        PreAuthorize annotation = method.getAnnotation(PreAuthorize.class);

        assertThat(annotation).isNotNull();
        assertThat(annotation.value()).contains("CAN_VIEW_USERS");
        assertThat(annotation.value()).contains("CAN_VIEW_ONBOARDING_QUEUE");
        assertThat(annotation.value()).contains("CAN_REVIEW_ONBOARDING");
    }

    @Test
    void idDocumentImageUsesSafeContentTypeNoStoreAnd404WhenMissing() {
        UUID userId = UUID.randomUUID();
        byte[] imageBytes = "image".getBytes(StandardCharsets.UTF_8);
        when(userService.getIdDocumentImage(userId)).thenReturn(Optional.of(
                new UserService.IdDocumentImage(imageBytes, "invalid media type")
        ));

        ResponseEntity<byte[]> response = controller.getUserIdDocumentImage(userId, null);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_OCTET_STREAM);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo(CacheControl.noStore().getHeaderValue());
        assertThat(response.getBody()).isEqualTo(imageBytes);

        UUID missingUserId = UUID.randomUUID();
        when(userService.getIdDocumentImage(missingUserId)).thenReturn(Optional.empty());

        ResponseEntity<byte[]> missing = controller.getUserIdDocumentImage(missingUserId, null);

        assertThat(missing.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void idDocumentBackImageUsesSafeContentTypeNoStoreAnd404WhenMissing() {
        UUID userId = UUID.randomUUID();
        byte[] imageBytes = "back-image".getBytes(StandardCharsets.UTF_8);
        when(userService.getIdDocumentBackImage(userId)).thenReturn(Optional.of(
                new UserService.IdDocumentImage(imageBytes, "image/jpeg")
        ));

        ResponseEntity<byte[]> response = controller.getUserIdDocumentBackImage(userId, null);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.IMAGE_JPEG);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo(CacheControl.noStore().getHeaderValue());
        assertThat(response.getBody()).isEqualTo(imageBytes);

        UUID missingUserId = UUID.randomUUID();
        when(userService.getIdDocumentBackImage(missingUserId)).thenReturn(Optional.empty());

        ResponseEntity<byte[]> missing = controller.getUserIdDocumentBackImage(missingUserId, null);

        assertThat(missing.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void workHistoryColumnPreferenceReadsTheCurrentUsersSavedColumns() {
        UUID userId = UUID.randomUUID();
        JwtAuthenticationToken authentication = authenticationFor(userId);
        WorkHistoryColumnsPreferenceDTO preference = new WorkHistoryColumnsPreferenceDTO(List.of("date", "employee"));
        when(userService.getWorkHistoryColumnsPreference(userId)).thenReturn(preference);

        ResponseEntity<WorkHistoryColumnsPreferenceDTO> response =
                controller.getMyWorkHistoryColumnsPreference(authentication);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo(preference);
    }

    @Test
    void workHistoryColumnPreferenceSavesTheCurrentUsersColumns() {
        UUID userId = UUID.randomUUID();
        JwtAuthenticationToken authentication = authenticationFor(userId);
        WorkHistoryColumnsPreferenceDTO request = new WorkHistoryColumnsPreferenceDTO(List.of("date", "hours"));
        WorkHistoryColumnsPreferenceDTO saved = new WorkHistoryColumnsPreferenceDTO(List.of("date", "hours"));
        when(userService.updateWorkHistoryColumnsPreference(userId, request)).thenReturn(saved);

        ResponseEntity<WorkHistoryColumnsPreferenceDTO> response =
                controller.updateMyWorkHistoryColumnsPreference(authentication, request);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo(saved);
        verify(userService).updateWorkHistoryColumnsPreference(userId, request);
    }

    @Test
    void deleteUserRequiresDedicatedDeletePermissionAndDisallowsSelfDelete() throws Exception {
        Method method = UserController.class.getMethod(
                "deleteUser",
                UUID.class,
                org.springframework.security.core.Authentication.class,
                jakarta.servlet.http.HttpServletRequest.class
        );
        PreAuthorize annotation = method.getAnnotation(PreAuthorize.class);

        assertThat(annotation).isNotNull();
        assertThat(annotation.value()).contains("CAN_DELETE_USERS");
        assertThat(annotation.value()).contains("!@userPermission.isSelf(#id, authentication)");
        assertThat(annotation.value()).doesNotContain("CAN_MANAGE_USERS");
    }

    private static JwtAuthenticationToken authenticationFor(UUID userId) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("userId", userId.toString())
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();
        return new JwtAuthenticationToken(jwt);
    }
}
