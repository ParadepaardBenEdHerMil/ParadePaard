package com.pm.payrollservice.controller;

import com.pm.payrollservice.dto.FinanceBreakdownRowDTO;
import com.pm.payrollservice.dto.FinanceOverviewDTO;
import com.pm.payrollservice.dto.MarginBreakdownRowDTO;
import com.pm.payrollservice.dto.MarginOverviewDTO;
import com.pm.payrollservice.dto.ShiftFinanceRowDTO;
import com.pm.payrollservice.service.PayrollFinanceService;
import com.pm.payrollservice.service.PayrollMarginService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/payroll/finance")
@Tag(name = "Payroll Finance", description = "Company payroll-cost finance overview")
public class FinanceController {

    private static final String FINANCE_AUTH =
            "hasAnyAuthority('CAN_VIEW_PAYROLL_FINANCE', 'CAN_MANAGE_PAYROLL_FINANCE')";

    private final PayrollFinanceService financeService;
    private final PayrollMarginService marginService;

    public FinanceController(PayrollFinanceService financeService, PayrollMarginService marginService) {
        this.financeService = financeService;
        this.marginService = marginService;
    }

    @GetMapping("/overview")
    @Operation(summary = "Company payroll-cost overview for a period")
    @PreAuthorize(FINANCE_AUTH)
    public ResponseEntity<FinanceOverviewDTO> overview(
            @RequestParam String from,
            @RequestParam String to,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(
                financeService.overview(extractCompanyId(jwt), LocalDate.parse(from), LocalDate.parse(to)));
    }

    @GetMapping("/breakdown")
    @Operation(summary = "Payroll-cost breakdown by employee, function, or month")
    @PreAuthorize(FINANCE_AUTH)
    public ResponseEntity<List<FinanceBreakdownRowDTO>> breakdown(
            @RequestParam String from,
            @RequestParam String to,
            @RequestParam(defaultValue = "EMPLOYEE") String dimension,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(
                financeService.breakdown(extractCompanyId(jwt), LocalDate.parse(from), LocalDate.parse(to), dimension));
    }

    @GetMapping("/margin/overview")
    @Operation(summary = "Company revenue & margin overview for a period")
    @PreAuthorize(FINANCE_AUTH)
    public ResponseEntity<MarginOverviewDTO> marginOverview(
            @RequestParam String from,
            @RequestParam String to,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(
                marginService.overview(extractCompanyId(jwt), LocalDate.parse(from), LocalDate.parse(to), token(jwt)));
    }

    @GetMapping("/margin/breakdown")
    @Operation(summary = "Revenue & margin breakdown by client, project, employee, function or month")
    @PreAuthorize(FINANCE_AUTH)
    public ResponseEntity<List<MarginBreakdownRowDTO>> marginBreakdown(
            @RequestParam String from,
            @RequestParam String to,
            @RequestParam(defaultValue = "CLIENT") String dimension,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(
                marginService.breakdown(extractCompanyId(jwt), LocalDate.parse(from), LocalDate.parse(to), dimension, token(jwt)));
    }

    @GetMapping("/margin/shifts")
    @Operation(summary = "Per-shift revenue & margin drill-down")
    @PreAuthorize(FINANCE_AUTH)
    public ResponseEntity<List<ShiftFinanceRowDTO>> marginShifts(
            @RequestParam String from,
            @RequestParam String to,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(
                marginService.shifts(extractCompanyId(jwt), LocalDate.parse(from), LocalDate.parse(to), token(jwt)));
    }

    @GetMapping("/margin/export")
    @Operation(summary = "Export per-shift revenue & margin as CSV")
    @PreAuthorize(FINANCE_AUTH)
    public ResponseEntity<byte[]> marginExport(
            @RequestParam String from,
            @RequestParam String to,
            @RequestParam(defaultValue = "csv") String format,
            @AuthenticationPrincipal Jwt jwt) {
        String csv = marginService.exportCsv(extractCompanyId(jwt), LocalDate.parse(from), LocalDate.parse(to), token(jwt));
        byte[] body = csv.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"margin-" + from + "_" + to + ".csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(body);
    }

    private static String token(Jwt jwt) {
        return jwt == null ? null : jwt.getTokenValue();
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

    private static UUID parseFlexibleUUID(String value) {
        if (value.contains("-")) {
            return UUID.fromString(value);
        }
        if (value.length() == 32) {
            String formatted = value.replaceFirst(
                    "(\\w{8})(\\w{4})(\\w{4})(\\w{4})(\\w{12})",
                    "$1-$2-$3-$4-$5"
            );
            return UUID.fromString(formatted);
        }
        return UUID.fromString(value);
    }
}
