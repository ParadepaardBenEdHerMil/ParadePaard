package com.pm.payrollservice.service;

import com.pm.payrollservice.dto.MarginBreakdownRowDTO;
import com.pm.payrollservice.dto.MarginOverviewDTO;
import com.pm.payrollservice.dto.PlanningResolvedRateDTO;
import com.pm.payrollservice.dto.ShiftFinanceRowDTO;
import com.pm.payrollservice.grpc.ContractServiceGrpcClient;
import com.pm.payrollservice.grpc.TimesheetServiceGrpcClient;
import com.pm.payrollservice.model.Payslip;
import com.pm.payrollservice.model.PayslipStatus;
import com.pm.payrollservice.model.ShiftFinanceRecord;
import com.pm.payrollservice.repository.PayslipRepository;
import com.pm.payrollservice.repository.ShiftFinanceRecordRepository;
import contract.ContractDataResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import timesheet.CompanyTimesheetsResponse;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.WeekFields;
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
 * A missing rate yields revenue 0 and marginStatus "missing_rate".
 *
 * <p>Once a released/approved payslip covers a shift's pay period the row flips
 * to ACTUAL: the payslip's actual employer cost is allocated across that
 * period's shifts pro-rata by gross wage (hours fallback) so the sum reconciles
 * to the payslip, and the row is snapshotted into {@link ShiftFinanceRecord} and
 * locked. Locked records are returned verbatim on later reads.
 */
@Service
public class PayrollMarginService {
    private static final Logger log = LoggerFactory.getLogger(PayrollMarginService.class);
    private static final BigDecimal LOW_MARGIN_PERCENTAGE = new BigDecimal("15");
    private static final String TAG_ESTIMATED = "ESTIMATED";
    private static final String TAG_ACTUAL = "ACTUAL";
    private static final List<PayslipStatus> FINALIZED = List.of(PayslipStatus.RELEASED, PayslipStatus.APPROVED);

    private final TimesheetServiceGrpcClient timesheetClient;
    private final ContractServiceGrpcClient contractClient;
    private final PlanningBillingRateClient planningClient;
    private final PayslipRepository payslipRepository;
    private final ShiftFinanceRecordRepository recordRepository;

    public PayrollMarginService(TimesheetServiceGrpcClient timesheetClient,
                                ContractServiceGrpcClient contractClient,
                                PlanningBillingRateClient planningClient,
                                PayslipRepository payslipRepository,
                                ShiftFinanceRecordRepository recordRepository) {
        this.timesheetClient = timesheetClient;
        this.contractClient = contractClient;
        this.planningClient = planningClient;
        this.payslipRepository = payslipRepository;
        this.recordRepository = recordRepository;
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
        boolean anyActual = false;
        for (ShiftFinanceRowDTO r : rows) {
            revenue = revenue.add(nz(r.getClientRevenue()));
            cost = cost.add(nz(r.getTotalEmployerCost()));
            hours = hours.add(nz(r.getHours()));
            if ("missing_rate".equals(r.getMarginStatus())) missing++;
            if ("negative_margin".equals(r.getMarginStatus())) negative++;
            if (TAG_ACTUAL.equals(r.getTag())) anyActual = true;
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
        dto.setTag(anyActual ? "MIXED" : TAG_ESTIMATED);
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
          .append("employerZvw,employerPremies,totalEmployerCost,ratePerHour,clientRevenue,margin,marginPercentage,marginStatus,rateSource,tag\n");
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
              .append(csv(r.getRateSource())).append(',')
              .append(csv(r.getTag())).append('\n');
        }
        return sb.toString();
    }

    List<ShiftFinanceRowDTO> assemble(UUID companyId, LocalDate from, LocalDate to, String bearerToken) {
        if (companyId == null) {
            throw new IllegalArgumentException("companyId is required for margin figures");
        }
        Map<String, ContractDataResponse> contractCache = new HashMap<>();
        List<ShiftFinanceRowDTO> rows = computeEstimated(companyId, from, to, bearerToken, contractCache);
        if (rows.isEmpty()) {
            return rows;
        }
        applyPersistedAndActuals(companyId, from, to, rows, contractCache);
        return rows;
    }

