package com.pm.payrollservice.controller;

import com.pm.payrollservice.dto.JaaropgaafDTO;
import com.pm.payrollservice.dto.PayslipErrorReportDTO;
import com.pm.payrollservice.dto.PagedResponseDTO;
import com.pm.payrollservice.dto.PayslipRequestDTO;
import com.pm.payrollservice.dto.PayslipResponseDTO;
import com.pm.payrollservice.dto.VerzamelloonstaatDTO;
import com.pm.payrollservice.dto.validators.CreatePayslipValidationGroup;
import com.pm.payrollservice.repository.PayslipDocumentRepository;
import com.pm.payrollservice.repository.PayslipRepository;
import com.pm.payrollservice.service.JaaropgaafService;
import com.pm.payrollservice.service.PayrollService;
import com.pm.payrollservice.service.PayslipPdfService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.groups.Default;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/payroll")
@Tag(name = "Payroll", description = "API for managing payroll service")
public class PayrollController {
    private final PayrollService payrollService;
    private final PayslipRepository payslipRepository;
    private final PayslipDocumentRepository docRepo; // keep if you use it elsewhere
    private final PayslipPdfService pdfService;
    private final JaaropgaafService jaaropgaafService;

    public PayrollController(PayrollService payrollService,
                             PayslipRepository payslipRepository,
                             PayslipDocumentRepository docRepo,
                             PayslipPdfService pdfService,
                             JaaropgaafService jaaropgaafService) {
        this.payrollService = payrollService;
        this.payslipRepository = payslipRepository;
        this.docRepo = docRepo;
        this.pdfService = pdfService;
        this.jaaropgaafService = jaaropgaafService;
    }

    private static final Logger log = LoggerFactory.getLogger(PayrollController.class);

    @GetMapping
    @Operation(summary = "Get all payslips admin only")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_PAYSLIPS')")
    public ResponseEntity<List<PayslipResponseDTO>> getPayslips(@AuthenticationPrincipal Jwt jwt) {
        List<PayslipResponseDTO> payslips = payrollService.getPayslips(extractCompanyId(jwt));
        return ResponseEntity.ok().body(payslips);
    }

