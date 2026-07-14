package com.pm.userservice.controller;

import com.pm.userservice.dto.EmailPresetResponseDTO;
import com.pm.userservice.dto.EmailPresetSaveDTO;
import com.pm.userservice.dto.EmailPresetSendRequestDTO;
import com.pm.userservice.dto.EmailPresetSendResponseDTO;
import com.pm.userservice.service.EmailPresetService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
@RequestMapping("/admin/email-presets")
public class EmailPresetController {

    private final EmailPresetService service;

    public EmailPresetController(EmailPresetService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "List the company's email presets")
    @PreAuthorize("hasAuthority('CAN_MANAGE_MESSAGES')")
    public ResponseEntity<List<EmailPresetResponseDTO>> list(Authentication authentication) {
        return ResponseEntity.ok(service.list(actorUserId(authentication)));
    }

    @PostMapping
    @Operation(summary = "Create an email preset")
    @PreAuthorize("hasAuthority('CAN_MANAGE_MESSAGES')")
    public ResponseEntity<EmailPresetResponseDTO> create(
            @Valid @RequestBody EmailPresetSaveDTO request,
            Authentication authentication) {
        return ResponseEntity.ok(service.create(request, actorUserId(authentication)));
    }

    @PutMapping("/{presetId}")
    @Operation(summary = "Update an email preset")
    @PreAuthorize("hasAuthority('CAN_MANAGE_MESSAGES')")
    public ResponseEntity<EmailPresetResponseDTO> update(
            @PathVariable UUID presetId,
            @Valid @RequestBody EmailPresetSaveDTO request,
            Authentication authentication) {
        return ResponseEntity.ok(service.update(presetId, request, actorUserId(authentication)));
    }

    @DeleteMapping("/{presetId}")
    @Operation(summary = "Delete an email preset")
    @PreAuthorize("hasAuthority('CAN_MANAGE_MESSAGES')")
    public ResponseEntity<Void> delete(@PathVariable UUID presetId, Authentication authentication) {
        service.delete(presetId, actorUserId(authentication));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{presetId}/send")
    @Operation(summary = "Send a preset to a set of users (shift/project members or an account)")
    @PreAuthorize("hasAuthority('CAN_MANAGE_MESSAGES')")
    public ResponseEntity<EmailPresetSendResponseDTO> send(
            @PathVariable UUID presetId,
            @RequestBody EmailPresetSendRequestDTO request,
            Authentication authentication) {
        return ResponseEntity.ok(service.send(
                presetId,
                request == null ? List.of() : request.getUserIds(),
                actorUserId(authentication)));
    }

    private static String actorUserId(Authentication authentication) {
        if (authentication == null) {
            return null;
        }
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            String userId = jwtAuth.getToken().getClaimAsString("userId");
            if (userId != null && !userId.isBlank()) {
                return userId;
            }
        }
        return authentication.getName();
    }
}
