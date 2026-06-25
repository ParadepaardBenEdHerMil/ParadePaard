package com.pm.payrollservice.service;

import com.pm.payrollservice.dto.MarginBreakdownRowDTO;
import com.pm.payrollservice.dto.MarginOverviewDTO;
import com.pm.payrollservice.dto.PlanningResolvedRateDTO;
import com.pm.payrollservice.dto.ShiftFinanceRowDTO;
import com.pm.payrollservice.grpc.ContractServiceGrpcClient;
import com.pm.payrollservice.grpc.TimesheetServiceGrpcClient;
import contract.ContractDataResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import timesheet.CompanyTimesheetsResponse;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Per-shift revenue & margin assembly (Phase 2). Compute-on-read, ESTIMATED:
 * revenue = worked hours x resolved billing rate; employer cost = gross +
 * holiday allowance + employer Zvw + premies werknemersverzekeringen (mirrors
 * {@link PayrollFinanceService}'s cost composition); margin = revenue - cost.
 * A missing rate yields revenue 0 and marginStatus "missing_rate". ACTUAL
 * allocation against released payslips is a later (persistence) step.
 */
@Service
public class PayrollMarginService {
    private static final Logger log = LoggerFactory.getLogger(PayrollMarginService.class);
    private static final BigDecimal LOW_MARGIN_PERCENTAGE = new BigDecimal("15");
    private static final String TAG_ESTIMATED = "ESTIMATED";

    private final TimesheetServiceGrpcClient timesheetClient;
    private final ContractServiceGrpcClient contractClient;
    private final PlanningBillingRateClient planningClient;

    public PayrollMarginService(TimesheetServiceGrpcClient timesheetClient,
                                ContractServiceGrpcClient contractClient,
                                PlanningBillingRateClient planningClient) {
        this.timesheetClient = timesheetClient;
        this.contractClient = contractClient;
        this.planningClient = planningClient;
    }

    public List<ShiftFinanceRowDTO> shifts(UUID companyId, LocalDate from, LocalDate to, String bearerToken) {
        return assemble(companyId, from, to, bearerToken);
    }

    public MarginOverviewDTO overview(UUID companyId, LocalDate from, LocalDate to, String bearerToken) {
        List<ShiftFinanceRowDTO> rows = assemble(companyId, from, to, bearerToken);
        BigDecimal revenue = BigDecimal.ZERO;
        BigDecimal cost = BigDecimal.ZERO;
        BigDecimal hours = BigDecimal.ZERO;
        int missing = 0;
        int negative = 0;
        for (ShiftFinanceRowDTO r : rows) {
            revenue = revenue.add(nz(r.getClientRevenue()));
            cost = cost.add(nz(r.getTotalEmployerCost()));
            hours = hours.add(nz(r.getHours()));
            if ("missing_rate".equals(r.getMarginStatus())) missing++;
            if ("negative_margin".equals(r.getMarginStatus())) negative++;
        }
        BigDecimal margin = revenue.subtract(cost);
        MarginOverviewDTO dto = new MarginOverviewDTO();
        dto.setFrom(from.toString());
        dto.setTo(to.toString());
        dto.setTotalRevenue(money(revenue));
        dto.setTotalEmployerCost(money(cost));
        dto.setTotalMargin(money(margin));
        dto.setMarginPercentage(percentage(margin, revenue));
        dto.setTotalHours(money(hours));
        dto.setShiftCount(rows.size());
        dto.setMissingRateCount(missing);
        dto.setNegativeMarginCount(negative);
        dto.setTag(TAG_ESTIMATED);
        return dto;
    }

    public List<MarginBreakdownRowDTO> breakdown(UUID companyId, LocalDate from, LocalDate to, String dimension, String bearerToken) {
        List<ShiftFinanceRowDTO> rows = assemble(companyId, from, to, bearerToken);
        String dim = dimension == null ? "CLIENT" : dimension.trim().toUpperCase(Locale.ROOT);
        Map<String, MarginBreakdownRowDTO> groups = new LinkedHashMap<>();
        for (ShiftFinanceRowDTO r : rows) {
            String key = keyFor(r, dim);
            MarginBreakdownRowDTO g = groups.get(key);
            if (g == null) {
                g = new MarginBreakdownRowDTO();
                g.setGroupId(key);
                g.setLabel(labelFor(r, dim));
                g.setRevenue(BigDecimal.ZERO);
                g.setEmployerCost(BigDecimal.ZERO);
                g.setHours(BigDecimal.ZERO);
                groups.put(key, g);
            }
            g.setRevenue(g.getRevenue().add(nz(r.getClientRevenue())));
            g.setEmployerCost(g.getEmployerCost().add(nz(r.getTotalEmployerCost())));
            g.setHours(g.getHours().add(nz(r.getHours())));
            g.setShiftCount(g.getShiftCount() + 1);
            if ("missing_rate".equals(r.getMarginStatus())) g.setMissingRateCount(g.getMissingRateCount() + 1);
            if ("negative_margin".equals(r.getMarginStatus())) g.setNegativeMarginCount(g.getNegativeMarginCount() + 1);
        }
        List<MarginBreakdownRowDTO> result = new ArrayList<>(groups.values());
        for (MarginBreakdownRowDTO g : result) {
            BigDecimal margin = nz(g.getRevenue()).subtract(nz(g.getEmployerCost()));
            g.setMargin(money(margin));
            g.setMarginPercentage(percentage(margin, nz(g.getRevenue())));
            g.setRevenue(money(g.getRevenue()));
            g.setEmployerCost(money(g.getEmployerCost()));
            g.setHours(money(g.getHours()));
        }
        if ("MONTH".equals(dim)) {
            result.sort(Comparator.comparing(MarginBreakdownRowDTO::getGroupId));
        } else {
            result.sort(Comparator.comparing(g -> g.getLabel() == null ? "" : g.getLabel().toLowerCase(Locale.ROOT)));
        }
        return result;
    }

    public String exportCsv(UUID companyId, LocalDate from, LocalDate to, String bearerToken) {
        List<ShiftFinanceRowDTO> rows = assemble(companyId, from, to, bearerToken);
        StringBuilder sb = new StringBuilder();
        sb.append("shiftDate,client,project,function,userId,hours,hourlyWage,grossWage,holidayAllowance,")
          .append("employerZvw,employerPremies,totalEmployerCost,ratePerHour,clientRevenue,margin,marginPercentage,marginStatus,rateSource\n");
        for (ShiftFinanceRowDTO r : rows) {
            sb.append(csv(r.getShiftDate())).append(',')
              .append(csv(r.getClientName())).append(',')
              .append(csv(r.getProjectName())).append(',')
              .append(csv(r.getFunction())).append(',')
              .append(csv(r.getUserId())).append(',')
              .append(plain(r.getHours())).append(',')
              .append(plain(r.getHourlyWage())).append(',')
              .append(plain(r.getGrossWage())).append(',')
              .append(plain(r.getHolidayAllowance())).append(',')
              .append(plain(r.getEmployerZvw())).append(',')
              .append(plain(r.getEmployerInsurancePremiums())).append(',')
              .append(plain(r.getTotalEmployerCost())).append(',')
              .append(plain(r.getRatePerHour())).append(',')
              .append(plain(r.getClientRevenue())).append(',')
              .append(plain(r.getMargin())).append(',')
              .append(plain(r.getMarginPercentage())).append(',')
              .append(csv(r.getMarginStatus())).append(',')
              .append(csv(r.getRateSource())).append('\n');
        }
        return sb.toString();
    }

    List<ShiftFinanceRowDTO> assemble(UUID companyId, LocalDate from, LocalDate to, String bearerToken) {
        if (companyId == null) {
            throw new IllegalArgumentException("companyId is required for margin figures");
        }
        CompanyTimesheetsResponse response =
                timesheetClient.requestCompanyTimesheets(companyId.toString(), from.toString(), to.toString());
        List<timesheet.Timesheet> timesheets = response.getTimesheetsList();
        if (timesheets.isEmpty()) {
            return List.of();
        }

        List<Map<String, Object>> items = new ArrayList<>(timesheets.size());
        for (timesheet.Timesheet ts : timesheets) {
            Map<String, Object> item = new HashMap<>();
            item.put("projectId", emptyToNull(ts.getSourceProjectId()));
            item.put("userId", emptyToNull(ts.getUserId()));
            item.put("function", ts.getFunctionName());
            item.put("date", emptyToNull(ts.getShiftDate()));
            items.add(item);
        }
        List<PlanningResolvedRateDTO> resolved;
        try {
            resolved = planningClient.resolveRates(bearerToken, items);
        } catch (Exception ex) {
            log.warn("Billing-rate resolve failed; treating all shifts as missing_rate", ex);
            resolved = List.of();
        }

        Map<String, ContractDataResponse> contractCache = new HashMap<>();
        List<ShiftFinanceRowDTO> rows = new ArrayList<>(timesheets.size());
        for (int i = 0; i < timesheets.size(); i++) {
            PlanningResolvedRateDTO rate = i < resolved.size() ? resolved.get(i) : null;
            rows.add(computeRow(timesheets.get(i), rate, contractCache, to));
        }
        return rows;
    }

    private ShiftFinanceRowDTO computeRow(timesheet.Timesheet ts, PlanningResolvedRateDTO rate,
                                          Map<String, ContractDataResponse> contractCache, LocalDate fallbackDate) {
        ShiftFinanceRowDTO row = new ShiftFinanceRowDTO();
        row.setTimesheetId(ts.getTimesheetId());
        row.setUserId(emptyToNull(ts.getUserId()));
        row.setProjectId(emptyToNull(ts.getSourceProjectId()));
        row.setFunction(ts.getFunctionName());
        row.setShiftDate(emptyToNull(ts.getShiftDate()));
        row.setProjectName(emptyToNull(ts.getProjectName()));
        row.setTag(TAG_ESTIMATED);

        BigDecimal hours = parse(ts.getHoursWorked());
        row.setHours(money(hours));

        ContractDataResponse contract = contractFor(emptyToNull(ts.getUserId()), contractCache);
        BigDecimal wage = contract == null ? BigDecimal.ZERO : parse(contract.getGrossHourlyWage());
        BigDecimal holidayPct = contract == null ? BigDecimal.ZERO : parse(contract.getHolidayAllowancePercentage());
        String paymentFrequency = contract == null ? null : contract.getPaymentFrequency();
        row.setHourlyWage(money(wage));

        LocalDate shiftDate = parseDate(ts.getShiftDate(), fallbackDate);
        DutchPayrollTaxRates rates = DutchPayrollTaxRates.forYear(shiftDate.getYear());
        int periodsPerYear = LoonheffingCalculator.periodsPerYear(paymentFrequency);

        BigDecimal gross = money(hours.multiply(wage));
        BigDecimal holiday = money(gross.multiply(holidayPct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
        BigDecimal employerZvw = money(LoonheffingCalculator.periodEmployerZvw(gross, periodsPerYear, rates));
        BigDecimal employerPremies = money(LoonheffingCalculator.periodEmployerInsurancePremiums(gross, periodsPerYear, rates));
        BigDecimal totalCost = money(gross.add(holiday).add(employerZvw).add(employerPremies));
        row.setGrossWage(gross);
        row.setHolidayAllowance(holiday);
        row.setEmployerZvw(employerZvw);
        row.setEmployerInsurancePremiums(employerPremies);
        row.setTotalEmployerCost(totalCost);

        if (rate != null) {
            row.setClientCompanyId(rate.getClientCompanyId());
            row.setClientName(rate.getClientName());
            if (rate.getProjectName() != null) {
                row.setProjectName(rate.getProjectName());
            }
            row.setRateSource(rate.getSource());
        }

        BigDecimal ratePerHour = rate == null ? null : rate.getRatePerHour();
        boolean missingRate = ratePerHour == null;
        BigDecimal revenue = missingRate ? BigDecimal.ZERO : money(hours.multiply(ratePerHour));
        BigDecimal margin = missingRate ? BigDecimal.ZERO : money(revenue.subtract(totalCost));
        row.setRatePerHour(ratePerHour == null ? null : money(ratePerHour));
        row.setClientRevenue(money(revenue));
        row.setMargin(money(margin));
        row.setMarginPercentage(percentage(margin, revenue));
        row.setMarginStatus(marginStatus(missingRate, margin, row.getMarginPercentage()));
        return row;
    }

    private ContractDataResponse contractFor(String userId, Map<String, ContractDataResponse> cache) {
        if (userId == null) {
            return null;
        }
        if (cache.containsKey(userId)) {
            return cache.get(userId);
        }
        ContractDataResponse contract = null;
        try {
            contract = contractClient.requestContractData(userId);
        } catch (Exception ex) {
            log.debug("No contract for user {} ({})", userId, ex.getMessage());
        }
        cache.put(userId, contract);
        return contract;
    }

    private static String marginStatus(boolean missingRate, BigDecimal margin, BigDecimal marginPct) {
        if (missingRate) return "missing_rate";
        if (margin.signum() < 0) return "negative_margin";
        if (marginPct != null && marginPct.compareTo(LOW_MARGIN_PERCENTAGE) < 0) return "low_margin";
        return "healthy";
    }

    private static String keyFor(ShiftFinanceRowDTO r, String dim) {
        switch (dim) {
            case "PROJECT": return r.getProjectId() == null ? "—" : r.getProjectId();
            case "EMPLOYEE": return r.getUserId() == null ? "—" : r.getUserId();
            case "FUNCTION": return r.getFunction() == null || r.getFunction().isBlank() ? "—" : r.getFunction();
            case "MONTH": return r.getShiftDate() == null || r.getShiftDate().length() < 7 ? "—" : r.getShiftDate().substring(0, 7);
            default: return r.getClientCompanyId() == null ? "—" : r.getClientCompanyId();
        }
    }

    private static String labelFor(ShiftFinanceRowDTO r, String dim) {
        switch (dim) {
            case "PROJECT": return r.getProjectName() == null ? "Unknown project" : r.getProjectName();
            case "EMPLOYEE": return r.getUserId() == null ? "Unknown" : r.getUserId();
            case "FUNCTION": return r.getFunction() == null || r.getFunction().isBlank() ? "Unknown function" : r.getFunction();
            case "MONTH": return keyFor(r, dim);
            default: return r.getClientName() == null ? "Unknown client" : r.getClientName();
        }
    }

    private static BigDecimal percentage(BigDecimal margin, BigDecimal revenue) {
        if (revenue == null || revenue.signum() <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return margin.multiply(BigDecimal.valueOf(100)).divide(revenue, 2, RoundingMode.HALF_UP);
    }

    private static LocalDate parseDate(String value, LocalDate fallback) {
        if (value == null || value.isBlank()) return fallback;
        try { return LocalDate.parse(value.trim()); } catch (Exception ex) { return fallback; }
    }

    private static BigDecimal parse(String value) {
        if (value == null || value.isBlank()) return BigDecimal.ZERO;
        try { return new BigDecimal(value.trim()); } catch (NumberFormatException ex) { return BigDecimal.ZERO; }
    }

    private static String emptyToNull(String v) { return v == null || v.isBlank() ? null : v; }
    private static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }
    private static BigDecimal money(BigDecimal v) { return v.setScale(2, RoundingMode.HALF_UP); }
    private static String csv(String v) {
        if (v == null) return "";
        if (v.contains(",") || v.contains("\"") || v.contains("\n")) return "\"" + v.replace("\"", "\"\"") + "\"";
        return v;
    }
    private static String plain(BigDecimal v) { return v == null ? "" : v.toPlainString(); }
}
