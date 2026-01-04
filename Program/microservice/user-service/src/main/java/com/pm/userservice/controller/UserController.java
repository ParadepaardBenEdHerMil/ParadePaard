// src/main/java/com/pm/userservice/controller/UserController.java
package com.pm.userservice.controller;

import com.pm.userservice.dto.UserRequestDTO;
import com.pm.userservice.dto.UserResponseDTO;
import com.pm.userservice.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.groups.Default;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/users")
@Tag(name = "User", description = "API for managing Users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService){
        this.userService = userService;
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

    @GetMapping("/me")
    @Operation(summary = "Return current user profile from the token")
    public ResponseEntity<UserResponseDTO> me(Authentication authentication) {
        try {
            UUID userId = requireUserId(authentication);
            UserResponseDTO userResponseDTO = userService.getUserById(userId);
            return ResponseEntity.ok(userResponseDTO);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(401).build();
        }
    }

    @GetMapping("/me/profile-picture")
    @Operation(summary = "Get current user's profile picture")
    public ResponseEntity<byte[]> getMyProfilePicture(Authentication authentication) {
        final UUID userId;
        try {
            userId = requireUserId(authentication);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(401).build();
        }
        return userService.getProfilePicture(userId)
                .map(pic -> {
                    MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
                    try {
                        if (pic.contentType() != null && !pic.contentType().isBlank()) {
                            mediaType = MediaType.parseMediaType(pic.contentType());
                        }
                    } catch (Exception ignored) {
                        // fallback to octet-stream
                    }
                    return ResponseEntity.ok()
                            .cacheControl(CacheControl.noStore())
                            .contentType(mediaType)
                            .body(pic.data());
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping(value = "/me/profile-picture", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload current user's profile picture")
    public ResponseEntity<Map<String, String>> uploadMyProfilePicture(
            Authentication authentication,
            @RequestParam("file") MultipartFile file
    ) {
        final UUID userId;
        try {
            userId = requireUserId(authentication);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(401).build();
        }

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "No file uploaded"));
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid file type"));
        }
        if (file.getSize() > 2_000_000) {
            return ResponseEntity.status(413).body(Map.of("message", "File too large (max 2MB)"));
        }

        try {
            userService.updateProfilePicture(userId, file.getBytes(), contentType);
            return ResponseEntity.ok(Map.of("message", "Profile picture updated"));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of("message", "Could not upload profile picture"));
        }
    }

    @DeleteMapping("/me/profile-picture")
    @Operation(summary = "Remove current user's profile picture")
    public ResponseEntity<Void> deleteMyProfilePicture(Authentication authentication) {
        final UUID userId;
        try {
            userId = requireUserId(authentication);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(401).build();
        }
        userService.removeProfilePicture(userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    @Operation(summary = "Get all users admin only")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<List<UserResponseDTO>> getUsers(){
        List<UserResponseDTO> users = userService.getUsers();
        return ResponseEntity.ok(users);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a user by id self or admin")
    @PreAuthorize("hasAuthority('ADMIN') or @userPermission.isSelf(#id, authentication)")
    public ResponseEntity<UserResponseDTO> getUserById(@PathVariable UUID id){
        UserResponseDTO userResponseDTO = userService.getUserById(id);
        return ResponseEntity.ok(userResponseDTO);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a user self or admin")
    @PreAuthorize("hasAuthority('ADMIN') or @userPermission.isSelf(#id, authentication)")
    public ResponseEntity<UserResponseDTO> updateUser(
            @PathVariable UUID id,
            @Validated({Default.class}) @RequestBody UserRequestDTO userRequestDTO){
        UserResponseDTO userResponseDTO = userService.updateUser(id, userRequestDTO);
        return ResponseEntity.ok(userResponseDTO);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a user admin only")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<Void> deleteUser(@PathVariable UUID id){
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}
