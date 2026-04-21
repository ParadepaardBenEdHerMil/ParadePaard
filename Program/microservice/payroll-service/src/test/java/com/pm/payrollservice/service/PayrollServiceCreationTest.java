package com.pm.payrollservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pm.payrollservice.grpc.ContractServiceGrpcClient;
import com.pm.payrollservice.grpc.TimesheetServiceGrpcClient;
import com.pm.payrollservice.grpc.UserServiceGrpcClient;
import com.pm.payrollservice.model.Payslip;
import com.pm.payrollservice.repository.PayslipRepository;
import com.pm.payrollservice.validation.PayslipValidator;
import io.grpc.Status;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PayrollServiceCreationTest {

    @Test
    void createScheduledPayslipKeepsCreatingWhenContractDataIsMissing() {
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
                new ObjectMapper()
        );

        UUID userId = UUID.randomUUID();
        doNothing().when(duplicateValidator).validateNoDuplicate(userId, LocalDate.parse("2026-04-13"));
        when(userServiceGrpcClient.requestUserData(userId.toString()))
                .thenReturn(user.UserDataResponse.newBuilder()
                        .setName("Test User")
                        .setDateOfBirth("1990-01-01")
                        .setStreetName("Street")
                        .setHouseNumber("1")
                        .setPostalCode("1000 AA")
                        .setCity("Amsterdam")
                        .setCountry("Netherlands")
                        .build());
        when(contractServiceGrpcClient.requestContractData(userId.toString()))
                .thenThrow(Status.NOT_FOUND.asRuntimeException());
        when(timesheetServiceGrpcClient.requestTimesheetData(userId.toString(), 16, 2026))
                .thenReturn(timesheet.TimesheetDataResponse.newBuilder()
                        .addTimesheets(timesheet.Timesheet.newBuilder()
                                .setTimesheetId(UUID.randomUUID().toString())
                                .setDateOfIssue("2026-04-13")
                                .setFunctionName("Test")
                                .setHoursWorked("2.20")
                                .setTravelExpenses("0.00")
                                .build())
                        .build());
        when(payslipRepository.save(any(Payslip.class)))
                .thenAnswer(invocation -> {
                    Payslip saved = invocation.getArgument(0);
                    saved.setPayslipId(UUID.randomUUID());
                    return saved;
                });

        var dto = payrollService.createScheduledPayslip(
                userId,
                LocalDate.parse("2026-04-13"),
                LocalDate.parse("2026-04-13")
        );

        assertNotNull(dto.getPayslipId());
        assertEquals("NEEDS_ATTENTION", dto.getStatus());
        assertEquals("2.20", dto.getTotalHoursWorked().toPlainString());
        assertTrue(dto.getErrorDescription().contains("Missing contract data"));
    }

    @Test
    void createScheduledPayslipAcceptsBlankDateOfBirthFromUserData() {
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
                new ObjectMapper()
        );

        UUID userId = UUID.randomUUID();
        doNothing().when(duplicateValidator).validateNoDuplicate(userId, LocalDate.parse("2026-04-13"));
        when(userServiceGrpcClient.requestUserData(userId.toString()))
                .thenReturn(user.UserDataResponse.newBuilder()
                        .setName("Test User")
                        .setDateOfBirth("")
                        .setStreetName("Street")
                        .setHouseNumber("1")
                        .setPostalCode("1000 AA")
                        .setCity("Amsterdam")
                        .setCountry("Netherlands")
                        .build());
        when(contractServiceGrpcClient.requestContractData(userId.toString()))
                .thenReturn(contract.ContractDataResponse.newBuilder()
                        .setStartDate("2025-01-01")
                        .setEndDate("2026-12-31")
                        .setContractType("ON_CALL_BAR")
                        .setGrossHourlyWage("20.00")
                        .setTravelAllowance(true)
                        .build());
        when(timesheetServiceGrpcClient.requestTimesheetData(userId.toString(), 16, 2026))
                .thenReturn(timesheet.TimesheetDataResponse.newBuilder()
                        .addTimesheets(timesheet.Timesheet.newBuilder()
                                .setTimesheetId(UUID.randomUUID().toString())
                                .setDateOfIssue("2026-04-13")
                                .setFunctionName("Test")
                                .setHoursWorked("2.20")
                                .setTravelExpenses("0.00")
                                .build())
                        .build());
        when(payslipRepository.save(any(Payslip.class)))
                .thenAnswer(invocation -> {
                    Payslip saved = invocation.getArgument(0);
                    saved.setPayslipId(UUID.randomUUID());
                    return saved;
                });

        var dto = payrollService.createScheduledPayslip(
                userId,
                LocalDate.parse("2026-04-13"),
                LocalDate.parse("2026-04-13")
        );

        assertNotNull(dto.getPayslipId());
        assertEquals("PENDING_REVIEW", dto.getStatus());
        assertEquals("2.20", dto.getTotalHoursWorked().toPlainString());
    }
}
