package com.pm.userservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pm.userservice.dto.WorkHistoryColumnsPreferenceDTO;
import com.pm.userservice.exception.UserNotFoundException;
import com.pm.userservice.integration.AuthServiceClient;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.CaoTemplateRepository;
import com.pm.userservice.repository.CompanyRepository;
import com.pm.userservice.repository.JobApplicationRepository;
import com.pm.userservice.repository.UserRepository;
import com.pm.userservice.validation.UserDuplicateValidator;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * TS-6: per-user work-history column preferences persist, are cleaned (trimmed, de-duplicated,
 * blanks dropped) and are scoped to the authenticated user.
 */
class UserServiceWorkHistoryPreferenceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final UserService service = new UserService(
            userRepository,
            mock(CompanyRepository.class),
            mock(CaoTemplateRepository.class),
            mock(UserDuplicateValidator.class),
            objectMapper,
            mock(AuthServiceClient.class),
            mock(JobApplicationRepository.class));

    private final UUID userId = UUID.randomUUID();

    private User user() {
        User u = new User();
        u.setUserId(userId);
        return u;
    }

    @Test
    void updateCleansTrimsAndDeduplicatesColumnsAndPersists() {
        User user = user();
        when(userRepository.findByUserId(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        WorkHistoryColumnsPreferenceDTO result = service.updateWorkHistoryColumnsPreference(
                userId, new WorkHistoryColumnsPreferenceDTO(Arrays.asList("date", " hours ", "", "date")));

        assertThat(result.columns()).containsExactly("date", "hours");
        assertThat(user.getWorkHistoryColumnsJson()).isNotBlank();
        verify(userRepository).save(user);
    }

    @Test
    void getReadsBackStoredColumns() throws Exception {
        User user = user();
        user.setWorkHistoryColumnsJson(objectMapper.writeValueAsString(List.of("date", "project", "hours")));
        when(userRepository.findByUserId(userId)).thenReturn(Optional.of(user));

        WorkHistoryColumnsPreferenceDTO result = service.getWorkHistoryColumnsPreference(userId);

        assertThat(result.columns()).containsExactly("date", "project", "hours");
    }

    @Test
    void updateWithNullPreferenceStoresEmptyList() {
        User user = user();
        when(userRepository.findByUserId(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        WorkHistoryColumnsPreferenceDTO result = service.updateWorkHistoryColumnsPreference(userId, null);

        assertThat(result.columns()).isEmpty();
    }

    @Test
    void unknownUserIsRejected() {
        when(userRepository.findByUserId(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getWorkHistoryColumnsPreference(userId))
                .isInstanceOf(UserNotFoundException.class);
        assertThatThrownBy(() -> service.updateWorkHistoryColumnsPreference(
                userId, new WorkHistoryColumnsPreferenceDTO(List.of("date"))))
                .isInstanceOf(UserNotFoundException.class);
    }
}
