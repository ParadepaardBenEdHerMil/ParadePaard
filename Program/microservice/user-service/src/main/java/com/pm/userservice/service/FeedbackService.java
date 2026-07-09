package com.pm.userservice.service;

import com.pm.userservice.dto.FeedbackEntryDTO;
import com.pm.userservice.dto.FeedbackRequestDTO;
import com.pm.userservice.exception.UserNotFoundException;
import com.pm.userservice.model.FeedbackCategory;
import com.pm.userservice.model.FeedbackEntry;
import com.pm.userservice.model.FeedbackStatus;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.FeedbackEntryRepository;
import com.pm.userservice.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Backs the navbar feedback widget. Feedback is readable by every signed-in user, but
 * only the author may edit or delete their own entry.
 */
@Service
public class FeedbackService {
    private final FeedbackEntryRepository feedbackRepository;
    private final UserRepository userRepository;

    public FeedbackService(FeedbackEntryRepository feedbackRepository, UserRepository userRepository) {
        this.feedbackRepository = feedbackRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public List<FeedbackEntryDTO> listFeedback(UUID requesterId) {
        return feedbackRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(entry -> toDTO(entry, requesterId))
                .toList();
    }

    @Transactional
    public FeedbackEntryDTO createFeedback(UUID authorUserId, FeedbackRequestDTO request) {
        User author = getUser(authorUserId);

        FeedbackEntry entry = new FeedbackEntry();
        entry.setAuthorUserId(authorUserId);
        entry.setAuthorName(displayName(author));
        entry.setCategory(parseCategory(request.getCategory()));
        entry.setStatus(FeedbackStatus.PENDING);
        entry.setBody(normalizeBody(request.getBody()));

        FeedbackEntry saved = feedbackRepository.save(entry);
        return toDTO(saved, authorUserId);
    }

    @Transactional
    public FeedbackEntryDTO updateFeedback(UUID requesterId, UUID feedbackId, FeedbackRequestDTO request) {
        FeedbackEntry entry = getOwnedEntry(requesterId, feedbackId);
        entry.setCategory(parseCategory(request.getCategory()));
        entry.setBody(normalizeBody(request.getBody()));
        entry.setUpdatedAt(OffsetDateTime.now());
        return toDTO(feedbackRepository.save(entry), requesterId);
    }

    @Transactional
    public FeedbackEntryDTO updateStatus(UUID requesterId, UUID feedbackId, String statusRaw) {
        // Triage is a shared action: any signed-in user can mark feedback finished or
        // reopen it, unlike editing/deleting which stays author-only.
        FeedbackEntry entry = feedbackRepository.findById(feedbackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Feedback not found"));
        entry.setStatus(parseStatus(statusRaw));
        return toDTO(feedbackRepository.save(entry), requesterId);
    }

    @Transactional
    public void deleteFeedback(UUID requesterId, UUID feedbackId) {
        FeedbackEntry entry = getOwnedEntry(requesterId, feedbackId);
        feedbackRepository.delete(entry);
    }

    private FeedbackEntry getOwnedEntry(UUID requesterId, UUID feedbackId) {
        FeedbackEntry entry = feedbackRepository.findById(feedbackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Feedback not found"));
        if (!entry.getAuthorUserId().equals(requesterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only change your own feedback");
        }
        return entry;
    }

    private FeedbackCategory parseCategory(String raw) {
        try {
            return FeedbackCategory.valueOf(raw);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown feedback category");
        }
    }

    private FeedbackStatus parseStatus(String raw) {
        try {
            return FeedbackStatus.valueOf(raw);
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown feedback status");
        }
    }

    private String normalizeBody(String body) {
        String normalized = body == null ? "" : body.trim();
        if (normalized.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Feedback text is required");
        }
        if (normalized.length() > 4000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Feedback can be at most 4000 characters");
        }
        return normalized;
    }

    private User getUser(UUID userId) {
        return userRepository.findByUserId(userId)
                .orElseThrow(() -> new UserNotFoundException("User " + userId + " not found"));
    }

    private FeedbackEntryDTO toDTO(FeedbackEntry entry, UUID requesterId) {
        FeedbackEntryDTO dto = new FeedbackEntryDTO();
        dto.setFeedbackId(entry.getFeedbackId().toString());
        dto.setAuthorUserId(entry.getAuthorUserId().toString());
        dto.setAuthorName(entry.getAuthorName());
        dto.setCategory(entry.getCategory().name());
        dto.setStatus(entry.getStatus() != null ? entry.getStatus().name() : FeedbackStatus.PENDING.name());
        dto.setBody(entry.getBody());
        dto.setCreatedAt(entry.getCreatedAt() != null ? entry.getCreatedAt().toString() : null);
        dto.setUpdatedAt(entry.getUpdatedAt() != null ? entry.getUpdatedAt().toString() : null);
        dto.setMine(entry.getAuthorUserId().equals(requesterId));
        return dto;
    }

    private String displayName(User user) {
        if (user == null) return "-";
        String name = String.join(" ",
                Stream.of(user.getFirstNames(), user.getMiddleNamePrefix(), user.getLastName())
                        .filter(part -> part != null && !part.isBlank())
                        .map(String::trim)
                        .toList());
        if (!name.isBlank()) return name;
        if (user.getPreferredName() != null && !user.getPreferredName().isBlank()) return user.getPreferredName();
        return user.getEmail() != null ? user.getEmail() : "-";
    }
}
