package com.pm.payrollservice.service;

import com.pm.payrollservice.dto.FinanceBreakdownRowDTO;
import com.pm.payrollservice.dto.FinanceOverviewDTO;
import com.pm.payrollservice.dto.PayrollDeductionLineDTO;
import com.pm.payrollservice.dto.PayslipDeductionCodec;
import com.pm.payrollservice.model.Payslip;
import com.pm.payrollservice.model.PayslipStatus;
import com.pm.payrollservice.repository.PayslipRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Company payroll-cost finance read-model, aggregated from finalized payslips.
 * This is the cost side only (gross wages, loonheffing, employer levies, pension,
 * net paid); client revenue and margin (which need billing rates) are a later phase.
 * All figures are company-scoped and summed across the requested date range.
 */
@Service
public class PayrollFinanceService {

    private static final List<PayslipStatus> VISIBLE_STATUSES = List.of(
            PayslipStatus.RELEASED, PayslipStatus.APPROVED);

    private final PayslipRepository payslipRepository;

    public PayrollFinanceService(PayslipRepository payslipRepository) {
        this.payslipRepository = payslipRepository;
    }

    public FinanceOverviewDTO overview(UUID companyId, LocalDate from, LocalDate to) {
        List<Payslip> payslips = load(companyId, from, to);

        BigDecimal gross = BigDecimal.ZERO;
        BigDecimal net = BigDecimal.ZERO;
        BigDecimal loonheffing = BigDecimal.ZERO;
        BigDecimal deductions = BigDecimal.ZERO;
        BigDecimal employeeZvw = BigDecimal.ZERO;
        BigDecimal employerZvw = BigDecimal.ZERO;
        BigDecimal premiums = BigDecimal.ZERO;
        BigDecimal pension = BigDecimal.ZERO;
        BigDecimal holidayAllowance = BigDecimal.ZERO;
        BigDecimal hours = BigDecimal.ZERO;
        Set<UUID> employees = new HashSet<>();

        for (Payslip p : payslips) {
            gross = gross.add(nz(p.getTotalGrossAmount()));
            net = net.add(nz(p.getTotalNetAmount()));
            loonheffing = loonheffing.add(nz(p.getWageTaxWithheldTest()));
            deductions = deductions.add(nz(p.getTotalEmployeeDeductions()));
            employeeZvw = employeeZvw.add(nz(p.getEmployeeZvwWithheld()));
            employerZvw = employerZvw.add(nz(p.getEmployerZvwLevy()));
            premiums = premiums.add(nz(p.getEmployerInsurancePremiums()));
            pension = pension.add(sumPensionLines(p));
            holidayAllowance = holidayAllowance.add(holidayAllowanceFor(p));
            hours = hours.add(nz(p.getTotalHoursWorked()));
            if (p.getUserId() != null) employees.add(p.getUserId());
        }

        FinanceOverviewDTO dto = new FinanceOverviewDTO();
        dto.setFrom(from.toString());
        dto.setTo(to.toString());
        dto.setTotalGross(money(gross));
        dto.setTotalNet(money(net));
        dto.setTotalLoonheffing(money(loonheffing));
        dto.setTotalEmployeeDeductions(money(deductions));
        dto.setTotalEmployeeZvw(money(employeeZvw));
        dto.setTotalEmployerZvw(money(employerZvw));
        dto.setTotalEmployerInsurancePremiums(money(premiums));
        dto.setTotalPensionEmployee(money(pension));
        dto.setTotalHolidayAllowance(money(holidayAllowance));
        dto.setTotalToBelastingdienst(money(loonheffing.add(employeeZvw).add(employerZvw).add(premiums)));
        dto.setTotalEmployerCost(money(gross.add(holidayAllowance).add(employerZvw).add(premiums)));
        dto.setTotalHours(money(hours));
        dto.setPayslipCount(payslips.size());
        dto.setEmployeeCount(employees.size());
        return dto;
    }

