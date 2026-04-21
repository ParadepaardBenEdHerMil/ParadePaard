package com.pm.payrollservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pm.payrollservice.dto.CompanySettingsDTO;
import com.pm.payrollservice.dto.PagedResponseDTO;
import com.pm.payrollservice.dto.PayrollDeductionLineDTO;
import com.pm.payrollservice.dto.PayrollTaxTemplateDTO;
import com.pm.payrollservice.dto.PayslipDeductionCodec;
import com.pm.payrollservice.dto.PayslipRequestDTO;
import com.pm.payrollservice.dto.PayslipResponseDTO;
import com.pm.payrollservice.exception.PayslipNotFoundException;
import com.pm.payrollservice.grpc.ContractServiceGrpcClient;
import com.pm.payrollservice.grpc.TimesheetServiceGrpcClient;
import com.pm.payrollservice.grpc.UserServiceGrpcClient;
import com.pm.payrollservice.mapper.PayslipMapper;
import com.pm.payrollservice.model.Payslip;
import com.pm.payrollservice.model.PayslipStatus;
import com.pm.payrollservice.repository.PayslipRepository;
import contract.ContractDataResponse;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import timesheet.TimesheetDataResponse;
import user.UserDataResponse;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class PayrollService {
    private static final Logger log = LoggerFactory.getLogger(PayrollService.class);

    private final PayslipRepository payslipRepository;
    private final com.pm.payrollservice.validation.PayslipValidator duplicateValidator;
    private final UserServiceGrpcClient userServiceGrpcClient;
    private final ContractServiceGrpcClient contractServiceGrpcClient;
    private final TimesheetServiceGrpcClient timesheetServiceGrpcClient;
    private final CompanySettingsClient companySettingsClient;
    private final PayslipPdfService pdfService;
    private final ObjectMapper objectMapper;

    public PayrollService(PayslipRepository payslipRepository,
                          com.pm.payrollservice.validation.PayslipValidator duplicateValidator,
                          UserServiceGrpcClient userServiceGrpcClient,
                          ContractServiceGrpcClient contractServiceGrpcClient,
                          TimesheetServiceGrpcClient timesheetServiceGrpcClient,
                          CompanySettingsClient companySettingsClient,
                          PayslipPdfService pdfService,
                          ObjectMapper objectMapper) {
        this.payslipRepository = payslipRepository;
        this.duplicateValidator = duplicateValidator;
        this.userServiceGrpcClient = userServiceGrpcClient;
        this.contractServiceGrpcClient = contractServiceGrpcClient;
        this.timesheetServiceGrpcClient = timesheetServiceGrpcClient;
        this.companySettingsClient = companySettingsClient;
        this.pdfService = pdfService;
        this.objectMapper = objectMapper;
    }

    public List<PayslipResponseDTO> getPayslips() {
        return mapPayslipsToDto(payslipRepository.findAll());
    }

    public PagedResponseDTO<PayslipResponseDTO> getPayslipsPage(int page, int size) {
        var pageable = PageRequest.of(page, size);
        return PagedResponseDTO.from(
                payslipRepository.findAllByOrderByDateOfIssueDesc(pageable),
                PayslipMapper::toDTO
        );
    }

    public List<PayslipResponseDTO> getPayslipsByUserId(UUID userId) {
        return mapPayslipsToDto(payslipRepository.findByUserIdOrderByDateOfIssueDesc(userId));
    }

    public List<PayslipResponseDTO> getReleasedPayslipsByUserId(UUID userId) {
        return mapPayslipsToDto(payslipRepository.findByUserIdOrderByDateOfIssueDesc(userId)
                .stream()
                .filter(p -> p.getStatus() == null
                        || p.getStatus() == PayslipStatus.RELEASED
                        || p.getStatus() == PayslipStatus.APPROVED)
                .toList());
    }

    public PagedResponseDTO<PayslipResponseDTO> getReleasedPayslipsByUserIdPage(UUID userId, int page, int size) {
        var pageable = PageRequest.of(page, size);
        var visibleStatuses = List.of(PayslipStatus.RELEASED, PayslipStatus.APPROVED);
        return PagedResponseDTO.from(
                payslipRepository.findVisibleByUserIdOrderByDateOfIssueDesc(userId, visibleStatuses, pageable),
                PayslipMapper::toDTO
        );
    }

    public List<PayslipResponseDTO> getPayslipsPendingReview() {
        List<PayslipStatus> statuses = List.of(
                PayslipStatus.PENDING_REVIEW,
                PayslipStatus.PENDING_APPROVAL,
                PayslipStatus.NEEDS_ATTENTION,
                PayslipStatus.DISPUTED
        );
        return mapPayslipsToDto(payslipRepository.findByStatusInOrderByDateOfIssueDesc(statuses));
    }

    public PayslipResponseDTO getPayslipById(UUID id) {
        Payslip payslip = payslipRepository.findById(id)
                .orElseThrow(() -> new PayslipNotFoundException("Payslip with id: " + id + " not found"));
        return PayslipMapper.toDTO(payslip);
    }

    public PayslipResponseDTO createPayslip(PayslipRequestDTO req) {
        LocalDate date = LocalDate.parse(req.getDateOfIssue());
        UUID userId = UUID.fromString(req.getUserId());

        duplicateValidator.validateNoDuplicate(userId, date);

        Payslip payslip = PayslipMapper.toModel(req);
        payslip.setWeekNumber(date.get(WeekFields.ISO.weekOfWeekBasedYear()));
        payslip.setWeekBasedYear(date.get(WeekFields.ISO.weekBasedYear()));
        payslip.setStatus(PayslipStatus.RELEASED);
        payslip.setAvailableToUserAt(date);
        payslip.setGeneratedAt(OffsetDateTime.now());
        TimesheetFetchResult fetchResult = populatePayslipData(
                payslip,
                userId,
                payslip.getWeekNumber(),
                payslip.getWeekBasedYear()
        );

        PayslipCalculator.apply(payslip);
        applyDiscrepancyStatus(payslip, fetchResult, PayslipStatus.RELEASED);

        payslip = payslipRepository.save(payslip);
        return PayslipMapper.toDTO(payslip);
    }

    public PayslipResponseDTO createScheduledPayslip(UUID userId, LocalDate periodEnd, LocalDate payoutDate) {
        duplicateValidator.validateNoDuplicate(userId, periodEnd);

        Payslip payslip = new Payslip();
        payslip.setUserId(userId);
        payslip.setDateOfIssue(periodEnd);
        payslip.setWeekNumber(periodEnd.get(WeekFields.ISO.weekOfWeekBasedYear()));
        payslip.setWeekBasedYear(periodEnd.get(WeekFields.ISO.weekBasedYear()));
        payslip.setStatus(PayslipStatus.PENDING_REVIEW);
        payslip.setAvailableToUserAt(payoutDate);
        payslip.setGeneratedAt(OffsetDateTime.now());
        TimesheetFetchResult fetchResult = populatePayslipData(
                payslip,
                userId,
                payslip.getWeekNumber(),
                payslip.getWeekBasedYear()
        );

        PayslipCalculator.apply(payslip);
        applyDiscrepancyStatus(payslip, fetchResult, PayslipStatus.PENDING_REVIEW);

        payslip = payslipRepository.save(payslip);
        return PayslipMapper.toDTO(payslip);
    }

    public PayslipResponseDTO syncScheduledPayslip(UUID userId, LocalDate periodEnd, LocalDate payoutDate) {
        int weekNumber = periodEnd.get(WeekFields.ISO.weekOfWeekBasedYear());
        int weekBasedYear = periodEnd.get(WeekFields.ISO.weekBasedYear());

        Payslip existing = payslipRepository.findByWeekBasedYearAndWeekNumberAndUserId(weekBasedYear, weekNumber, userId).stream()
                .filter(candidate -> {
                    PayslipStatus status = candidate.getStatus() == null ? PayslipStatus.RELEASED : candidate.getStatus();
                    return status != PayslipStatus.NEEDS_ATTENTION && status != PayslipStatus.DISPUTED;
                })
                .findFirst()
                .orElse(null);

        if (existing == null) {
            return createScheduledPayslip(userId, periodEnd, payoutDate);
        }

        if (existing.getDateOfIssue() != null && !existing.getDateOfIssue().isBefore(periodEnd)) {
            return PayslipMapper.toDTO(existing);
        }

        existing.setDateOfIssue(periodEnd);
        existing.setWeekNumber(weekNumber);
        existing.setWeekBasedYear(weekBasedYear);
        if (existing.getAvailableToUserAt() == null || existing.getStatus() == PayslipStatus.PENDING_REVIEW || existing.getStatus() == PayslipStatus.PENDING_APPROVAL) {
            existing.setAvailableToUserAt(payoutDate);
        }

        TimesheetFetchResult fetchResult = populatePayslipData(existing, userId, weekNumber, weekBasedYear);
        PayslipCalculator.apply(existing);
        applyDiscrepancyStatus(existing, fetchResult, defaultStatusForExisting(existing.getStatus()));

        existing = payslipRepository.save(existing);
        return PayslipMapper.toDTO(existing);
    }

    public PayslipResponseDTO reportPayslipError(UUID payslipId, String errorDescription) {
        Payslip payslip = payslipRepository.findById(payslipId)
                .orElseThrow(() -> new PayslipNotFoundException("Payslip with id: " + payslipId + " not found"));

        payslip.setErrorDescription(errorDescription);
        payslip.setStatus(PayslipStatus.DISPUTED);

        payslip = payslipRepository.save(payslip);
        return PayslipMapper.toDTO(payslip);
    }

    public PayslipResponseDTO updatePayslip(UUID id, PayslipRequestDTO req) {
        Payslip payslip = payslipRepository.findById(id)
                .orElseThrow(() -> new PayslipNotFoundException("Payslip with id: " + id + " not found"));

        if (req.getUserId() != null && !req.getUserId().isBlank()) {
            payslip.setUserId(UUID.fromString(req.getUserId()));
        }
        if (req.getDateOfIssue() != null && !req.getDateOfIssue().isBlank()) {
            LocalDate date = LocalDate.parse(req.getDateOfIssue());
            payslip.setDateOfIssue(date);
            payslip.setWeekNumber(date.get(WeekFields.ISO.weekOfWeekBasedYear()));
            payslip.setWeekBasedYear(date.get(WeekFields.ISO.weekBasedYear()));
        }
        if (req.getFunctionName() != null) {
            payslip.setFunctionName(req.getFunctionName());
        }
        if (req.getHourlyWage() != null) {
            payslip.setHourlyWage(req.getHourlyWage());
        }
        if (req.getTotalHoursWorked() != null) {
            payslip.setTotalHoursWorked(req.getTotalHoursWorked());
        }
        if (req.getDeductionLines() != null) {
            payslip.setDeductionLinesJson(PayslipDeductionCodec.write(req.getDeductionLines()));
        } else if (req.getWageTaxWithheldAmount() != null || req.getWageTaxWithheldTest() != null) {
            syncLegacyLoonheffingAmount(
                    payslip,
                    req.getWageTaxWithheldAmount() != null ? req.getWageTaxWithheldAmount() : req.getWageTaxWithheldTest()
            );
        }
        if (req.getWageTaxWithheldAmount() != null) {
            payslip.setWageTaxWithheldTest(req.getWageTaxWithheldAmount());
        } else if (req.getWageTaxWithheldTest() != null) {
            payslip.setWageTaxWithheldTest(req.getWageTaxWithheldTest());
        }
        if (req.getTravelExpenses() != null) {
            payslip.setTravelExpenses(req.getTravelExpenses());
        }
        if (req.getStatus() != null && !req.getStatus().isBlank()) {
            payslip.setStatus(PayslipStatus.valueOf(req.getStatus().trim().toUpperCase()));
        }
        if (req.getErrorDescription() != null) {
            payslip.setErrorDescription(req.getErrorDescription());
        }

        PayslipCalculator.apply(payslip);

        payslip = payslipRepository.save(payslip);
        return PayslipMapper.toDTO(payslip);
    }

    public void deletePayslip(UUID id) {
        payslipRepository.deleteById(id);
    }

    public String renderPayslipHtml(UUID id) {
        PayslipResponseDTO dto = getPayslipById(id);
        String json;
        try {
            json = objectMapper.writeValueAsString(dto);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("could not serialize dto", e);
        }
        String template = loadTemplate("templates/payslip.html");
        return template.replace("__PAYSLIP_JSON__", json);
    }

    private String renderPayslipHtmlForPdf(UUID id) {
        PayslipResponseDTO dto = getPayslipById(id);
        String template = loadTemplate("templates/payslip_pdf.html");

        NumberFormat eur = NumberFormat.getCurrencyInstance(new Locale("nl", "NL"));

        BigDecimal hours = safe(dto.getTotalHoursWorked());
        BigDecimal rate = safe(dto.getHourlyWage());
        BigDecimal travel = safe(dto.getTravelExpenses());
        BigDecimal gross = safe(dto.getTotalGrossAmount());

        String lines = new StringBuilder()
                .append("<tr>")
                .append("<td>").append(escape(dto.getFunctionName())).append("</td>")
                .append("<td class=\"num\">").append(formatHours(hours)).append("</td>")
                .append("<td class=\"num\">").append(eur.format(rate)).append("</td>")
                .append("<td class=\"num\">").append(eur.format(travel)).append("</td>")
                .append("<td class=\"num\">").append(eur.format(gross)).append("</td>")
                .append("</tr>")
                .toString();

        String address = String.join(" ",
                orEmpty(dto.getStreetName()),
                orEmpty(dto.getHouseNumber()),
                orEmpty(dto.getHouseNumberSuffix())
        ).trim();
        if (!orEmpty(dto.getPostalCode()).isEmpty()) {
            address = address + ", " + dto.getPostalCode();
        }

        return template
                .replace("__PAYSLIP_ID__", orEmpty(dto.getPayslipId()))
                .replace("__DATE_OF_ISSUE__", orEmpty(dto.getDateOfIssue()))
                .replace("__WEEK_NUMBER__", String.valueOf(dto.getWeekNumber()))
                .replace("__WEEK_YEAR__", String.valueOf(dto.getWeekBasedYear()))
                .replace("__NAME__", escape(dto.getName()))
                .replace("__DOB__", orEmpty(dto.getDateOfBirth()))
                .replace("__ADDRESS__", escape(address))
                .replace("__CITY__", escape(dto.getCity()))
                .replace("__COUNTRY__", escape(dto.getCountry()))
                .replace("__USER_ID__", orEmpty(dto.getUserId()))
                .replace("__START_DATE__", orEmpty(dto.getStartDate()))
                .replace("__FUNCTION_NAME__", escape(dto.getFunctionName()))
                .replace("__HOURLY_WAGE__", eur.format(safe(dto.getHourlyWage())))
                .replace("__LINES__", lines)
                .replace("__DEDUCTION_LINES__", buildDeductionRows(dto, eur))
                .replace("__GROSS__", eur.format(safe(dto.getTotalGrossAmount())))
                .replace("__TAX__", eur.format(safe(dto.getWageTaxWithheldAmount())))
                .replace("__TOTAL_DEDUCTIONS__", eur.format(safe(dto.getTotalEmployeeDeductions())))
                .replace("__TRAVEL__", eur.format(safe(dto.getTravelExpenses())))
                .replace("__NET__", eur.format(safe(dto.getTotalNetAmount())));
    }

    public byte[] generatePayslipPdf(UUID id) {
        String html = renderPayslipHtmlForPdf(id);
        return pdfService.generatePdfFromHtml(html);
    }

    private String loadTemplate(String path) {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new RuntimeException("could not load template " + path, e);
        }
    }

    private static BigDecimal safe(BigDecimal n) {
        return n == null ? BigDecimal.ZERO : n;
    }

    private static String orEmpty(Object v) {
        return v == null ? "" : v.toString();
    }

    private static String formatHours(BigDecimal h) {
        return String.format(Locale.US, "%.2f", h);
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace("\"", "&quot;");
    }

    private record TimesheetFetchResult(TimesheetDataResponse timesheetData, List<String> discrepancies) { }

    private TimesheetFetchResult populatePayslipData(Payslip payslip, UUID userId, int weekNumber, int weekBasedYear) {
        List<String> discrepancies = new ArrayList<>();
        UserDataResponse userData = populateUserData(payslip, userId, discrepancies);
        populateContractData(payslip, userId, discrepancies);

        TimesheetFetchResult fetchResult = fetchTimesheetData(userId, weekNumber, weekBasedYear);
        discrepancies.addAll(fetchResult.discrepancies());
        PayslipMapper.updateFromTimesheetData(payslip, fetchResult.timesheetData());

        ensureCompanyDefaultDeductionLines(payslip, userData, discrepancies);
        if (payslip.getWageTaxWithheldTest() == null) {
            payslip.setWageTaxWithheldTest(BigDecimal.ZERO);
        }

        return new TimesheetFetchResult(fetchResult.timesheetData(), discrepancies);
    }

    private UserDataResponse populateUserData(Payslip payslip, UUID userId, List<String> discrepancies) {
        try {
            UserDataResponse userData = userServiceGrpcClient.requestUserData(userId.toString());
            PayslipMapper.updateFromUserData(payslip, userData);
            return userData;
        } catch (StatusRuntimeException ex) {
            discrepancies.add(describeGrpcIssue("user data", ex));
        } catch (Exception ex) {
            discrepancies.add("Could not load user data");
        }
        return null;
    }

    private void populateContractData(Payslip payslip, UUID userId, List<String> discrepancies) {
        try {
            ContractDataResponse contractData = contractServiceGrpcClient.requestContractData(userId.toString());
            PayslipMapper.updateFromContractData(payslip, contractData);
        } catch (StatusRuntimeException ex) {
            discrepancies.add(describeGrpcIssue("contract data", ex));
        } catch (Exception ex) {
            discrepancies.add("Could not load contract data");
        }
    }

    private TimesheetFetchResult fetchTimesheetData(UUID userId, int weekNumber, int weekBasedYear) {
        List<String> discrepancies = new ArrayList<>();
        TimesheetDataResponse timesheetData = null;
        try {
            timesheetData = timesheetServiceGrpcClient.requestTimesheetData(
                    userId.toString(), weekNumber, weekBasedYear);
        } catch (StatusRuntimeException ex) {
            discrepancies.add("Missing timesheet data");
        }
        return new TimesheetFetchResult(timesheetData, discrepancies);
    }

    private String describeGrpcIssue(String label, StatusRuntimeException ex) {
        if (ex.getStatus().getCode() == Status.Code.NOT_FOUND) {
            return "Missing " + label;
        }
        return "Could not load " + label;
    }

    private void applyDiscrepancyStatus(Payslip payslip, TimesheetFetchResult fetchResult, PayslipStatus defaultStatus) {
        BigDecimal hours = safe(payslip.getTotalHoursWorked());
        List<String> discrepancies = new ArrayList<>(fetchResult.discrepancies());
        if (hours.compareTo(BigDecimal.ZERO) <= 0) {
            discrepancies.add("Total hours worked is 0");
        }

        if (discrepancies.isEmpty()) {
            payslip.setStatus(defaultStatus);
            return;
        }

        payslip.setStatus(PayslipStatus.NEEDS_ATTENTION);
        String existing = payslip.getErrorDescription();
        String note = "Auto-flagged: " + String.join("; ", discrepancies);
        if (existing == null || existing.isBlank()) {
            payslip.setErrorDescription(note);
        } else if (!existing.contains(note)) {
            payslip.setErrorDescription(existing + " | " + note);
        }
    }

    private PayslipStatus defaultStatusForExisting(PayslipStatus status) {
        if (status == null) {
            return PayslipStatus.RELEASED;
        }
        return switch (status) {
            case APPROVED -> PayslipStatus.APPROVED;
            case RELEASED -> PayslipStatus.RELEASED;
            case PENDING_APPROVAL -> PayslipStatus.PENDING_APPROVAL;
            default -> PayslipStatus.PENDING_REVIEW;
        };
    }

    private void ensureCompanyDefaultDeductionLines(Payslip payslip, UserDataResponse userData, List<String> discrepancies) {
        if (userData == null || userData.getCompanyId() == null || userData.getCompanyId().isBlank()) {
            return;
        }
        if (!PayslipDeductionCodec.read(payslip.getDeductionLinesJson()).isEmpty()) {
            return;
        }

        try {
            CompanySettingsDTO companySettings = companySettingsClient.getCompanySettings(userData.getCompanyId());
            List<PayrollDeductionLineDTO> deductionLines = buildDeductionLinesFromTemplates(
                    companySettings != null ? companySettings.getPayrollTaxTemplates() : List.of(),
                    userData
            );
            if (!deductionLines.isEmpty()) {
                payslip.setDeductionLinesJson(PayslipDeductionCodec.write(deductionLines));
            }
        } catch (Exception ex) {
            discrepancies.add("Could not load company tax defaults");
        }
    }

    private List<PayrollDeductionLineDTO> buildDeductionLinesFromTemplates(
            List<PayrollTaxTemplateDTO> templates,
            UserDataResponse userData
    ) {
        if (templates == null || templates.isEmpty()) {
            return List.of();
        }

        List<PayrollDeductionLineDTO> lines = new ArrayList<>();
        for (PayrollTaxTemplateDTO template : templates) {
            if (template == null || !Boolean.TRUE.equals(template.getActive())) {
                continue;
            }
            if (!matchesEmployeeProfileTrigger(template.getEmployeeProfileTrigger(), userData)) {
                continue;
            }

            PayrollDeductionLineDTO line = new PayrollDeductionLineDTO();
            line.setId(UUID.randomUUID().toString());
            line.setCode(template.getCode());
            line.setLabel(template.getLabel());
            line.setCategory(template.getCategory());
            line.setCalculationType(template.getCalculationType());
            line.setConfiguredValue(template.getConfiguredValue());
            line.setCalculatedAmount(null);
            line.setManualAmountOverride(null);
            line.setSource("COMPANY_DEFAULT");
            line.setNotes(template.getNotes());
            line.setSortOrder(template.getSortOrder());
            lines.add(line);
        }

        lines.sort(Comparator
                .comparing((PayrollDeductionLineDTO line) -> line.getSortOrder() == null ? 0 : line.getSortOrder())
                .thenComparing(line -> orEmpty(line.getCode())));
        return lines;
    }

    private boolean matchesEmployeeProfileTrigger(String trigger, UserDataResponse userData) {
        String normalized = orEmpty(trigger).trim().toUpperCase(Locale.ROOT);
        if (normalized.isEmpty() || "ALWAYS".equals(normalized)) {
            return true;
        }
        return switch (normalized) {
            case "PENSION_PARTICIPANT" -> userData.getPensionParticipant();
            case "SPECIAL_ZVW_CONTRIBUTION" -> userData.getSpecialZvwContribution();
            case "APPLY_LOONHEFFINGSKORTING" -> userData.getApplyLoonheffingskorting();
            default -> true;
        };
    }

    private void syncLegacyLoonheffingAmount(Payslip payslip, BigDecimal amount) {
        List<PayrollDeductionLineDTO> lines = new ArrayList<>(PayslipDeductionCodec.read(payslip.getDeductionLinesJson()));
        PayrollDeductionLineDTO loonheffing = lines.stream()
                .filter(line -> "LOONHEFFING".equalsIgnoreCase(line.getCode()))
                .findFirst()
                .orElse(null);
        if (loonheffing == null) {
            loonheffing = PayslipDeductionCodec.createLegacyLoonheffingLine(amount);
            lines.add(loonheffing);
        } else {
            loonheffing.setCalculationType("FIXED_AMOUNT");
            loonheffing.setConfiguredValue(amount);
            loonheffing.setManualAmountOverride(amount);
            loonheffing.setSource("MANUAL");
        }
        payslip.setDeductionLinesJson(PayslipDeductionCodec.write(lines));
    }

    private String buildDeductionRows(PayslipResponseDTO dto, NumberFormat eur) {
        List<PayrollDeductionLineDTO> deductionLines = dto.getDeductionLines() == null
                ? List.of()
                : dto.getDeductionLines();
        if (deductionLines.isEmpty()) {
            return "<tr><td>No deductions</td><td class=\"num\">" + eur.format(BigDecimal.ZERO) + "</td></tr>";
        }

        StringBuilder rows = new StringBuilder();
        for (PayrollDeductionLineDTO line : deductionLines) {
            rows.append("<tr>")
                    .append("<td>")
                    .append(escape(line.getLabel() == null || line.getLabel().isBlank() ? line.getCode() : line.getLabel()))
                    .append("</td>")
                    .append("<td class=\"num\">")
                    .append(eur.format(safe(line.getCalculatedAmount())))
                    .append("</td>")
                    .append("</tr>");
        }
        return rows.toString();
    }

    private List<PayslipResponseDTO> mapPayslipsToDto(List<Payslip> payslips) {
        List<PayslipResponseDTO> results = new ArrayList<>();
        for (Payslip payslip : payslips) {
            try {
                PayslipResponseDTO dto = PayslipMapper.toDTO(payslip);
                if (dto != null) {
                    results.add(dto);
                }
            } catch (Exception ex) {
                log.error("Skipping payslip during DTO mapping. payslipId={} status={} userId={}",
                        payslip != null ? payslip.getPayslipId() : null,
                        payslip != null ? payslip.getStatus() : null,
                        payslip != null ? payslip.getUserId() : null,
                        ex);
            }
        }
        return results;
    }
}
