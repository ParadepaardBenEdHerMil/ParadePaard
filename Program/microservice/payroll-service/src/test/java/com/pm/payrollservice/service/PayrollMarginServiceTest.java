package com.pm.payrollservice.service;

import com.pm.payrollservice.dto.PlanningResolvedRateDTO;
import com.pm.payrollservice.dto.ShiftFinanceRowDTO;
import com.pm.payrollservice.grpc.ContractServiceGrpcClient;
import com.pm.payrollservice.grpc.TimesheetServiceGrpcClient;
import com.pm.payrollservice.model.Payslip;
import com.pm.payrollservice.model.PayslipStatus;
import com.pm.payrollservice.repository.PayslipRepository;
import com.pm.payrollservice.repository.ShiftFinanceRecordRepository;
import contract.ContractDataResponse;
import org.junit.jupiter.api.Test;
import timesheet.CompanyTimesheetsResponse;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PayrollMarginServiceTest {

    private static final DutchPayrollTaxRates RATES = DutchPayrollTaxRates.forYear(2026);

    private final UUID companyId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final LocalDate from = LocalDate.of(2026, 6, 1);
    private final LocalDate to = LocalDate.of(2026, 6, 30);

    private TimesheetServiceGrpcClient timesheetClient;
    private ContractServiceGrpcClient contractClient;
    private PlanningBillingRateClient planningClient;
    private PayslipRepository payslipRepository;
    private ShiftFinanceRecordRepository recordRepository;

    private timesheet.Timesheet shift(String hours) {
        return timesheet.Timesheet.newBuilder()
                .setTimesheetId(UUID.randomUUID().toString())
                .setUserId(userId.toString())
                .setSourceProjectId(projectId.toString())
                .setFunctionName("Bartender")
                .setHoursWorked(hours)
                .setShiftDate("2026-06-20")
                .setProjectName("ADE Weekend")
                .build();
    }

    private ContractDataResponse contract() {
        return ContractDataResponse.newBuilder()
                .setGrossHourlyWage("20.00")
                .setHolidayAllowancePercentage("8.33")
                .setPaymentFrequency("WEEKLY")
                .build();
    }

    private PayrollMarginService service(PlanningResolvedRateDTO resolved) {
        timesheetClient = mock(TimesheetServiceGrpcClient.class);
        contractClient = mock(ContractServiceGrpcClient.class);
        planningClient = mock(PlanningBillingRateClient.class);
        payslipRepository = mock(PayslipRepository.class);
        recordRepository = mock(ShiftFinanceRecordRepository.class);

        when(timesheetClient.requestCompanyTimesheets(eq(companyId.toString()), eq(from.toString()), eq(to.toString())))
                .thenReturn(CompanyTimesheetsResponse.newBuilder().addTimesheets(shift("10")).build());
        when(contractClient.requestContractData(userId.toString())).thenReturn(contract());
        when(planningClient.resolveRates(any(), anyList())).thenReturn(List.of(resolved));
        return new PayrollMarginService(timesheetClient, contractClient, planningClient, payslipRepository, recordRepository);
    }

    private static BigDecimal money(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    @Test
    void computesRevenueCostAndMarginForAResolvedShift() {
        PlanningResolvedRateDTO resolved = new PlanningResolvedRateDTO();
        resolved.setRatePerHour(new BigDecimal("35.00"));
        resolved.setSource("CLIENT");
        resolved.setClientName("Festival Breda");
        resolved.setProjectName("ADE Weekend");
        resolved.setMissing(false);

        List<ShiftFinanceRowDTO> rows = service(resolved).shifts(companyId, from, to, "user-token");
        assertEquals(1, rows.size());
        ShiftFinanceRowDTO row = rows.get(0);

        BigDecimal gross = new BigDecimal("200.00");
        BigDecimal holiday = new BigDecimal("16.66");
        BigDecimal zvw = money(LoonheffingCalculator.periodEmployerZvw(gross, 52, RATES));
        BigDecimal premies = money(LoonheffingCalculator.periodEmployerInsurancePremiums(gross, 52, RATES));
        BigDecimal expectedCost = money(gross.add(holiday).add(zvw).add(premies));
        BigDecimal expectedRevenue = new BigDecimal("350.00");
        BigDecimal expectedMargin = money(expectedRevenue.subtract(expectedCost));

        assertEquals(0, gross.compareTo(row.getGrossWage()));
        assertEquals(0, holiday.compareTo(row.getHolidayAllowance()));
        assertEquals(0, expectedCost.compareTo(row.getTotalEmployerCost()));
        assertEquals(0, expectedRevenue.compareTo(row.getClientRevenue()));
        assertEquals(0, expectedMargin.compareTo(row.getMargin()));
        assertEquals("CLIENT", row.getRateSource());
        assertEquals("healthy", row.getMarginStatus());
        assertEquals("ESTIMATED", row.getTag());
    }

    @Test
    void missingRateYieldsZeroRevenueAndMissingStatus() {
        PlanningResolvedRateDTO resolved = new PlanningResolvedRateDTO();
        resolved.setRatePerHour(null);
        resolved.setSource("MISSING");
        resolved.setMissing(true);

        List<ShiftFinanceRowDTO> rows = service(resolved).shifts(companyId, from, to, "user-token");
        ShiftFinanceRowDTO row = rows.get(0);

        assertEquals(0, new BigDecimal("0.00").compareTo(row.getClientRevenue()));
        assertEquals(0, new BigDecimal("0.00").compareTo(row.getMargin()));
        assertNull(row.getRatePerHour());
        assertEquals("missing_rate", row.getMarginStatus());
        assertEquals(0, new BigDecimal("200.00").compareTo(row.getGrossWage()));
    }

    @Test
    void flipsToActualWhenAReleasedPayslipCoversThePeriodAndReconcilesToIt() {
        PlanningResolvedRateDTO resolved = new PlanningResolvedRateDTO();
        resolved.setRatePerHour(new BigDecimal("35.00"));
        resolved.setSource("CLIENT");
        resolved.setMissing(false);

        PayrollMarginService svc = service(resolved);

        Payslip payslip = new Payslip();
        payslip.setPayslipId(UUID.randomUUID());
        payslip.setUserId(userId);
        payslip.setCompanyId(companyId);
        payslip.setStatus(PayslipStatus.RELEASED);
        payslip.setPayPeriodStart(LocalDate.of(2026, 6, 1));
        payslip.setPayPeriodEnd(LocalDate.of(2026, 6, 30));
        payslip.setTotalGrossAmount(new BigDecimal("180.00"));
        payslip.setHolidayAllowancePercentage(BigDecimal.ZERO);
        payslip.setEmployerZvwLevy(new BigDecimal("12.00"));
        payslip.setEmployerInsurancePremiums(new BigDecimal("20.00"));
        when(payslipRepository.findByUserIdOrderByDateOfIssueDesc(userId)).thenReturn(List.of(payslip));

        List<ShiftFinanceRowDTO> rows = svc.shifts(companyId, from, to, "user-token");
        ShiftFinanceRowDTO row = rows.get(0);

        // Single shift in the period -> it absorbs the whole payslip employer cost.
        BigDecimal expectedCost = new BigDecimal("212.00"); // 180 + 0 holiday + 12 + 20
        BigDecimal expectedMargin = new BigDecimal("350.00").subtract(expectedCost);
        assertEquals("ACTUAL", row.getTag());
        assertEquals(0, expectedCost.compareTo(row.getTotalEmployerCost()));
        assertEquals(0, expectedMargin.compareTo(row.getMargin()));
    }

    private PayrollMarginService serviceWith(List<timesheet.Timesheet> shifts,
                                             List<PlanningResolvedRateDTO> resolved,
                                             List<Payslip> userPayslips) {
        timesheetClient = mock(TimesheetServiceGrpcClient.class);
        contractClient = mock(ContractServiceGrpcClient.class);
        planningClient = mock(PlanningBillingRateClient.class);
        payslipRepository = mock(PayslipRepository.class);
        recordRepository = mock(ShiftFinanceRecordRepository.class);

        CompanyTimesheetsResponse.Builder resp = CompanyTimesheetsResponse.newBuilder();
        for (timesheet.Timesheet ts : shifts) {
            resp.addTimesheets(ts);
        }
        when(timesheetClient.requestCompanyTimesheets(eq(companyId.toString()), eq(from.toString()), eq(to.toString())))
                .thenReturn(resp.build());
        when(contractClient.requestContractData(userId.toString())).thenReturn(contract());
        when(planningClient.resolveRates(any(), anyList())).thenReturn(resolved);
        when(payslipRepository.findByUserIdOrderByDateOfIssueDesc(userId)).thenReturn(userPayslips);
        return new PayrollMarginService(timesheetClient, contractClient, planningClient, payslipRepository, recordRepository);
    }

    private static PlanningResolvedRateDTO rate(String ratePerHour) {
        PlanningResolvedRateDTO dto = new PlanningResolvedRateDTO();
        if (ratePerHour != null) {
            dto.setRatePerHour(new BigDecimal(ratePerHour));
        }
        dto.setSource(ratePerHour == null ? "MISSING" : "CLIENT");
        dto.setMissing(ratePerHour == null);
        return dto;
    }

    private static BigDecimal sumCost(List<ShiftFinanceRowDTO> rows) {
        return rows.stream().map(ShiftFinanceRowDTO::getTotalEmployerCost).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal sumRevenue(List<ShiftFinanceRowDTO> rows) {
        return rows.stream().map(ShiftFinanceRowDTO::getClientRevenue).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Test
    void overviewBreakdownAndShiftRowsReconcile() {
        List<timesheet.Timesheet> shifts = List.of(shift("10"), shift("5"), shift("8"));
        List<PlanningResolvedRateDTO> resolved = List.of(rate("35.00"), rate("30.00"), rate(null));
        PayrollMarginService svc = serviceWith(shifts, resolved, List.of());

        List<ShiftFinanceRowDTO> rows = svc.shifts(companyId, from, to, "t");
        var overview = svc.overview(companyId, from, to, "t");
        var breakdown = svc.breakdown(companyId, from, to, "CLIENT", "t");

        BigDecimal brRevenue = breakdown.stream().map(b -> b.getRevenue()).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal brCost = breakdown.stream().map(b -> b.getEmployerCost()).reduce(BigDecimal.ZERO, BigDecimal::add);

        // shift rows == overview == breakdown, for both revenue and cost
        assertEquals(0, money(sumRevenue(rows)).compareTo(overview.getTotalRevenue()));
        assertEquals(0, money(sumCost(rows)).compareTo(overview.getTotalEmployerCost()));
        assertEquals(0, overview.getTotalRevenue().compareTo(money(brRevenue)));
        assertEquals(0, overview.getTotalEmployerCost().compareTo(money(brCost)));
        assertEquals(3, overview.getShiftCount());
        assertEquals(1, overview.getMissingRateCount());
    }

    @Test
    void actualAllocationAcrossMultipleShiftsReconcilesToThePayslip() {
        List<timesheet.Timesheet> shifts = List.of(shift("10"), shift("6"));
        List<PlanningResolvedRateDTO> resolved = List.of(rate("35.00"), rate("35.00"));

        Payslip payslip = new Payslip();
        payslip.setPayslipId(UUID.randomUUID());
        payslip.setUserId(userId);
        payslip.setCompanyId(companyId);
        payslip.setStatus(PayslipStatus.RELEASED);
        payslip.setPayPeriodStart(LocalDate.of(2026, 6, 1));
        payslip.setPayPeriodEnd(LocalDate.of(2026, 6, 30));
        payslip.setTotalGrossAmount(new BigDecimal("320.00"));
        payslip.setHolidayAllowancePercentage(BigDecimal.ZERO);
        payslip.setEmployerZvwLevy(new BigDecimal("20.00"));
        payslip.setEmployerInsurancePremiums(new BigDecimal("36.00"));

        PayrollMarginService svc = serviceWith(shifts, resolved, List.of(payslip));
        List<ShiftFinanceRowDTO> rows = svc.shifts(companyId, from, to, "t");

        BigDecimal expectedCost = new BigDecimal("376.00"); // 320 + 0 holiday + 20 + 36
        assertEquals(0, expectedCost.compareTo(sumCost(rows)));
        rows.forEach(r -> assertEquals("ACTUAL", r.getTag()));
    }
}
