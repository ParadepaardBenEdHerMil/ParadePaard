package com.pm.payrollservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pm.payrollservice.dto.AuditLogCreateRequestDTO;
import com.pm.payrollservice.dto.AuditLogMessagePartDTO;
import com.pm.payrollservice.dto.PagedResponseDTO;
import com.pm.payrollservice.dto.PayrollDeductionLineDTO;
import com.pm.payrollservice.dto.PayslipDeductionCodec;
import com.pm.payrollservice.dto.PayslipRequestDTO;
import com.pm.payrollservice.dto.PayslipResponseDTO;
import com.pm.payrollservice.exception.PayslipNotFoundException;
import com.pm.payrollservice.grpc.ContractServiceGrpcClient;
import com.pm.payrollservice.grpc.TimesheetServiceGrpcClient;
import com.pm.payrollservice.grpc.UserServiceGrpcClient;
import com.pm.payrollservice.integration.AuditLogClient;
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
import org.springframework.beans.factory.annotation.Autowired;
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
    private final PayPeriodCalculator payPeriodCalculator;
    @Autowired(required = false)
    private AuditLogClient auditLogClient;

    public PayrollService(PayslipRepository payslipRepository,
                          com.pm.payrollservice.validation.PayslipValidator duplicateValidator,
                          UserServiceGrpcClient userServiceGrpcClient,
                          ContractServiceGrpcClient contractServiceGrpcClient,
                          TimesheetServiceGrpcClient timesheetServiceGrpcClient,
                          CompanySettingsClient companySettingsClient,
                          PayslipPdfService pdfService,
                          ObjectMapper objectMapper,
                          PayPeriodCalculator payPeriodCalculator) {
        this.payslipRepository = payslipRepository;
        this.duplicateValidator = duplicateValidator;
        this.userServiceGrpcClient = userServiceGrpcClient;
        this.contractServiceGrpcClient = contractServiceGrpcClient;
        this.timesheetServiceGrpcClient = timesheetServiceGrpcClient;
        this.companySettingsClient = companySettingsClient;
        this.pdfService = pdfService;
        this.objectMapper = objectMapper;
        this.payPeriodCalculator = payPeriodCalculator;
    }

    public List<PayslipResponseDTO> getPayslips() {
        return mapPayslipsToDto(payslipRepository.findAll());
    }

    public List<PayslipResponseDTO> getPayslips(UUID companyId) {
        return mapPayslipsToDto(filterPayslipsByCompany(payslipRepository.findAll(), companyId));
    }

    public PagedResponseDTO<PayslipResponseDTO> getPayslipsPage(int page, int size) {
        var pageable = PageRequest.of(page, size);
        return PagedResponseDTO.from(
                payslipRepository.findAllByOrderByDateOfIssueDesc(pageable),
                PayslipMapper::toDTO
        );
    }

    public PagedResponseDTO<PayslipResponseDTO> getPayslipsPage(UUID companyId, int page, int size) {
        List<PayslipResponseDTO> filtered = mapPayslipsToDto(filterPayslipsByCompany(payslipRepository.findAll(), companyId));
        filtered.sort(Comparator.comparing(PayslipResponseDTO::getDateOfIssue, Comparator.nullsLast(String::compareTo)).reversed());
        return paginate(filtered, page, size);
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

    public List<PayslipResponseDTO> getPayslipsPendingReview(UUID companyId) {
        List<PayslipStatus> statuses = List.of(
                PayslipStatus.PENDING_REVIEW,
                PayslipStatus.PENDING_APPROVAL,
                PayslipStatus.NEEDS_ATTENTION,
                PayslipStatus.DISPUTED
        );
        return mapPayslipsToDto(filterPayslipsByCompany(
                payslipRepository.findByStatusInOrderByDateOfIssueDesc(statuses),
                companyId
        ));
    }

    public PayslipResponseDTO getPayslipById(UUID id) {
        Payslip payslip = payslipRepository.findById(id)
                .orElseThrow(() -> new PayslipNotFoundException("Payslip with id: " + id + " not found"));
        return PayslipMapper.toDTO(payslip);
    }

    public PayslipResponseDTO getPayslipById(UUID id, UUID companyId) {
        Payslip payslip = payslipRepository.findById(id)
                .orElseThrow(() -> new PayslipNotFoundException("Payslip with id: " + id + " not found"));
        requirePayslipInCompany(payslip, companyId);
        return PayslipMapper.toDTO(payslip);
    }

    public PayslipResponseDTO createPayslip(PayslipRequestDTO req) {
        return createPayslip(req, null);
    }

    public PayslipResponseDTO createPayslip(PayslipRequestDTO req, String accessToken) {
        return createPayslip(req, null, accessToken);
    }

    public PayslipResponseDTO createPayslip(PayslipRequestDTO req, UUID companyId, String accessToken) {
        LocalDate date = LocalDate.parse(req.getDateOfIssue());
        UUID userId = UUID.fromString(req.getUserId());
        requireUserInCompany(userId, companyId);

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
        recordAudit(
                accessToken,
                "CREATED",
                payslip,
                List.of(
                        textPart(" created payslip "),
                        payslipLink(payslip),
                        textPart(" for "),
                        userLink(payslip.getUserId())
                )
        );
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

    public PayslipResponseDTO syncContractOwnedScheduledPayslip(UUID userId, LocalDate anchorDate, LocalDate today) {
        ContractDataResponse contractData = contractServiceGrpcClient.requestContractData(userId.toString(), anchorDate, anchorDate);
        PayPeriod period = payPeriodCalculator.periodFor(contractData.getPaymentFrequency(), anchorDate);
        if (today.isBefore(period.end())) {
            return null;
        }

        Payslip payslip = findExistingByPeriodKey(userId, period.key());
        if (payslip == null) {
            payslip = new Payslip();
            payslip.setUserId(userId);
            payslip.setGeneratedAt(OffsetDateTime.now());
        }

        payslip.setDateOfIssue(period.end());
        payslip.setPayPeriodKey(period.key());
        payslip.setPayPeriodStart(period.start());
        payslip.setPayPeriodEnd(period.end());
        payslip.setWeekNumber(period.end().get(WeekFields.ISO.weekOfWeekBasedYear()));
        payslip.setWeekBasedYear(period.end().get(WeekFields.ISO.weekBasedYear()));
        payslip.setStatus(PayslipStatus.PENDING_REVIEW);
        payslip.setAvailableToUserAt(today);

        TimesheetFetchResult fetchResult = populatePayslipData(payslip, userId, payslip.getWeekNumber(), payslip.getWeekBasedYear());
        PayslipCalculator.apply(payslip);

        if (shouldSkipZeroPayPeriod(payslip, contractData)) {
            log.info("Skipping zero-pay payslip for userId={} period={}", userId, period.key());
            return null;
        }

        applyDiscrepancyStatus(payslip, fetchResult, PayslipStatus.PENDING_REVIEW);
        return PayslipMapper.toDTO(payslipRepository.save(payslip));
    }

    public PayslipResponseDTO reportPayslipError(UUID payslipId, String errorDescription) {
        return reportPayslipError(payslipId, errorDescription, null);
    }

    public PayslipResponseDTO reportPayslipError(UUID payslipId, String errorDescription, String accessToken) {
        return reportPayslipError(payslipId, null, errorDescription, accessToken);
    }

    public PayslipResponseDTO reportPayslipError(UUID payslipId, UUID companyId, String errorDescription, String accessToken) {
        Payslip payslip = payslipRepository.findById(payslipId)
                .orElseThrow(() -> new PayslipNotFoundException("Payslip with id: " + payslipId + " not found"));
        requirePayslipInCompany(payslip, companyId);

        payslip.setErrorDescription(errorDescription);
        payslip.setStatus(PayslipStatus.DISPUTED);

        payslip = payslipRepository.save(payslip);
        recordAudit(
                accessToken,
                "REPORTED_ERROR",
                payslip,
                List.of(
                        textPart(" reported an error on "),
                        payslipLink(payslip),
                        textPart(" for "),
                        userLink(payslip.getUserId())
                )
        );
        return PayslipMapper.toDTO(payslip);
    }

    public PayslipResponseDTO updatePayslip(UUID id, PayslipRequestDTO req) {
        return updatePayslip(id, req, null);
    }

    public PayslipResponseDTO updatePayslip(UUID id, PayslipRequestDTO req, String accessToken) {
        return updatePayslip(id, req, null, accessToken);
    }

    public PayslipResponseDTO updatePayslip(UUID id, PayslipRequestDTO req, UUID companyId, String accessToken) {
        Payslip payslip = payslipRepository.findById(id)
                .orElseThrow(() -> new PayslipNotFoundException("Payslip with id: " + id + " not found"));
        requirePayslipInCompany(payslip, companyId);
        PayslipStatus previousStatus = payslip.getStatus();

        if (req.getUserId() != null && !req.getUserId().isBlank()) {
            UUID userId = UUID.fromString(req.getUserId());
            requireUserInCompany(userId, companyId);
            payslip.setUserId(userId);
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
        recordAudit(
                accessToken,
                actionForUpdate(previousStatus, payslip.getStatus()),
                payslip,
                updateMessageParts(payslip, previousStatus)
        );
        return PayslipMapper.toDTO(payslip);
    }

    public void deletePayslip(UUID id) {
        deletePayslip(id, null);
    }

    public void deletePayslip(UUID id, String accessToken) {
        deletePayslip(id, null, accessToken);
    }

    public void deletePayslip(UUID id, UUID companyId, String accessToken) {
        Payslip payslip = payslipRepository.findById(id)
                .orElseThrow(() -> new PayslipNotFoundException("Payslip with id: " + id + " not found"));
        requirePayslipInCompany(payslip, companyId);
        payslipRepository.deleteById(id);
        recordAudit(
                accessToken,
                "DELETED",
                payslip,
                List.of(
                        textPart(" deleted "),
                        payslipLink(payslip),
                        textPart(" for "),
                        userLink(payslip.getUserId())
                )
        );
    }

    private void recordAudit(String accessToken, String action, Payslip payslip, List<AuditLogMessagePartDTO> messageParts) {
        if (auditLogClient == null || accessToken == null || accessToken.isBlank() || payslip == null) {
            return;
        }
        AuditLogCreateRequestDTO request = new AuditLogCreateRequestDTO();
        request.setCategory("PAYROLL");
        request.setAction(action);
        request.setEntityType("PAYSLIP");
        request.setEntityId(payslip.getPayslipId() == null ? null : payslip.getPayslipId().toString());
        request.setMessageParts(messageParts);
        auditLogClient.record(accessToken, request);
    }

    private static String actionForUpdate(PayslipStatus previousStatus, PayslipStatus nextStatus) {
        if (nextStatus == PayslipStatus.APPROVED && previousStatus != PayslipStatus.APPROVED) {
            return "APPROVED";
        }
        if (nextStatus == PayslipStatus.RELEASED && previousStatus != PayslipStatus.RELEASED) {
            return "RELEASED";
        }
        if (nextStatus == PayslipStatus.DISPUTED && previousStatus != PayslipStatus.DISPUTED) {
            return "DISPUTED";
        }
        if (nextStatus == PayslipStatus.NEEDS_ATTENTION && previousStatus != PayslipStatus.NEEDS_ATTENTION) {
            return "FLAGGED";
        }
        return "UPDATED";
    }

    private static List<AuditLogMessagePartDTO> updateMessageParts(Payslip payslip, PayslipStatus previousStatus) {
        String actionText = switch (actionForUpdate(previousStatus, payslip.getStatus())) {
            case "APPROVED" -> " approved ";
            case "RELEASED" -> " released ";
            case "DISPUTED" -> " marked disputed ";
            case "FLAGGED" -> " flagged ";
            default -> " updated ";
        };
        return List.of(
                textPart(actionText),
                payslipLink(payslip),
                textPart(" for "),
                userLink(payslip.getUserId())
        );
    }

    private static AuditLogMessagePartDTO textPart(String text) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("TEXT");
        part.setText(text);
        return part;
    }

    private static AuditLogMessagePartDTO userLink(UUID userId) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("LINK");
        part.setEntityType("USER");
        part.setEntityId(userId == null ? null : userId.toString());
        part.setRoute(userId == null ? null : "/management/users/" + userId);
        return part;
    }

    private static AuditLogMessagePartDTO payslipLink(Payslip payslip) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("LINK");
        part.setEntityType("PAYSLIP");
        part.setEntityId(payslip.getPayslipId() == null ? null : payslip.getPayslipId().toString());
        part.setLabel("payslip " + (payslip.getDateOfIssue() == null ? "" : payslip.getDateOfIssue()));
        part.setRoute(payslip.getPayslipId() == null ? null : "/management/payslips/" + payslip.getPayslipId());
        return part;
    }

    public String renderPayslipHtml(UUID id) {
        return renderPayslipHtml(id, null);
    }

    public String renderPayslipHtml(UUID id, UUID companyId) {
        PayslipResponseDTO dto = getPayslipById(id, companyId);
        String json;
        try {
            json = objectMapper.writeValueAsString(dto);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("could not serialize dto", e);
        }
        String template = loadTemplate("templates/payslip.html");
        return template.replace("__PAYSLIP_JSON__", json);
    }

    private String renderPayslipHtmlForPdf(UUID id, UUID companyId) {
        PayslipResponseDTO dto = getPayslipById(id, companyId);
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
        return generatePayslipPdf(id, null);
    }

    public byte[] generatePayslipPdf(UUID id, UUID companyId) {
        String html = renderPayslipHtmlForPdf(id, companyId);
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

    private Payslip findExistingByPeriodKey(UUID userId, String payPeriodKey) {
        return payslipRepository.findByUserIdAndPayPeriodKey(userId, payPeriodKey).orElse(null);
    }

    private boolean shouldSkipZeroPayPeriod(Payslip payslip, ContractDataResponse contractData) {
        BigDecimal hours = safe(payslip.getTotalHoursWorked());
        BigDecimal travel = safe(payslip.getTravelExpenses());
        BigDecimal net = safe(payslip.getTotalNetAmount());
        boolean onCall = contractData.getContractType() != null && contractData.getContractType().startsWith("ON_CALL");
        return onCall
                && hours.compareTo(BigDecimal.ZERO) == 0
                && travel.compareTo(BigDecimal.ZERO) == 0
                && net.compareTo(BigDecimal.ZERO) == 0;
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
        ContractDataResponse contractData = populateContractData(payslip, userId, weekNumber, weekBasedYear, discrepancies);

        TimesheetFetchResult fetchResult = fetchTimesheetData(userId, weekNumber, weekBasedYear);
        discrepancies.addAll(fetchResult.discrepancies());
        PayslipMapper.updateFromTimesheetData(payslip, fetchResult.timesheetData());

        ensureStatutoryDeductionLines(payslip, contractData, userData);
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

    private ContractDataResponse populateContractData(Payslip payslip, UUID userId, int weekNumber, int weekBasedYear, List<String> discrepancies) {
        try {
            LocalDate periodStart = isoWeekStart(weekNumber, weekBasedYear);
            LocalDate periodEnd = periodStart.plusDays(6);
            ContractDataResponse contractData = contractServiceGrpcClient.requestContractData(
                    userId.toString(),
                    periodStart,
                    periodEnd
            );
            PayslipMapper.updateFromContractData(payslip, contractData);
            return contractData;
        } catch (StatusRuntimeException ex) {
            discrepancies.add(describeGrpcIssue("contract data", ex));
        } catch (Exception ex) {
            discrepancies.add("Could not load contract data");
        }
        return null;
    }

    private LocalDate isoWeekStart(int weekNumber, int weekBasedYear) {
        return LocalDate.now()
                .with(WeekFields.ISO.weekBasedYear(), weekBasedYear)
                .with(WeekFields.ISO.weekOfWeekBasedYear(), weekNumber)
                .with(WeekFields.ISO.dayOfWeek(), 1);
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

    /**
     * Builds the statutory Dutch employee deduction lines (loonheffing, employee
     * pension, employee Zvw) from the contract terms - which were themselves
     * resolved from the Horeca rule version at contract design - falling back to
     * the employee record and statutory defaults when a contract is unavailable.
     * The national loonheffing brackets stay in {@link DutchPayrollTaxRates}.
     * Pre-existing (admin-edited) deduction lines are left untouched.
     */
    private void ensureStatutoryDeductionLines(Payslip payslip, ContractDataResponse contractData, UserDataResponse userData) {
        if (!PayslipDeductionCodec.read(payslip.getDeductionLinesJson()).isEmpty()) {
            return;
        }

        DutchPayrollTaxRates rates = DutchPayrollTaxRates.forYear(payrollYear(payslip));

        boolean pensionApplicable = resolvePensionApplicable(contractData, userData);
        boolean specialZvw = resolveSpecialZvw(contractData, userData);

        List<PayrollDeductionLineDTO> lines = new ArrayList<>();
        lines.add(statutoryLine("LOONHEFFING", "Loonheffing", "TAX", "LOONHEFFING_TABLE", null, 10,
                "Loonbelasting/premie volksverzekeringen, automatisch berekend uit de tijdvaktabel."));
        if (pensionApplicable) {
            lines.add(statutoryLine("PENSION_EMPLOYEE", "Pensioenpremie werknemer", "PENSION", "PERCENT_OF_GROSS",
                    resolvePensionPercentage(contractData, rates), 20, "Werknemersdeel pensioenpremie (pre-tax)."));
        }
        if (specialZvw) {
            lines.add(statutoryLine("ZVW_EMPLOYEE", "Bijdrage Zvw", "ZVW", "PERCENT_OF_GROSS",
                    resolveZvwPercentage(contractData, rates), 30, "Inhouding bijdrage Zvw."));
        }

        payslip.setDeductionLinesJson(PayslipDeductionCodec.write(lines));
    }

    private int payrollYear(Payslip payslip) {
        if (payslip.getWeekBasedYear() != null) {
            return payslip.getWeekBasedYear();
        }
        if (payslip.getDateOfIssue() != null) {
            return payslip.getDateOfIssue().getYear();
        }
        return LocalDate.now().getYear();
    }

    private boolean resolvePensionApplicable(ContractDataResponse contractData, UserDataResponse userData) {
        if (contractData != null) {
            return contractData.getPensionApplicable();
        }
        return userData != null && userData.getPensionParticipant();
    }

    private boolean resolveSpecialZvw(ContractDataResponse contractData, UserDataResponse userData) {
        if (contractData != null) {
            return contractData.getSpecialZvwContribution();
        }
        return userData != null && userData.getSpecialZvwContribution();
    }

    private BigDecimal resolvePensionPercentage(ContractDataResponse contractData, DutchPayrollTaxRates rates) {
        BigDecimal fromContract = parsePercentage(contractData == null ? null : contractData.getPensionEmployeePercentage());
        return fromContract != null ? fromContract : rates.defaultPensionEmployeeRatePercent();
    }

    private BigDecimal resolveZvwPercentage(ContractDataResponse contractData, DutchPayrollTaxRates rates) {
        BigDecimal fromContract = parsePercentage(contractData == null ? null : contractData.getZvwEmployeePercentage());
        return fromContract != null ? fromContract : rates.zvwEmployeeRatePercent();
    }

    private static BigDecimal parsePercentage(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(raw.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private PayrollDeductionLineDTO statutoryLine(
            String code, String label, String category, String calculationType,
            BigDecimal configuredValue, int sortOrder, String notes
    ) {
        PayrollDeductionLineDTO line = new PayrollDeductionLineDTO();
        line.setId(UUID.randomUUID().toString());
        line.setCode(code);
        line.setLabel(label);
        line.setCategory(category);
        line.setCalculationType(calculationType);
        line.setConfiguredValue(configuredValue);
        line.setCalculatedAmount(null);
        line.setManualAmountOverride(null);
        line.setSource("RULES");
        line.setNotes(notes);
        line.setSortOrder(sortOrder);
        return line;
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

    private List<Payslip> filterPayslipsByCompany(List<Payslip> payslips, UUID companyId) {
        if (companyId == null) {
            return payslips;
        }
        return payslips.stream()
                .filter(payslip -> belongsToCompany(payslip.getUserId(), companyId))
                .toList();
    }

    private void requirePayslipInCompany(Payslip payslip, UUID companyId) {
        if (payslip == null || companyId == null) {
            return;
        }
        requireUserInCompany(payslip.getUserId(), companyId);
    }

    private void requireUserInCompany(UUID userId, UUID companyId) {
        if (companyId == null || userId == null) {
            return;
        }
        if (!belongsToCompany(userId, companyId)) {
            throw new IllegalArgumentException("Payslip is not accessible in this company");
        }
    }

    private boolean belongsToCompany(UUID userId, UUID companyId) {
        if (companyId == null || userId == null) {
            return true;
        }
        UserDataResponse userData = userServiceGrpcClient.requestUserData(userId.toString());
        return companyId.toString().equals(userData.getCompanyId());
    }

    private static <T> PagedResponseDTO<T> paginate(List<T> items, int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        int totalElements = items.size();
        int fromIndex = Math.min(safePage * safeSize, totalElements);
        int toIndex = Math.min(fromIndex + safeSize, totalElements);
        int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / safeSize);
        return new PagedResponseDTO<>(
                items.subList(fromIndex, toIndex),
                safePage,
                safeSize,
                totalElements,
                totalPages,
                toIndex < totalElements,
                fromIndex > 0
        );
    }
}
