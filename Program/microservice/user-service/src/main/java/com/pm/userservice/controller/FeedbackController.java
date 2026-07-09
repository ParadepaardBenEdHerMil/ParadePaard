package com.pm.userservice.controller;

import com.pm.userservice.dto.FeedbackEntryDTO;
import com.pm.userservice.dto.FeedbackRequestDTO;
import com.pm.userservice.dto.FeedbackStatusRequestDTO;
import com.pm.userservice.service.FeedbackService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/feedback")
@Tag(name = "Feedback", description = "Product feedback left from the navbar widget")
public class FeedbackController {
    private final FeedbackService feedbackService;

    public FeedbackController(FeedbackService feedbackService) {
        this.feedbackService = feedbackService;
    }

    @GetMapping
    @Operation(summary = "List all feedback entries, newest first")
    public ResponseEntity<List<FeedbackEntryDTO>> listFeedback(Authentication authentication) {
        return ResponseEntity.ok(feedbackService.listFeedback(requireUserId(authentication)));
    }

    @PostMapping
    @Operation(summary = "Leave a new piece of feedback")
    public ResponseEntity<FeedbackEntryDTO> createFeedback(
            Authentication authentication,
            @Valid @RequestBody FeedbackRequestDTO request
    ) {
        return ResponseEntity.ok(feedbackService.createFeedback(requireUserId(authentication), request));
    }

    @PutMapping("/{feedbackId}")
    @Operation(summary = "Edit one of your own feedback entries")
    public ResponseEntity<FeedbackEntryDTO> updateFeedback(
            Authentication authentication,
            @PathVariable UUID feedbackId,
            @Valid @RequestBody FeedbackRequestDTO request
    ) {
        return ResponseEntity.ok(feedbackService.updateFeedback(requireUserId(authentication), feedbackId, request));
    }

    @PutMapping("/{feedbackId}/status")
    @Operation(summary = "Mark feedback finished or reopen it (any signed-in user)")
    public ResponseEntity<FeedbackEntryDTO> updateStatus(
            Authentication authentication,
            @PathVariable UUID feedbackId,
            @Valid @RequestBody FeedbackStatusRequestDTO request
    ) {
        return ResponseEntity.ok(
                feedbackService.updateStatus(requireUserId(authentication), feedbackId, request.getStatus()));
    }

    @DeleteMapping("/{feedbackId}")
    @Operation(summary = "Delete one of your own feedback entries")
    public ResponseEntity<Void> deleteFeedback(
            Authentication authentication,
            @PathVariable UUID feedbackId
    ) {
        feedbackService.deleteFeedback(requireUserId(authentication), feedbackId);
        return ResponseEntity.noContent().build();
    }

    private UUID requireUserId(Authentication authentication) {
        if (authentication == null) {
            throw new IllegalArgumentException("Missing authentication");
        }
        String raw = authentication.getName();
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            String claim = jwtAuth.getToken().getClaimAsString("userId");
            if (claim != null && !claim.isBlank()) {
                raw = claim;
            }
        }
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("Missing userId");
        }
        return UUID.fromString(raw);
    }
}
