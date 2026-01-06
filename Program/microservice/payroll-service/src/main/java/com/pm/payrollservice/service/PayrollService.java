package com.pm.payrollservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import io.grpc.StatusRuntimeException;
import org.springframework.core.io.ClassPathResource;
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
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class PayrollService {
    private final PayslipRepository payslipRepository;
    private final com.pm.payrollservice.validation.PayslipValidator duplicateValidator;
    private final UserServiceGrpcClient userServiceGrpcClient;
    private final ContractServiceGrpcClient contractServiceGrpcClient;
    private final TimesheetServiceGrpcClient timesheetServiceGrpcClient;
    private final PayslipPdfService pdfService;
    private final ObjectMapper objectMapper;

    public PayrollService(PayslipRepository payslipRepository,
                          com.pm.payrollservice.validation.PayslipValidator duplicateValidator,
                          UserServiceGrpcClient userServiceGrpcClient,
                          ContractServiceGrpcClient contractServiceGrpcClient,
                          TimesheetServiceGrpcClient timesheetServiceGrpcClient,
                          PayslipPdfService pdfService,
                          ObjectMapper objectMapper) {
        this.payslipRepository = payslipRepository;
        this.duplicateValidator = duplicateValidator;
        this.userServiceGrpcClient = userServiceGrpcClient;
        this.contractServiceGrpcClient = contractServiceGrpcClient;
        this.timesheetServiceGrpcClient = timesheetServiceGrpcClient;
        this.pdfService = pdfService;
        this.objectMapper = objectMapper;
    }

    public List<PayslipResponseDTO> getPayslips() {
        return payslipRepository.findAll().stream().map(PayslipMapper::toDTO).toList();
    }

    public List<PayslipResponseDTO> getPayslipsByUserId(UUID userId) {
        return payslipRepository.findByUserIdOrderByDateOfIssueDesc(userId)
                .stream()
                .map(PayslipMapper::toDTO)
                .toList();
    }

    public List<PayslipResponseDTO> getReleasedPayslipsByUserId(UUID userId) {
        return payslipRepository.findByUserIdOrderByDateOfIssueDesc(userId)
                .stream()
                .filter(p -> p.getStatus() == null
                        || p.getStatus() == PayslipStatus.RELEASED
                        || p.getStatus() == PayslipStatus.APPROVED)
                .map(PayslipMapper::toDTO)
                .toList();
    }

    public List<PayslipResponseDTO> getPayslipsPendingReview() {
        List<PayslipStatus> statuses = List.of(
                PayslipStatus.PENDING_REVIEW,
                PayslipStatus.PENDING_APPROVAL,
                PayslipStatus.NEEDS_ATTENTION,
                PayslipStatus.DISPUTED
        );
        return payslipRepository.findByStatusInOrderByDateOfIssueDesc(statuses)
                .stream()
                .map(PayslipMapper::toDTO)
                .toList();
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

        UserDataResponse userData = userServiceGrpcClient.requestUserData(userId.toString());
        PayslipMapper.updateFromUserData(payslip, userData);

        ContractDataResponse contractData = contractServiceGrpcClient.requestContractData(userId.toString());
        TimesheetFetchResult fetchResult = fetchTimesheetData(userId, payslip.getWeekNumber(), payslip.getWeekBasedYear());
        PayslipMapper.updateFromContractDataAndTimesheetData(payslip, contractData, fetchResult.timesheetData());

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

        UserDataResponse userData = userServiceGrpcClient.requestUserData(userId.toString());
        PayslipMapper.updateFromUserData(payslip, userData);

        ContractDataResponse contractData = contractServiceGrpcClient.requestContractData(userId.toString());
        TimesheetFetchResult fetchResult = fetchTimesheetData(userId, payslip.getWeekNumber(), payslip.getWeekBasedYear());
        PayslipMapper.updateFromContractDataAndTimesheetData(payslip, contractData, fetchResult.timesheetData());

        PayslipCalculator.apply(payslip);
        applyDiscrepancyStatus(payslip, fetchResult, PayslipStatus.PENDING_REVIEW);

        payslip = payslipRepository.save(payslip);
        return PayslipMapper.toDTO(payslip);
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
        if (req.getWageTaxWithheldTest() != null) {
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

    /* html preview that keeps the client script, useful for manual viewing */
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

    /* server filled html for pdf, no script */
    private String renderPayslipHtmlForPdf(UUID id) {
        PayslipResponseDTO dto = getPayslipById(id);
        String template = loadTemplate("templates/payslip_pdf.html");

        NumberFormat eur = NumberFormat.getCurrencyInstance(new Locale("nl", "NL"));

        BigDecimal hours = safe(dto.getTotalHoursWorked());
        BigDecimal rate = safe(dto.getHourlyWage());
        BigDecimal travel = safe(dto.getTravelExpenses());
        BigDecimal total = hours.multiply(rate).add(travel);

        String lines = new StringBuilder()
                .append("<tr>")
                .append("<td>").append(escape(dto.getFunctionName())).append("</td>")
                .append("<td class=\"num\">").append(formatHours(hours)).append("</td>")
                .append("<td class=\"num\">").append(eur.format(rate)).append("</td>")
                .append("<td class=\"num\">").append(eur.format(travel)).append("</td>")
                .append("<td class=\"num\">").append(eur.format(total)).append("</td>")
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
                .replace("__GROSS__", eur.format(safe(dto.getTotalGrossAmount())))
                .replace("__TAX__", eur.format(safe(dto.getWageTaxWithheldTest())))
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
        return s.replace("&","&amp;").replace("<","&lt;")
                .replace(">","&gt;").replace("\"","&quot;");
    }

    private record TimesheetFetchResult(TimesheetDataResponse timesheetData, List<String> discrepancies) { }

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
}