    @GetMapping("/paged")
    @Operation(summary = "Get paged payslips admin only")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_PAYSLIPS')")
    public ResponseEntity<PagedResponseDTO<PayslipResponseDTO>> getPayslipsPage(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        return ResponseEntity.ok(payrollService.getPayslipsPage(
                extractCompanyId(jwt),
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 100)
        ));
    }

    @GetMapping("/me")
    @Operation(summary = "Get my payslips")
    @PreAuthorize("hasAnyAuthority('CAN_VIEW_PAYSLIPS', 'CAN_VIEW_ALL_PAYSLIPS')")
    public ResponseEntity<List<PayslipResponseDTO>> getMyPayslips(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = extractUserId(jwt);
        return ResponseEntity.ok(payrollService.getReleasedPayslipsByUserId(userId));
    }

    @GetMapping("/me/paged")
    @Operation(summary = "Get my paged payslips")
    @PreAuthorize("hasAnyAuthority('CAN_VIEW_PAYSLIPS', 'CAN_VIEW_ALL_PAYSLIPS')")
    public ResponseEntity<PagedResponseDTO<PayslipResponseDTO>> getMyPayslipsPage(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        UUID userId = extractUserId(jwt);
        return ResponseEntity.ok(
                payrollService.getReleasedPayslipsByUserIdPage(
                        userId,
                        Math.max(page, 0),
                        Math.min(Math.max(size, 1), 100)
                )
        );
    }

    @GetMapping("/review")
    @Operation(summary = "Get payslips pending review admin only")
    @PreAuthorize("hasAuthority('CAN_REVIEW_PAYSLIPS')")
    public ResponseEntity<List<PayslipResponseDTO>> getPayslipsPendingReview(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(payrollService.getPayslipsPendingReview(extractCompanyId(jwt)));
    }

    /* changed: return pdf for a single payslip */
    @GetMapping(value = "/{id}", produces = MediaType.APPLICATION_PDF_VALUE)
    @Operation(summary = "Get a payslip by id as PDF self or admin")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_PAYSLIPS') or (hasAuthority('CAN_VIEW_PAYSLIPS') and @payrollPermission.isOwner(#id, authentication))")
    public ResponseEntity<byte[]> getPayslipPdf(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        byte[] pdf = payrollService.generatePayslipPdf(id, extractCompanyId(jwt));
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"payslip_" + id + ".pdf\"");
        headers.setCacheControl(CacheControl.noStore().mustRevalidate().getHeaderValue());
        headers.setPragma("no-cache");
        headers.setExpires(0);
        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    /* optional: keep json route for api use or debugging */
    @GetMapping(value = "/{id}/json", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Get a payslip as JSON self or admin")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_PAYSLIPS') or (hasAuthority('CAN_VIEW_PAYSLIPS') and @payrollPermission.isOwner(#id, authentication))")
    public ResponseEntity<PayslipResponseDTO> getPayslipJson(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(payrollService.getPayslipById(id, extractCompanyId(jwt)));
    }

    /* optional: preview html in browser */
    @GetMapping(value = "/{id}/html", produces = MediaType.TEXT_HTML_VALUE)
    @Operation(summary = "Render payslip as HTML self or admin")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_PAYSLIPS') or (hasAuthority('CAN_VIEW_PAYSLIPS') and @payrollPermission.isOwner(#id, authentication))")
    public ResponseEntity<String> renderHtml(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        String html = payrollService.renderPayslipHtml(id, extractCompanyId(jwt));
        return ResponseEntity.ok(html);
    }

    @PostMapping
    @Operation(summary = "Create new payslip admin only")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PAYSLIPS')")
    public ResponseEntity<PayslipResponseDTO> createPayslip(
            @Validated({Default.class, CreatePayslipValidationGroup.class})
            @RequestBody PayslipRequestDTO payslipRequestDTO,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest httpRequest) {
        PayslipResponseDTO payslipResponseDTO = payrollService.createPayslip(
                payslipRequestDTO,
                extractCompanyId(jwt),
                bearerToken(httpRequest)
        );
        return ResponseEntity.ok().body(payslipResponseDTO);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a payslip admin only")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PAYSLIPS')")
    public ResponseEntity<PayslipResponseDTO> updatePayslip(
            @PathVariable UUID id,
            @Validated({Default.class}) @RequestBody PayslipRequestDTO payslipRequestDTO,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest httpRequest) {
        PayslipResponseDTO payslipResponseDTO = payrollService.updatePayslip(
                id,
                payslipRequestDTO,
                extractCompanyId(jwt),
                bearerToken(httpRequest)
        );
        return ResponseEntity.ok().body(payslipResponseDTO);
    }

    @PostMapping("/{id}/report-error")
    @Operation(summary = "Report an error on a payslip self or admin")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PAYSLIPS') or (hasAuthority('CAN_REPORT_PAYSLIP_ERRORS') and @payrollPermission.isOwner(#id, authentication))")
    public ResponseEntity<PayslipResponseDTO> reportPayslipError(
            @PathVariable UUID id,
            @Validated @RequestBody PayslipErrorReportDTO body,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest httpRequest) {
        PayslipResponseDTO updated = payrollService.reportPayslipError(
                id,
                extractCompanyId(jwt),
                body.getErrorDescription(),
                bearerToken(httpRequest)
        );
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a payslip admin only")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PAYSLIPS')")
    public ResponseEntity<Void> deletePayslip(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt, HttpServletRequest httpRequest) {
        payrollService.deletePayslip(id, extractCompanyId(jwt), bearerToken(httpRequest));
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------
    // Jaaropgaaf (year-end employee statement) + verzamelloonstaat
    // ---------------------------------------------------------------

    @GetMapping("/jaaropgaaf/{employeeId}/{year}")
    @Operation(summary = "Get an employee's jaaropgaaf for a year (admin)")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_PAYSLIPS')")
    public ResponseEntity<JaaropgaafDTO> getJaaropgaaf(
            @PathVariable UUID employeeId, @PathVariable int year,
            @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        return ResponseEntity.ok(jaaropgaafService.buildForEmployee(
                extractCompanyId(jwt), employeeId, year, canViewIdentification(authentication)));
    }

    @GetMapping(value = "/jaaropgaaf/{employeeId}/{year}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    @Operation(summary = "Download an employee's jaaropgaaf PDF (admin)")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_PAYSLIPS')")
    public ResponseEntity<byte[]> getJaaropgaafPdf(
            @PathVariable UUID employeeId, @PathVariable int year,
            @AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        byte[] pdf = jaaropgaafService.generateJaaropgaafPdf(
                extractCompanyId(jwt), employeeId, year, canViewIdentification(authentication));
        return pdfResponse(pdf, "jaaropgaaf_" + year + "_" + employeeId + ".pdf");
    }

    @GetMapping("/jaaropgaaf/me/{year}")
    @Operation(summary = "Get my jaaropgaaf for a year")
    @PreAuthorize("hasAnyAuthority('CAN_VIEW_PAYSLIPS', 'CAN_VIEW_ALL_PAYSLIPS')")
    public ResponseEntity<JaaropgaafDTO> getMyJaaropgaaf(
            @PathVariable int year, @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(jaaropgaafService.buildForEmployee(
                extractCompanyId(jwt), extractUserId(jwt), year, true));
    }

    @GetMapping(value = "/jaaropgaaf/me/{year}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    @Operation(summary = "Download my jaaropgaaf PDF")
    @PreAuthorize("hasAnyAuthority('CAN_VIEW_PAYSLIPS', 'CAN_VIEW_ALL_PAYSLIPS')")
    public ResponseEntity<byte[]> getMyJaaropgaafPdf(
            @PathVariable int year, @AuthenticationPrincipal Jwt jwt) {
        byte[] pdf = jaaropgaafService.generateJaaropgaafPdf(
                extractCompanyId(jwt), extractUserId(jwt), year, true);
        return pdfResponse(pdf, "jaaropgaaf_" + year + ".pdf");
    }

    @PostMapping("/jaaropgaaf/{year}/finalize")
    @Operation(summary = "Finalize (lock) all jaaropgaven for the year (admin)")
    @PreAuthorize("hasAuthority('CAN_MANAGE_PAYSLIPS')")
    public ResponseEntity<Map<String, Object>> finalizeJaaropgaven(
            @PathVariable int year, @AuthenticationPrincipal Jwt jwt) {
        int count = jaaropgaafService.finalizeYear(extractCompanyId(jwt), year, extractUserId(jwt));
        return ResponseEntity.ok(Map.of("year", year, "finalized", count));
    }

    @GetMapping("/verzamelloonstaat/{year}")
    @Operation(summary = "Get the company-wide verzamelloonstaat for a year (admin)")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_PAYSLIPS')")
    public ResponseEntity<VerzamelloonstaatDTO> getVerzamelloonstaat(
            @PathVariable int year, @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(jaaropgaafService.buildVerzamelloonstaat(extractCompanyId(jwt), year));
    }

    @GetMapping(value = "/verzamelloonstaat/{year}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    @Operation(summary = "Download the company-wide verzamelloonstaat PDF (admin)")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_PAYSLIPS')")
    public ResponseEntity<byte[]> getVerzamelloonstaatPdf(
            @PathVariable int year, @AuthenticationPrincipal Jwt jwt) {
        byte[] pdf = jaaropgaafService.generateVerzamelloonstaatPdf(extractCompanyId(jwt), year);
        return pdfResponse(pdf, "verzamelloonstaat_" + year + ".pdf");
    }

    private static boolean canViewIdentification(Authentication authentication) {
        if (authentication == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .anyMatch(a -> "CAN_VIEW_EMPLOYEE_IDENTIFICATION".equals(a.getAuthority()));
    }

    private static ResponseEntity<byte[]> pdfResponse(byte[] pdf, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"");
        headers.setCacheControl(CacheControl.noStore().mustRevalidate().getHeaderValue());
        headers.setPragma("no-cache");
        headers.setExpires(0);
        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    private static String bearerToken(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || authorization.isBlank()) {
            return null;
        }
        if (authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return authorization.substring(7).trim();
        }
        return null;
    }

    private static UUID extractUserId(Jwt jwt) {
        if (jwt == null) throw new IllegalArgumentException("missing jwt principal");
        String userId = jwt.getClaimAsString("userId");
        if (userId == null || userId.isBlank()) userId = jwt.getSubject();
        if (userId == null || userId.isBlank()) throw new IllegalArgumentException("missing userId claim");
        return parseFlexibleUUID(userId.trim());
    }

    private static UUID parseFlexibleUUID(String value) {
        if (value.contains("-")) return UUID.fromString(value);
        if (value.length() == 32) {
            String formatted = value.replaceFirst(
                    "(\\w{8})(\\w{4})(\\w{4})(\\w{4})(\\w{12})",
                    "$1-$2-$3-$4-$5"
            );
            return UUID.fromString(formatted);
        }
        return UUID.fromString(value);
    }

    private static UUID extractCompanyId(Jwt jwt) {
        if (jwt == null) {
            return null;
        }
        String companyId = jwt.getClaimAsString("companyId");
        if (companyId == null || companyId.isBlank()) {
            return null;
        }
        return parseFlexibleUUID(companyId.trim());
    }
}
