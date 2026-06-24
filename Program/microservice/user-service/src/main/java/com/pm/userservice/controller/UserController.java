// src/main/java/com/pm/userservice/controller/UserController.java
package com.pm.userservice.controller;

import com.pm.userservice.dto.CaoUserAssignDTO;
import com.pm.userservice.dto.CompanyResponseDTO;
import com.pm.userservice.dto.OnboardingReviewUpdateDTO;
import com.pm.userservice.dto.PagedResponseDTO;
import com.pm.userservice.dto.UpdateCompanyRequestDTO;
import com.pm.userservice.dto.UpdatePayslipFrequencyRequestDTO;
import com.pm.userservice.dto.UserRequestDTO;
import com.pm.userservice.dto.UserResponseDTO;
import com.pm.userservice.dto.WorkHistoryColumnsPreferenceDTO;
import com.pm.userservice.security.TokenExtractor;
import com.pm.userservice.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.groups.Default;
import jakarta.servlet.http.HttpServletRequest;
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

    private UUID resolveCompanyId(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            String claim = jwtAuth.getToken().getClaimAsString("companyId");
            if (claim != null && !claim.isBlank()) {
                return UUID.fromString(claim.trim());
            }
        }
        return null;
    }

    @GetMapping("/me")
    @Operation(summary = "Return current user profile from the token")
    public ResponseEntity<UserResponseDTO> me(Authentication authentication) {
        try {
            UUID userId = requireUserId(authentication);
            UUID companyId = resolveCompanyId(authentication);
            UserResponseDTO userResponseDTO = userService.getUserById(userId, companyId);
            return ResponseEntity.ok(userResponseDTO);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(401).build();
        }
    }

    @GetMapping("/search")
    @Operation(summary = "Search active users by name/email/position (planning helper)")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PLANNING')")
    public ResponseEntity<List<UserResponseDTO>> searchUsers(
            Authentication authentication,
            @RequestParam("q") String query,
            @RequestParam(value = "limit", defaultValue = "20") int limit
    ) {
        UUID companyId = resolveCompanyId(authentication);
        return ResponseEntity.ok(userService.searchActiveUsers(companyId, query, limit));
    }

    @GetMapping("/me/company")
    @Operation(summary = "Return current company from the token")
    public ResponseEntity<CompanyResponseDTO> getMyCompany(Authentication authentication) {
        UUID companyId = resolveCompanyId(authentication);
        if (companyId == null) {
            return ResponseEntity.status(401).build();
        }
        CompanyResponseDTO response = userService.getCompany(companyId);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/me/company")
    @Operation(summary = "Update current company name")
    @PreAuthorize("hasAuthority('CAN_MANAGE_COMPANY')")
    public ResponseEntity<?> updateMyCompany(
            Authentication authentication,
            @Validated @RequestBody UpdateCompanyRequestDTO body
    ) {
        UUID companyId = resolveCompanyId(authentication);
        if (companyId == null) {
            return ResponseEntity.status(401).build();
        }
        try {
            CompanyResponseDTO response = userService.updateCompany(
                    companyId,
                    body.getName(),
                    body.getPayoutFrequencyMinutes(),
                    body.getTimesheetLoggingMode(),
                    body.getTravelClaimMode(),
                    body.getPayrollTaxTemplates(),
                    body.getStreet(),
                    body.getPostalCode(),
                    body.getCity()
            );
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @GetMapping("/public/company-settings/{companyId}")
    @Operation(summary = "Get company settings for internal service integration")
    public ResponseEntity<CompanyResponseDTO> getCompanySettings(@PathVariable UUID companyId) {
        return ResponseEntity.ok(userService.getCompany(companyId));
    }

    @PostMapping("/public/display-names")
    @Operation(summary = "Get user display names for internal service integration")
    public ResponseEntity<Map<String, String>> getDisplayNames(@RequestBody List<UUID> userIds) {
        return ResponseEntity.ok(userService.getDisplayNamesByUserIds(userIds));
    }

    @GetMapping("/me/company-logo")
    @Operation(summary = "Get current company logo")
    public ResponseEntity<byte[]> getMyCompanyLogo(Authentication authentication) {
        UUID companyId = resolveCompanyId(authentication);
        if (companyId == null) {
            return ResponseEntity.status(401).build();
        }
        return userService.getCompanyLogo(companyId)
                .map(logo -> {
                    MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
                    try {
                        if (logo.contentType() != null && !logo.contentType().isBlank()) {
                            mediaType = MediaType.parseMediaType(logo.contentType());
                        }
                    } catch (Exception ignored) {
                        // fallback to octet-stream
                    }
                    return ResponseEntity.ok()
                            .cacheControl(CacheControl.noStore())
                            .contentType(mediaType)
                            .body(logo.data());
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping(value = "/me/company-logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload current company logo")
    @PreAuthorize("hasAuthority('CAN_MANAGE_COMPANY')")
    public ResponseEntity<Map<String, String>> uploadMyCompanyLogo(
            Authentication authentication,
            @RequestParam("file") MultipartFile file
    ) {
        UUID companyId = resolveCompanyId(authentication);
        if (companyId == null) {
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
            userService.updateCompanyLogo(companyId, file.getBytes(), contentType);
            return ResponseEntity.ok(Map.of("message", "Company logo updated"));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().body(Map.of("message", "Could not upload company logo"));
        }
    }

    @DeleteMapping("/me/company-logo")
    @Operation(summary = "Remove current company logo")
    @PreAuthorize("hasAuthority('CAN_MANAGE_COMPANY')")
    public ResponseEntity<Void> deleteMyCompanyLogo(Authentication authentication) {
        UUID companyId = resolveCompanyId(authentication);
        if (companyId == null) {
            return ResponseEntity.status(401).build();
        }
        userService.removeCompanyLogo(companyId);
        return ResponseEntity.noContent().build();
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

    @GetMapping("/{id}/profile-picture")
    @Operation(summary = "Get a user's profile picture self or admin")
    @PreAuthorize("hasAuthority('CAN_VIEW_USERS') or @userPermission.isSelf(#id, authentication)")
    public ResponseEntity<byte[]> getUserProfilePicture(@PathVariable UUID id, Authentication authentication) {
        UUID companyId = resolveCompanyId(authentication);
        userService.getUserById(id, companyId);
        return userService.getProfilePicture(id)
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

    @GetMapping("/{id}/id-document-image")
    @Operation(summary = "Get a user's submitted ID document image admin only")
    @PreAuthorize("hasAuthority('CAN_VIEW_USERS') or hasAuthority('CAN_VIEW_ONBOARDING_QUEUE') or hasAuthority('CAN_REVIEW_ONBOARDING')")
    public ResponseEntity<byte[]> getUserIdDocumentImage(@PathVariable UUID id, Authentication authentication) {
        UUID companyId = resolveCompanyId(authentication);
        userService.getUserById(id, companyId);
        return userService.getIdDocumentImage(id)
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

    @GetMapping("/{id}/id-document-back-image")
    @Operation(summary = "Get a user's submitted ID document back image admin only")
    @PreAuthorize("hasAuthority('CAN_VIEW_USERS') or hasAuthority('CAN_VIEW_ONBOARDING_QUEUE') or hasAuthority('CAN_REVIEW_ONBOARDING')")
    public ResponseEntity<byte[]> getUserIdDocumentBackImage(@PathVariable UUID id, Authentication authentication) {
        UUID companyId = resolveCompanyId(authentication);
        userService.getUserById(id, companyId);
        return userService.getIdDocumentBackImage(id)
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

    @PutMapping("/me/payslip-frequency")
    @Operation(summary = "Update company payout frequency (in minutes)")
    public ResponseEntity<UserResponseDTO> updateMyPayslipFrequency(
            Authentication authentication,
            @Validated @RequestBody UpdatePayslipFrequencyRequestDTO body
    ) {
        final UUID userId;
        try {
            userId = requireUserId(authentication);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(401).build();
        }
        int minutes = body.getPayslipFrequencyMinutes();
        UUID companyId = resolveCompanyId(authentication);
        if (companyId == null) {
            return ResponseEntity.status(401).build();
        }
        UserResponseDTO updated = userService.updateCompanyPayoutFrequency(userId, companyId, minutes);
        return ResponseEntity.ok(updated);
    }

    @GetMapping("/me/preferences/work-history-columns")
    @Operation(summary = "Return current user's saved work history column preference")
    public ResponseEntity<WorkHistoryColumnsPreferenceDTO> getMyWorkHistoryColumnsPreference(Authentication authentication) {
        try {
            UUID userId = requireUserId(authentication);
            return ResponseEntity.ok(userService.getWorkHistoryColumnsPreference(userId));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(401).build();
        }
    }

    @PutMapping("/me/preferences/work-history-columns")
    @Operation(summary = "Update current user's saved work history column preference")
    public ResponseEntity<WorkHistoryColumnsPreferenceDTO> updateMyWorkHistoryColumnsPreference(
            Authentication authentication,
            @RequestBody WorkHistoryColumnsPreferenceDTO body
    ) {
        try {
            UUID userId = requireUserId(authentication);
            return ResponseEntity.ok(userService.updateWorkHistoryColumnsPreference(userId, body));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(401).build();
        }
    }

    @GetMapping
    @Operation(summary = "Get all users admin only")
    @PreAuthorize("hasAuthority('CAN_VIEW_USERS') or hasAuthority('CAN_VIEW_ONBOARDING_QUEUE') or hasAuthority('CAN_REVIEW_ONBOARDING')")
    public ResponseEntity<List<UserResponseDTO>> getUsers(Authentication authentication){
        UUID companyId = resolveCompanyId(authentication);
        List<UserResponseDTO> users = userService.getUsers(companyId);
        return ResponseEntity.ok(users);
    }

    @GetMapping("/paged")
    @Operation(summary = "Get paged users admin only")
    @PreAuthorize("hasAuthority('CAN_VIEW_USERS')")
    public ResponseEntity<PagedResponseDTO<UserResponseDTO>> getUsersPage(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "name") String sortKey,
            @RequestParam(defaultValue = "asc") String sortDirection
    ) {
        UUID companyId = resolveCompanyId(authentication);
        PagedResponseDTO<UserResponseDTO> users = userService.getUsersPage(
                companyId,
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 100),
                sortKey,
                sortDirection
        );
        return ResponseEntity.ok(users);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a user by id self or admin")
    @PreAuthorize("hasAuthority('CAN_VIEW_USERS') or hasAuthority('CAN_VIEW_ONBOARDING_QUEUE') or hasAuthority('CAN_REVIEW_ONBOARDING') or @userPermission.isSelf(#id, authentication)")
    public ResponseEntity<UserResponseDTO> getUserById(@PathVariable UUID id, Authentication authentication){
        UUID companyId = resolveCompanyId(authentication);
        UserResponseDTO userResponseDTO = userService.getUserById(id, companyId);
        return ResponseEntity.ok(userResponseDTO);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a user self or admin")
    @PreAuthorize("hasAuthority('CAN_MANAGE_USERS') or @userPermission.isSelf(#id, authentication)")
    public ResponseEntity<UserResponseDTO> updateUser(
            @PathVariable UUID id,
            @Validated({Default.class}) @RequestBody UserRequestDTO userRequestDTO,
            Authentication authentication){
        UUID companyId = resolveCompanyId(authentication);
        UserResponseDTO userResponseDTO = userService.updateUser(id, userRequestDTO, companyId);
        return ResponseEntity.ok(userResponseDTO);
    }

    @PutMapping("/{id}/onboarding-review")
    @Operation(summary = "Update onboarding review decision admin only")
    @PreAuthorize("hasAuthority('CAN_REVIEW_ONBOARDING')")
    public ResponseEntity<UserResponseDTO> updateOnboardingReview(
            @PathVariable UUID id,
            @Valid @RequestBody OnboardingReviewUpdateDTO body,
            Authentication authentication
    ) {
        UUID companyId = resolveCompanyId(authentication);
        UUID actorUserId = requireUserId(authentication);
        UserResponseDTO userResponseDTO = userService.updateOnboardingReview(id, companyId, actorUserId, body);
        return ResponseEntity.ok(userResponseDTO);
    }

    @PutMapping("/{id}/cao")
    @Operation(summary = "Assign or remove a CAO template for a user")
    @PreAuthorize("hasAuthority('CAN_REVIEW_ONBOARDING') or hasAuthority('CAN_MANAGE_USERS')")
    public ResponseEntity<?> assignUserCao(
            @PathVariable UUID id,
            @RequestBody CaoUserAssignDTO body,
            Authentication authentication
    ) {
        UUID companyId = resolveCompanyId(authentication);
        try {
            UserResponseDTO result = userService.assignUserCao(id, companyId, body);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a user admin only")
    @PreAuthorize("hasAuthority('CAN_DELETE_USERS') and !@userPermission.isSelf(#id, authentication)")
    public ResponseEntity<Void> deleteUser(
            @PathVariable UUID id,
            Authentication authentication,
            HttpServletRequest httpServletRequest
    ){
        UUID companyId = resolveCompanyId(authentication);
        UUID actorUserId = requireUserId(authentication);
        String accessToken = TokenExtractor.extractAccessToken(httpServletRequest);
        userService.deleteUser(id, companyId, actorUserId, accessToken);
        return ResponseEntity.noContent().build();
    }
}