    private List<ShiftFinanceRowDTO> computeEstimated(UUID companyId, LocalDate from, LocalDate to, String bearerToken,
                                                      Map<String, ContractDataResponse> contractCache) {
        CompanyTimesheetsResponse response =
                timesheetClient.requestCompanyTimesheets(companyId.toString(), from.toString(), to.toString());
        List<timesheet.Timesheet> timesheets = response.getTimesheetsList();
        if (timesheets.isEmpty()) {
            return new ArrayList<>();
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

        List<ShiftFinanceRowDTO> rows = new ArrayList<>(timesheets.size());
        for (int i = 0; i < timesheets.size(); i++) {
            PlanningResolvedRateDTO rate = i < resolved.size() ? resolved.get(i) : null;
            rows.add(computeRow(timesheets.get(i), rate, contractCache, to));
        }
        return rows;
    }

    /**
     * Overlays locked ACTUAL snapshots and, for shifts newly covered by a
     * released/approved payslip, allocates the payslip's employer cost across the
     * period's shifts (pro-rata by gross), recomputes margin, persists + locks.
     */
    private void applyPersistedAndActuals(UUID companyId, LocalDate from, LocalDate to, List<ShiftFinanceRowDTO> rows,
                                          Map<String, ContractDataResponse> contractCache) {
        Map<String, ShiftFinanceRecord> persisted = new HashMap<>();
        try {
            for (ShiftFinanceRecord rec : recordRepository.findByCompanyIdAndShiftDateBetween(companyId, from, to)) {
                if (rec.getTimesheetId() != null) {
                    persisted.put(rec.getTimesheetId().toString(), rec);
                }
            }
        } catch (Exception ex) {
            log.warn("Could not load persisted shift finance records", ex);
        }

        Map<UUID, List<Payslip>> payslipsByUser = new HashMap<>();
        Map<UUID, Payslip> payslipById = new HashMap<>();
        Map<UUID, List<Integer>> coveredByPayslip = new LinkedHashMap<>();

        for (int i = 0; i < rows.size(); i++) {
            ShiftFinanceRowDTO row = rows.get(i);
            ShiftFinanceRecord rec = persisted.get(row.getTimesheetId());
            if (rec != null && rec.isLocked()) {
                rows.set(i, toRow(rec));
                continue;
            }
            Payslip covering = coveringPayslip(companyId, row, payslipsByUser);
            if (covering != null && covering.getPayslipId() != null) {
                coveredByPayslip.computeIfAbsent(covering.getPayslipId(), k -> new ArrayList<>()).add(i);
                payslipById.put(covering.getPayslipId(), covering);
            }
        }

        Map<String, List<timesheet.Timesheet>> periodCache = new HashMap<>();
        for (Map.Entry<UUID, List<Integer>> entry : coveredByPayslip.entrySet()) {
            Payslip payslip = payslipById.get(entry.getKey());
            List<Integer> idxs = entry.getValue();
            BigDecimal actualCost = payslipEmployerCost(payslip);

            // Allocation basis: ALL of the pay period's shifts for this employee, so an
            // in-range shift gets its correct period share even when the query range only
            // covers part of the period (ACTUAL still reconciles to the payslip).
            Map<String, BigDecimal> grossByTimesheet = periodGrosses(companyId, payslip, contractCache, periodCache);
            for (int idx : idxs) {
                ShiftFinanceRowDTO row = rows.get(idx);
                grossByTimesheet.putIfAbsent(row.getTimesheetId(), nz(row.getGrossWage()));
            }

            List<String> ids = new ArrayList<>(grossByTimesheet.keySet());
            List<BigDecimal> weights = new ArrayList<>(ids.size());
            BigDecimal weightSum = BigDecimal.ZERO;
            for (String id : ids) {
                BigDecimal g = nz(grossByTimesheet.get(id));
                weights.add(g);
                weightSum = weightSum.add(g);
            }
            if (weightSum.signum() <= 0) {
                weights.clear();
                for (int k = 0; k < ids.size(); k++) {
                    weights.add(BigDecimal.ONE);
                }
            }
            List<BigDecimal> allocated = ShiftCostAllocator.allocate(actualCost, weights);
            Map<String, BigDecimal> costByTimesheet = new HashMap<>();
            for (int k = 0; k < ids.size(); k++) {
                costByTimesheet.put(ids.get(k), allocated.get(k));
            }

            for (int idx : idxs) {
                ShiftFinanceRowDTO row = rows.get(idx);
                BigDecimal cost = costByTimesheet.getOrDefault(row.getTimesheetId(), nz(row.getTotalEmployerCost()));
                applyActual(row, money(cost));
                persistLocked(companyId, row, payslip);
            }
        }
    }

    /** Gross wage per timesheet id for the full pay period of {@code payslip} (employee-scoped). */
    private Map<String, BigDecimal> periodGrosses(UUID companyId, Payslip payslip,
                                                  Map<String, ContractDataResponse> contractCache,
                                                  Map<String, List<timesheet.Timesheet>> periodCache) {
        Map<String, BigDecimal> grossByTimesheet = new LinkedHashMap<>();
        LocalDate[] period = periodRange(payslip);
        if (period == null || payslip.getUserId() == null) {
            return grossByTimesheet;
        }
        String userId = payslip.getUserId().toString();
        String key = period[0] + "|" + period[1];
        List<timesheet.Timesheet> periodShifts;
        try {
            periodShifts = periodCache.computeIfAbsent(key, k ->
                    timesheetClient.requestCompanyTimesheets(companyId.toString(), period[0].toString(), period[1].toString())
                            .getTimesheetsList());
        } catch (Exception ex) {
            log.warn("Could not fetch pay-period shifts for ACTUAL allocation", ex);
            return grossByTimesheet;
        }
        BigDecimal wage = wageFor(userId, contractCache);
        for (timesheet.Timesheet ts : periodShifts) {
            if (!userId.equals(ts.getUserId())) {
                continue;
            }
            grossByTimesheet.put(ts.getTimesheetId(), money(parse(ts.getHoursWorked()).multiply(wage)));
        }
        return grossByTimesheet;
    }

    private BigDecimal wageFor(String userId, Map<String, ContractDataResponse> contractCache) {
        ContractDataResponse contract = contractFor(userId, contractCache);
        return contract == null ? BigDecimal.ZERO : parse(contract.getGrossHourlyWage());
    }

    private static LocalDate[] periodRange(Payslip p) {
        if (p.getPayPeriodStart() != null && p.getPayPeriodEnd() != null) {
            return new LocalDate[]{p.getPayPeriodStart(), p.getPayPeriodEnd()};
        }
        if (p.getWeekBasedYear() != null && p.getWeekNumber() != null) {
            WeekFields iso = WeekFields.ISO;
            LocalDate monday = LocalDate.now()
                    .with(iso.weekBasedYear(), p.getWeekBasedYear())
                    .with(iso.weekOfWeekBasedYear(), p.getWeekNumber())
                    .with(iso.dayOfWeek(), 1);
            return new LocalDate[]{monday, monday.plusDays(6)};
        }
        return null;
    }

    private void applyActual(ShiftFinanceRowDTO row, BigDecimal actualCost) {
        row.setTotalEmployerCost(actualCost);
        boolean missingRate = row.getRatePerHour() == null;
        BigDecimal revenue = nz(row.getClientRevenue());
        BigDecimal margin = missingRate ? BigDecimal.ZERO : money(revenue.subtract(actualCost));
        row.setMargin(money(margin));
        row.setMarginPercentage(percentage(margin, revenue));
        row.setMarginStatus(marginStatus(missingRate, margin, row.getMarginPercentage()));
        row.setTag(TAG_ACTUAL);
    }

    private void persistLocked(UUID companyId, ShiftFinanceRowDTO row, Payslip payslip) {
        try {
            UUID tsId = parseUuid(row.getTimesheetId());
            if (tsId == null) {
                return;
            }
            ShiftFinanceRecord rec = recordRepository.findByTimesheetId(tsId).orElseGet(ShiftFinanceRecord::new);
            if (rec.isLocked()) {
                return;
            }
            rec.setTimesheetId(tsId);
            rec.setCompanyId(companyId);
            rec.setUserId(parseUuid(row.getUserId()));
            rec.setProjectId(parseUuid(row.getProjectId()));
            rec.setClientCompanyId(parseUuid(row.getClientCompanyId()));
            rec.setFunctionName(row.getFunction());
            rec.setProjectName(row.getProjectName());
            rec.setClientName(row.getClientName());
            rec.setShiftDate(parseDate(row.getShiftDate(), null));
            rec.setPayPeriodKey(payslip.getPayPeriodKey());
            rec.setHours(row.getHours());
            rec.setHourlyWage(row.getHourlyWage());
            rec.setGrossWage(row.getGrossWage());
            rec.setHolidayAllowance(row.getHolidayAllowance());
            rec.setEmployerZvw(row.getEmployerZvw());
            rec.setEmployerInsurancePremiums(row.getEmployerInsurancePremiums());
            rec.setTotalEmployerCost(row.getTotalEmployerCost());
            rec.setRatePerHour(row.getRatePerHour());
            rec.setClientRevenue(row.getClientRevenue());
            rec.setMargin(row.getMargin());
            rec.setMarginPercentage(row.getMarginPercentage());
            rec.setMarginStatus(row.getMarginStatus());
            rec.setRateSource(row.getRateSource());
            rec.setTag(TAG_ACTUAL);
            rec.setLocked(true);
            rec.setPayslipId(payslip.getPayslipId());
            recordRepository.save(rec);
        } catch (Exception ex) {
            log.warn("Could not persist ACTUAL shift finance record for timesheet {}", row.getTimesheetId(), ex);
        }
    }

    private Payslip coveringPayslip(UUID companyId, ShiftFinanceRowDTO row, Map<UUID, List<Payslip>> cache) {
        UUID userId = parseUuid(row.getUserId());
        LocalDate shiftDate = parseDate(row.getShiftDate(), null);
        if (userId == null || shiftDate == null) {
            return null;
        }
        List<Payslip> candidates = cache.computeIfAbsent(userId, u -> {
            List<Payslip> finalized = new ArrayList<>();
            for (Payslip p : payslipRepository.findByUserIdOrderByDateOfIssueDesc(u)) {
                PayslipStatus status = p.getStatus() == null ? PayslipStatus.RELEASED : p.getStatus();
                boolean sameCompany = p.getCompanyId() == null || companyId.equals(p.getCompanyId());
                if (FINALIZED.contains(status) && sameCompany) {
                    finalized.add(p);
                }
            }
            return finalized;
        });
        for (Payslip p : candidates) {
            if (periodContains(p, shiftDate)) {
                return p;
            }
        }
        return null;
    }

    private static boolean periodContains(Payslip p, LocalDate shiftDate) {
        LocalDate start = p.getPayPeriodStart();
        LocalDate end = p.getPayPeriodEnd();
        if (start != null && end != null) {
            return !shiftDate.isBefore(start) && !shiftDate.isAfter(end);
        }
        if (p.getWeekBasedYear() != null && p.getWeekNumber() != null) {
            WeekFields iso = WeekFields.ISO;
            return p.getWeekBasedYear() == shiftDate.get(iso.weekBasedYear())
                    && p.getWeekNumber() == shiftDate.get(iso.weekOfWeekBasedYear());
        }
        return false;
    }

    /** Employer cost of a payslip = gross + holiday + employer Zvw + premies (mirrors PayrollFinanceService). */
    private static BigDecimal payslipEmployerCost(Payslip p) {
        BigDecimal gross = nz(p.getTotalGrossAmount());
        BigDecimal holidayPct = nz(p.getHolidayAllowancePercentage());
        BigDecimal holiday = gross.signum() == 0 || holidayPct.signum() == 0
                ? BigDecimal.ZERO
                : money(gross.multiply(holidayPct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
        return money(gross.add(holiday).add(nz(p.getEmployerZvwLevy())).add(nz(p.getEmployerInsurancePremiums())));
    }

    private static ShiftFinanceRowDTO toRow(ShiftFinanceRecord rec) {
        ShiftFinanceRowDTO row = new ShiftFinanceRowDTO();
        row.setTimesheetId(rec.getTimesheetId() == null ? null : rec.getTimesheetId().toString());
        row.setUserId(rec.getUserId() == null ? null : rec.getUserId().toString());
        row.setProjectId(rec.getProjectId() == null ? null : rec.getProjectId().toString());
        row.setProjectName(rec.getProjectName());
        row.setClientCompanyId(rec.getClientCompanyId() == null ? null : rec.getClientCompanyId().toString());
        row.setClientName(rec.getClientName());
        row.setFunction(rec.getFunctionName());
        row.setShiftDate(rec.getShiftDate() == null ? null : rec.getShiftDate().toString());
        row.setHours(rec.getHours());
        row.setHourlyWage(rec.getHourlyWage());
        row.setGrossWage(rec.getGrossWage());
        row.setHolidayAllowance(rec.getHolidayAllowance());
        row.setEmployerZvw(rec.getEmployerZvw());
        row.setEmployerInsurancePremiums(rec.getEmployerInsurancePremiums());
        row.setTotalEmployerCost(rec.getTotalEmployerCost());
        row.setRatePerHour(rec.getRatePerHour());
        row.setClientRevenue(rec.getClientRevenue());
        row.setMargin(rec.getMargin());
        row.setMarginPercentage(rec.getMarginPercentage());
        row.setMarginStatus(rec.getMarginStatus());
        row.setRateSource(rec.getRateSource());
        row.setTag(rec.getTag() == null ? TAG_ACTUAL : rec.getTag());
        return row;
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

    private static UUID parseUuid(String value) {
        if (value == null || value.isBlank()) return null;
        try { return UUID.fromString(value.trim()); } catch (IllegalArgumentException ex) { return null; }
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
