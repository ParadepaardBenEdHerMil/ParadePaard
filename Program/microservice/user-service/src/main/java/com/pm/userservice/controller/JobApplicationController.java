package com.pm.userservice.controller;

import com.pm.userservice.dto.ApplicationDecisionRequestDTO;
import com.pm.userservice.dto.JobApplicationRequestDTO;
import com.pm.userservice.dto.JobApplicationResponseDTO;
import com.pm.userservice.model.JobApplication;
import com.pm.userservice.security.TokenExtractor;
import com.pm.userservice.service.JobApplicationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.InvalidMediaTypeException;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@RestController
@RequestMapping
public class JobApplicationController {

    private final JobApplicationService service;

    public JobApplicationController(JobApplicationService service) {
        this.service = service;
    }

    @PostMapping(value = "/applications", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<JobApplicationResponseDTO> submit(
            @Valid @RequestPart("application") JobApplicationRequestDTO request,
            @RequestPart(value = "cv", required = false) MultipartFile cv
    ) throws IOException {
        return ResponseEntity.ok(service.submitApplication(request, cv));
    }

    @GetMapping("/admin/applications")
    @PreAuthorize("hasAuthority('CAN_VIEW_APPLICATIONS') or hasAuthority('CAN_REVIEW_APPLICATIONS')")
    public ResponseEntity<List<JobApplicationResponseDTO>> getApplications() {
        return ResponseEntity.ok(service.getApplications());
    }

    @GetMapping("/admin/applications/{applicationId}")
    @PreAuthorize("hasAuthority('CAN_VIEW_APPLICATIONS') or hasAuthority('CAN_REVIEW_APPLICATIONS')")
    public ResponseEntity<JobApplicationResponseDTO> getApplication(@PathVariable UUID applicationId) {
        return ResponseEntity.ok(service.getApplication(applicationId));
    }

    @GetMapping("/admin/applications/{applicationId}/cv")
    @PreAuthorize("hasAuthority('CAN_VIEW_APPLICATIONS') or hasAuthority('CAN_REVIEW_APPLICATIONS')")
    public ResponseEntity<byte[]> downloadCv(@PathVariable UUID applicationId) {
        JobApplication application = service.getApplicationCv(applicationId);
        byte[] cvBytes = application.getCvBytes();
        if (cvBytes == null || cvBytes.length == 0) {
            throw new ResponseStatusException(NOT_FOUND);
        }

        MediaType mediaType = safeMediaType(application.getCvContentType());

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(application.getCvFileName() != null ? application.getCvFileName() : "cv")
                                .build()
                                .toString()
                )
                .body(cvBytes);
    }

    @PostMapping("/admin/applications/{applicationId}/deny")
    @PreAuthorize("hasAuthority('CAN_REVIEW_APPLICATIONS')")
    public ResponseEntity<JobApplicationResponseDTO> denyApplication(
            @PathVariable UUID applicationId,
            @RequestBody(required = false) ApplicationDecisionRequestDTO request,
            Authentication authentication) {
        return ResponseEntity.ok(service.denyApplication(applicationId, request, reviewerUserId(authentication)));
    }

    @PostMapping("/admin/applications/{applicationId}/accept")
    @PreAuthorize("hasAuthority('CAN_REVIEW_APPLICATIONS')")
    public ResponseEntity<JobApplicationResponseDTO> acceptApplication(
            @PathVariable UUID applicationId,
            @RequestBody(required = false) ApplicationDecisionRequestDTO request,
            Authentication authentication,
            HttpServletRequest httpServletRequest) {
        String accessToken = TokenExtractor.extractAccessToken(httpServletRequest);
        return ResponseEntity.ok(service.acceptApplication(
                applicationId,
                request,
                reviewerUserId(authentication),
                accessToken
        ));
    }

    @PostMapping("/admin/applications/{applicationId}/resend-decision-email")
    @PreAuthorize("hasAuthority('CAN_REVIEW_APPLICATIONS')")
    public ResponseEntity<JobApplicationResponseDTO> resendDecisionEmail(
            @PathVariable UUID applicationId,
            HttpServletRequest httpServletRequest) {
        String accessToken = TokenExtractor.extractAccessToken(httpServletRequest);
        return ResponseEntity.ok(service.resendDecisionEmail(applicationId, accessToken));
    }

    private static String reviewerUserId(Authentication authentication) {
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

    private static MediaType safeMediaType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
        try {
            return MediaType.parseMediaType(contentType);
        } catch (InvalidMediaTypeException ex) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }
}
