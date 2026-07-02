package com.pm.payrollservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pm.payrollservice.grpc.ContractServiceGrpcClient;
import com.pm.payrollservice.grpc.TimesheetServiceGrpcClient;
import com.pm.payrollservice.grpc.UserServiceGrpcClient;
import com.pm.payrollservice.model.Payslip;
import com.pm.payrollservice.repository.PayslipRepository;
import com.pm.payrollservice.validation.PayslipValidator;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PayrollZeroHourRuleTest {

    @Test
    void skipsZeroPayOnCallPeriod() {
        PayslipRepository payslipRepository = mock(PayslipRepository.class);
        PayslipValidator duplicateValidator = mock(PayslipValidator.class);
        UserServiceGrpcClient userServiceGrpcClient = mock(UserServiceGrpcClient.class);
        ContractServiceGrpcClient contractServiceGrpcClient = mock(ContractServiceGrpcClient.class);
        TimesheetServiceGrpcClient timesheetServiceGrpcClient = mock(TimesheetServiceGrpcClient.class);
        CompanySettingsClient companySettingsClient = mock(CompanySettingsClient.class);
        PayslipPdfService payslipPdfService = mock(PayslipPdfService.class);

        PayrollService payrollService = new PayrollService(
                payslipRepository,
                duplicateValidator,
                userServiceGrpcClient,
                contractServiceGrpcClient,
                timesheetServiceGrpcClient,
                companySettingsClient,
                payslipPdfService,
                new ObjectMapper(),
                new PayPeriodCalculator()
        );

        UUID userId = UUID.randomUUID();
        when(contractServiceGrpcClient.requestContractData(eq(userId.toString()), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(contract.ContractDataResponse.newBuilder()
                        .setStartDate("2026-01-01")
                        .setEndDate("")
                        .setContractType("ON_CALL_BAR")
                        .setGrossHourlyWage("18.50")
                        .setTravelAllowance(true)
                        .setFunctionName("Bar")
                        .setPaymentFrequency("WEEKLY")
                        .build());
        when(userServiceGrpcClient.requestUserData(userId.toString()))
                .thenReturn(user.UserDataResponse.newBuilder()
                        .setName("Test User")
                        .setDateOfBirth("")
                        .build());
        when(timesheetServiceGrpcClient.requestTimesheetData(userId.toString(), 20, 2026))
                .thenReturn(timesheet.TimesheetDataResponse.newBuilder().build());
        when(payslipRepository.findByUserIdAndPayPeriodKey(userId, "WEEKLY:2026-W20"))
                .thenReturn(Optional.empty());

        var result = payrollService.syncContractOwnedScheduledPayslip(
                userId,
                LocalDate.of(2026, 5, 12),
                LocalDate.of(2026, 5, 18)
        );

        assertNull(result);
        verify(payslipRepository, never()).save(any(Payslip.class));
    }

    @Test
    void createsFourWeeklyPayslipOncePeriodEnds() {
        PayslipRepository payslipRepository = mock(PayslipRepository.class);
        PayslipValidator duplicateValidator = mock(PayslipValidator.class);
        UserServiceGrpcClient userServiceGrpcClient = mock(UserServiceGrpcClient.class);
        ContractServiceGrpcClient contractServiceGrpcClient = mock(ContractServiceGrpcClient.class);
        TimesheetServiceGrpcClient timesheetServiceGrpcClient = mock(TimesheetServiceGrpcClient.class);
        CompanySettingsClient companySettingsClient = mock(CompanySettingsClient.class);
        PayslipPdfService payslipPdfService = mock(PayslipPdfService.class);

        PayrollService payrollService = new PayrollService(
                payslipRepository,
                duplicateValidator,
                userServiceGrpcClient,
                contractServiceGrpcClient,
                timesheetServiceGrpcClient,
                companySettingsClient,
                payslipPdfService,
                new ObjectMapper(),
                new PayPeriodCalculator()
        );

        UUID userId = UUID.randomUUID();
        when(contractServiceGrpcClient.requestContractData(eq(userId.toString()), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(contract.ContractDataResponse.newBuilder()
                        .setStartDate("2026-01-01")
                        .setEndDate("")
                        .setContractType("FIXED_HOURS")
                        .setGrossHourlyWage("18.50")
                        .setTravelAllowance(true)
                        .setFunctionName("Bar")
                        .setPaymentFrequency("FOUR_WEEKLY")
                        .build());
        when(userServiceGrpcClient.requestUserData(userId.toString()))
                .thenReturn(user.UserDataResponse.newBuilder()
                        .setName("Test User")
                        .setDateOfBirth("")
                        .build());
        when(timesheetServiceGrpcClient.requestTimesheetData(userId.toString(), 5, 2026))
                .thenReturn(timesheet.TimesheetDataResponse.newBuilder()
                        .addTimesheets(timesheet.Timesheet.newBuilder()
                                .setTimesheetId(UUID.randomUUID().toString())
                                .setDateOfIssue("2026-02-01")
                                .setFunctionName("Bar")
                                .setHoursWorked("8.00")
                                .setTravelExpenses("0.00")
                                .build())
                        .build());
        when(payslipRepository.findByUserIdAndPayPeriodKey(userId, "FOUR_WEEKLY:2026-P01"))
                .thenReturn(Optional.empty());
        when(payslipRepository.save(any(Payslip.class)))
                .thenAnswer(invocation -> {
                    Payslip saved = invocation.getArgument(0);
                    saved.setPayslipId(UUID.randomUUID());
                    return saved;
                });

        var result = payrollService.syncContractOwnedScheduledPayslip(
                userId,
                LocalDate.of(2026, 1, 20),
                LocalDate.of(2026, 2, 2)
        );

        assertEquals("FOUR_WEEKLY:2026-P01", result.getPayPeriodKey());
        assertEquals("2026-01-05", result.getPayPeriodStart());
        assertEquals("2026-02-01", result.getPayPeriodEnd());
    }
}