    public List<FinanceBreakdownRowDTO> breakdown(UUID companyId, LocalDate from, LocalDate to, String dimension) {
        List<Payslip> payslips = load(companyId, from, to);
        String dim = dimension == null ? "EMPLOYEE" : dimension.trim().toUpperCase(Locale.ROOT);

        Map<String, FinanceBreakdownRowDTO> rows = new LinkedHashMap<>();
        for (Payslip p : payslips) {
            String key = keyFor(p, dim);
            String label = labelFor(p, dim);
            FinanceBreakdownRowDTO row = rows.get(key);
            if (row == null) {
                row = new FinanceBreakdownRowDTO();
                row.setGroupId(key);
                row.setLabel(label);
                row.setGross(BigDecimal.ZERO);
                row.setNet(BigDecimal.ZERO);
                row.setLoonheffing(BigDecimal.ZERO);
                row.setEmployerCost(BigDecimal.ZERO);
                row.setHours(BigDecimal.ZERO);
                rows.put(key, row);
            }
            row.setGross(row.getGross().add(nz(p.getTotalGrossAmount())));
            row.setNet(row.getNet().add(nz(p.getTotalNetAmount())));
            row.setLoonheffing(row.getLoonheffing().add(nz(p.getWageTaxWithheldTest())));
            row.setEmployerCost(row.getEmployerCost()
                    .add(nz(p.getTotalGrossAmount())).add(holidayAllowanceFor(p))
                    .add(nz(p.getEmployerZvwLevy())).add(nz(p.getEmployerInsurancePremiums())));
            row.setHours(row.getHours().add(nz(p.getTotalHoursWorked())));
            row.setPayslipCount(row.getPayslipCount() + 1);
        }

        List<FinanceBreakdownRowDTO> result = new ArrayList<>(rows.values());
        for (FinanceBreakdownRowDTO row : result) {
            row.setGross(money(row.getGross()));
            row.setNet(money(row.getNet()));
            row.setLoonheffing(money(row.getLoonheffing()));
            row.setEmployerCost(money(row.getEmployerCost()));
            row.setHours(money(row.getHours()));
        }
        if ("MONTH".equals(dim)) {
            result.sort(Comparator.comparing(FinanceBreakdownRowDTO::getGroupId));
        } else {
            result.sort(Comparator.comparing(r -> r.getLabel() == null ? "" : r.getLabel().toLowerCase(Locale.ROOT)));
        }
        return result;
    }

    private List<Payslip> load(UUID companyId, LocalDate from, LocalDate to) {
        if (companyId == null) {
            throw new IllegalArgumentException("companyId is required for finance figures");
        }
        List<Payslip> raw = payslipRepository.findByCompanyIdAndDateOfIssueBetweenOrderByDateOfIssueAsc(companyId, from, to);
        List<Payslip> result = new ArrayList<>();
        for (Payslip p : raw) {
            PayslipStatus status = p.getStatus() == null ? PayslipStatus.RELEASED : p.getStatus();
            if (VISIBLE_STATUSES.contains(status)) {
                result.add(p);
            }
        }
        return result;
    }

    private String keyFor(Payslip p, String dim) {
        switch (dim) {
            case "FUNCTION":
                return p.getFunctionName() == null || p.getFunctionName().isBlank() ? "—" : p.getFunctionName();
            case "MONTH":
                LocalDate d = p.getDateOfIssue();
                return d == null ? "—" : String.format(Locale.ROOT, "%04d-%02d", d.getYear(), d.getMonthValue());
            default: // EMPLOYEE
                return p.getUserId() == null ? "—" : p.getUserId().toString();
        }
    }

    private String labelFor(Payslip p, String dim) {
        switch (dim) {
            case "FUNCTION":
                return p.getFunctionName() == null || p.getFunctionName().isBlank() ? "Unknown function" : p.getFunctionName();
            case "MONTH":
                return keyFor(p, dim);
            default: // EMPLOYEE
                return p.getName() == null || p.getName().isBlank()
                        ? (p.getUserId() == null ? "Unknown" : p.getUserId().toString())
                        : p.getName();
        }
    }

    private BigDecimal sumPensionLines(Payslip payslip) {
        BigDecimal total = BigDecimal.ZERO;
        for (PayrollDeductionLineDTO line : PayslipDeductionCodec.read(payslip.getDeductionLinesJson())) {
            if ("PENSION".equalsIgnoreCase(line.getCategory())) {
                total = total.add(nz(line.getCalculatedAmount()));
            }
        }
        return total;
    }

    /**
     * Reserved holiday allowance (vakantietoeslag) for a payslip: gross x holiday %.
     * Holiday pay is not part of the payslip gross (gross = hours x rate), so it is a
     * real additional employer cost. Employer pension is not tracked on the payslip,
     * so it is not (yet) included in the ACTUAL employer cost.
     */
    private static BigDecimal holidayAllowanceFor(Payslip p) {
        BigDecimal gross = nz(p.getTotalGrossAmount());
        BigDecimal pct = nz(p.getHolidayAllowancePercentage());
        if (gross.signum() == 0 || pct.signum() == 0) {
            return BigDecimal.ZERO;
        }
        return money(gross.multiply(pct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
    }

    private static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
