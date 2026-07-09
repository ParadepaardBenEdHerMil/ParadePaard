package com.pm.userservice;

import com.pm.userservice.dto.FeedbackEntryDTO;
import com.pm.userservice.dto.FeedbackRequestDTO;
import com.pm.userservice.model.FeedbackCategory;
import com.pm.userservice.model.FeedbackEntry;
import com.pm.userservice.model.FeedbackStatus;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.FeedbackEntryRepository;
import com.pm.userservice.repository.UserRepository;
import com.pm.userservice.service.FeedbackService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FeedbackServiceTest {

    private final FeedbackEntryRepository feedbackRepository = mock(FeedbackEntryRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final FeedbackService feedbackService = new FeedbackService(feedbackRepository, userRepository);

    @Test
    void createFeedbackSnapshotsAuthorNameAndFlagsAsMine() {
        UUID authorId = UUID.randomUUID();
        when(userRepository.findByUserId(authorId))
                .thenReturn(Optional.of(user(authorId, "Ava", "Jansen", "ava@example.com")));
        when(feedbackRepository.save(any(FeedbackEntry.class))).thenAnswer(FeedbackServiceTest::persist);

        FeedbackRequestDTO request = request("BUG", "  The planning page crashes on Friday.  ");
        FeedbackEntryDTO dto = feedbackService.createFeedback(authorId, request);

        assertThat(dto.getFeedbackId()).isNotBlank();
        assertThat(dto.getAuthorName()).isEqualTo("Ava Jansen");
        assertThat(dto.getCategory()).isEqualTo("BUG");
        assertThat(dto.getBody()).isEqualTo("The planning page crashes on Friday.");
        assertThat(dto.getStatus()).isEqualTo("PENDING");
        assertThat(dto.isMine()).isTrue();
    }

    @Test
    void anySignedInUserCanMarkFeedbackFinished() {
        UUID authorId = UUID.randomUUID();
        UUID triagerId = UUID.randomUUID();
        UUID feedbackId = UUID.randomUUID();
        when(feedbackRepository.findById(feedbackId))
                .thenReturn(Optional.of(entry(feedbackId, authorId, FeedbackCategory.BUG, "Broken")));
        when(feedbackRepository.save(any(FeedbackEntry.class))).thenAnswer(FeedbackServiceTest::persist);

        FeedbackEntryDTO dto = feedbackService.updateStatus(triagerId, feedbackId, "FINISHED");

        assertThat(dto.getStatus()).isEqualTo("FINISHED");
        // triager is not the author, so it is not flagged as theirs
        assertThat(dto.isMine()).isFalse();
    }

    @Test
    void updatingStatusWithUnknownValueIsBadRequest() {
        UUID feedbackId = UUID.randomUUID();
        when(feedbackRepository.findById(feedbackId))
                .thenReturn(Optional.of(entry(feedbackId, UUID.randomUUID(), FeedbackCategory.BUG, "Broken")));

        assertThatThrownBy(() -> feedbackService.updateStatus(UUID.randomUUID(), feedbackId, "DONE"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void listMarksOnlyTheRequestersOwnEntriesAsMine() {
        UUID requesterId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        FeedbackEntry mine = entry(UUID.randomUUID(), requesterId, FeedbackCategory.FEATURE, "Add dark mode");
        FeedbackEntry theirs = entry(UUID.randomUUID(), otherId, FeedbackCategory.CLEANUP, "Remove dead code");
        when(feedbackRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(mine, theirs));

        List<FeedbackEntryDTO> result = feedbackService.listFeedback(requesterId);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).isMine()).isTrue();
        assertThat(result.get(1).isMine()).isFalse();
    }

    @Test
    void updatingSomeoneElsesFeedbackIsForbidden() {
        UUID ownerId = UUID.randomUUID();
        UUID intruderId = UUID.randomUUID();
        UUID feedbackId = UUID.randomUUID();
        when(feedbackRepository.findById(feedbackId))
                .thenReturn(Optional.of(entry(feedbackId, ownerId, FeedbackCategory.BUG, "Original")));

        assertThatThrownBy(() ->
                feedbackService.updateFeedback(intruderId, feedbackId, request("BUG", "Hijacked")))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));

        verify(feedbackRepository, never()).save(any(FeedbackEntry.class));
    }

    @Test
    void updatingOwnFeedbackStampsUpdatedAt() {
        UUID ownerId = UUID.randomUUID();
        UUID feedbackId = UUID.randomUUID();
        when(feedbackRepository.findById(feedbackId))
                .thenReturn(Optional.of(entry(feedbackId, ownerId, FeedbackCategory.BUG, "Original")));
        when(feedbackRepository.save(any(FeedbackEntry.class))).thenAnswer(FeedbackServiceTest::persist);

        FeedbackEntryDTO dto = feedbackService.updateFeedback(ownerId, feedbackId, request("FEATURE", "Reworded"));

        assertThat(dto.getCategory()).isEqualTo("FEATURE");
        assertThat(dto.getBody()).isEqualTo("Reworded");
        assertThat(dto.getUpdatedAt()).isNotNull();
    }

    @Test
    void deletingMissingFeedbackIsNotFound() {
        UUID feedbackId = UUID.randomUUID();
        when(feedbackRepository.findById(feedbackId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> feedbackService.deleteFeedback(UUID.randomUUID(), feedbackId))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void ownerCanDeleteTheirFeedback() {
        UUID ownerId = UUID.randomUUID();
        UUID feedbackId = UUID.randomUUID();
        FeedbackEntry entry = entry(feedbackId, ownerId, FeedbackCategory.CLEANUP, "Tidy up");
        when(feedbackRepository.findById(feedbackId)).thenReturn(Optional.of(entry));

        feedbackService.deleteFeedback(ownerId, feedbackId);

        verify(feedbackRepository).delete(entry);
    }

    private static FeedbackEntry persist(org.mockito.invocation.InvocationOnMock invocation) {
        FeedbackEntry entry = invocation.getArgument(0);
        if (entry.getFeedbackId() == null) entry.setFeedbackId(UUID.randomUUID());
        if (entry.getCreatedAt() == null) entry.setCreatedAt(OffsetDateTime.now());
        if (entry.getStatus() == null) entry.setStatus(FeedbackStatus.PENDING);
        return entry;
    }

    private static FeedbackRequestDTO request(String category, String body) {
        FeedbackRequestDTO request = new FeedbackRequestDTO();
        request.setCategory(category);
        request.setBody(body);
        return request;
    }

    private static FeedbackEntry entry(UUID feedbackId, UUID authorId, FeedbackCategory category, String body) {
        FeedbackEntry entry = new FeedbackEntry();
        entry.setFeedbackId(feedbackId);
        entry.setAuthorUserId(authorId);
        entry.setAuthorName("Author " + authorId);
        entry.setCategory(category);
        entry.setStatus(FeedbackStatus.PENDING);
        entry.setBody(body);
        entry.setCreatedAt(OffsetDateTime.now());
        return entry;
    }

    private static User user(UUID userId, String firstNames, String lastName, String email) {
        User user = new User();
        user.setUserId(userId);
        user.setFirstNames(firstNames);
        user.setLastName(lastName);
        user.setEmail(email);
        return user;
    }
}
