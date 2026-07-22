package com.pm.userservice.service;

import com.pm.userservice.dto.EmailPresetResponseDTO;
import com.pm.userservice.dto.EmailPresetSaveDTO;
import com.pm.userservice.model.EmailPreset;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.EmailPresetAttachmentRepository;
import com.pm.userservice.repository.EmailPresetRepository;
import com.pm.userservice.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

class EmailPresetServiceTest {
    private final EmailPresetRepository repository = mock(EmailPresetRepository.class);
    private final EmailPresetAttachmentRepository attachmentRepository = mock(EmailPresetAttachmentRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final AppEmailSender appEmailSender = mock(AppEmailSender.class);
    private final MergeFieldResolver mergeFieldResolver = new MergeFieldResolver("http://localhost:5173");
    private final EmailPresetService service = new EmailPresetService(
            repository, attachmentRepository, userRepository, appEmailSender, mergeFieldResolver);

    private static final UUID ACTOR_ID = UUID.randomUUID();
    private static final UUID COMPANY_ID = UUID.randomUUID();

    private void stubActorAndSave() {
        User actor = new User();
        actor.setUserId(ACTOR_ID);
        actor.setCompanyId(COMPANY_ID);
        when(userRepository.findByUserId(ACTOR_ID)).thenReturn(Optional.of(actor));
        when(repository.save(any(EmailPreset.class))).thenAnswer(invocation -> {
            EmailPreset preset = invocation.getArgument(0);
            preset.setId(UUID.randomUUID());
            return preset;
        });
        when(attachmentRepository.findByPresetIdOrderByCreatedAtAsc(any())).thenReturn(List.of());
    }

    private static EmailPresetSaveDTO save(String group, String category) {
        EmailPresetSaveDTO dto = new EmailPresetSaveDTO();
        dto.setGroupType(group);
        dto.setCategory(category);
        dto.setName("Preset");
        dto.setSubject("Subject");
        dto.setBody("Body");
        return dto;
    }

    @Test
    void createAllowsAcceptCategoryForApplications() {
        stubActorAndSave();

        EmailPresetResponseDTO created = service.create(save("APPLICATIONS", "ACCEPT"), ACTOR_ID.toString());

        assertThat(created.getGroupType()).isEqualTo("APPLICATIONS");
        assertThat(created.getCategory()).isEqualTo("ACCEPT");
    }

    @Test
    void createStillAllowsRejectCategoryForApplications() {
        stubActorAndSave();

        EmailPresetResponseDTO created = service.create(save("APPLICATIONS", "REJECT"), ACTOR_ID.toString());

        assertThat(created.getCategory()).isEqualTo("REJECT");
    }

    @Test
    void createRejectsAcceptCategoryForOnboarding() {
        User actor = new User();
        actor.setUserId(ACTOR_ID);
        actor.setCompanyId(COMPANY_ID);
        when(userRepository.findByUserId(ACTOR_ID)).thenReturn(Optional.of(actor));

        // Onboarding review has no accept step, so ACCEPT is not a valid category there.
        assertThatThrownBy(() -> service.create(save("ONBOARDING", "ACCEPT"), ACTOR_ID.toString()))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex -> {
                    assertThat(ex.getStatusCode()).isEqualTo(BAD_REQUEST);
                    assertThat(ex.getReason()).isEqualTo("ONBOARDING presets must be categorised as REJECT or REQUEST_CHANGES");
                });
    }
}
