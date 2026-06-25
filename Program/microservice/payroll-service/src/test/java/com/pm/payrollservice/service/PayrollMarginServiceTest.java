package com.pm.payrollservice.service;

import com.pm.payrollservice.dto.PlanningResolvedRateDTO;
import com.pm.payrollservice.dto.ShiftFinanceRowDTO;
import com.pm.payrollservice.grpc.ContractServiceGrpcClient;
import com.pm.payrollservice.grpc.TimesheetServiceGrpcClient;
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
import static org.mockito.ArgumentMatchers.anyString;
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
        TimesheetServiceGrpcClient timesheetClient = mock(TimesheetServiceGrpcClient.class);
        ContractServiceGrpcClient contractClient = mock(ContractServiceGrpcClient.class);
        PlanningBillingRateClient planningClient = mock(PlanningBillingRateClient.class);

        when(timesheetClient.requestCompanyTimesheets(eq(companyId.toString()), eq(from.toString()), eq(to.toString())))
                .thenReturn(CompanyTimesheetsResponse.newBuilder().addTimesheets(shift("10")).build());
        when(contractClient.requestContractData(userId.toString())).thenReturn(contract());
        when(planningClient.resolveRates(any(), anyList())).thenReturn(List.of(resolved));
        return new PayrollMarginService(timesheetClient, contractClient, planningClient);
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

        BigDecimal gross = new BigDecimal("200.00");                 // 10h * 20.00
        BigDecimal holiday = new BigDecimal("16.66");                // 200 * 8.33%
        BigDecimal zvw = money(LoonheffingCalculator.periodEmployerZvw(gross, 52, RATES));
        BigDecimal premies = money(LoonheffingCalculator.periodEmployerInsurancePremiums(gross, 52, RATES));
        BigDecimal expectedCost = money(gross.add(holiday).add(zvw).add(premies));
        BigDecimal expectedRevenue = new BigDecimal("350.00");        // 10h * 35.00
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
        // cost is still computed from the contract wage
        assertEquals(0, new BigDecimal("200.00").compareTo(row.getGrossWage()));
    }

    private static BigDecimal money(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }
}
