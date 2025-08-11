package com.pm.payrollservice.mapper;

import com.pm.payrollservice.dto.PayslipRequestDTO;
import com.pm.payrollservice.dto.PayslipResponseDTO;
import com.pm.payrollservice.model.Payslip;
import com.pm.payrollservice.model.PayslipFunction;
import com.pm.payrollservice.model.PayslipTimesheet;
import contract.ContractDataResponse;
import timesheet.TimesheetDataResponse;
import user.UserDataResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class PayslipMapper {

    public static PayslipResponseDTO toDTO(Payslip payslip) {
        PayslipResponseDTO payslipResponseDTO = new PayslipResponseDTO();
        payslipResponseDTO.setPayslipId(payslip.getPayslipId().toString());

        // Date
        payslipResponseDTO.setDateOfIssue(payslip.getDateOfIssue().toString());
        payslipResponseDTO.setWeekNumber(payslip.getWeekNumber());
        payslipResponseDTO.setWeekBasedYear(payslip.getWeekBasedYear());

        // Payslip Details
        payslipResponseDTO.setFunctions(payslip.getFunctions());
        payslipResponseDTO.setTimesheet(payslip.getTimesheets());
        payslipResponseDTO.setTotalGrossAmount(payslip.getTotalGrossAmount());
        payslipResponseDTO.setWageTaxWithheldTest(payslip.getWageTaxWithheldTest()); // TODO tax withheld is just a test
        payslipResponseDTO.setTotalNetAmount(payslip.getTotalNetAmount());

        // Personal Details
        payslipResponseDTO.setUserId(payslip.getUserId().toString());
        payslipResponseDTO.setName(payslip.getName());
        payslipResponseDTO.setDateOfBirth(payslip.getDateOfBirth().toString());
        payslipResponseDTO.setStartDate(payslip.getStartDate().toString());
        payslipResponseDTO.setStreetName(payslip.getStreetName());
        payslipResponseDTO.setHouseNumber(payslip.getHouseNumber());
        payslipResponseDTO.setHouseNumberSuffix(payslip.getHouseNumberSuffix());
        payslipResponseDTO.setPostalCode(payslip.getPostalCode());
        payslipResponseDTO.setCity(payslip.getCity());
        payslipResponseDTO.setCountry(payslip.getCountry());

        return payslipResponseDTO;
    }

    public static Payslip toModel(PayslipRequestDTO payslipRequestDTO) {
        Payslip payslip = new Payslip();

        payslip.setUserId(UUID.fromString(payslipRequestDTO.getUserId()));
        payslip.setDateOfIssue(LocalDate.parse(payslipRequestDTO.getDateOfIssue()));

        return payslip;
    }

    public static void updateFromUserData(Payslip payslip, UserDataResponse userData) {
        payslip.setName(userData.getName());
        payslip.setDateOfBirth(LocalDate.parse(userData.getDateOfBirth()));
        payslip.setStreetName(userData.getStreetName());
        payslip.setHouseNumber(userData.getHouseNumber());
        payslip.setHouseNumberSuffix(userData.getHouseNumberSuffix());
        payslip.setPostalCode(userData.getPostalCode());
        payslip.setCity(userData.getCity());
        payslip.setCountry(userData.getCountry());
    }

    public static void updateFromContractData(Payslip payslip, ContractDataResponse contractData) {
        payslip.setStartDate(LocalDate.parse(contractData.getStartDate()));
        payslip.setWageTaxWithheldTest(new BigDecimal(contractData.getWageTaxAmountTest()));

        List<PayslipFunction> items = contractData.getFunctionsList().stream()
                .map(function -> {
                    PayslipFunction payslipFunction = new PayslipFunction();
                    payslipFunction.setFunctionId(UUID.fromString(function.getFunctionId()));
                    payslipFunction.setFunctionName(function.getFunctionName());
                    payslipFunction.setHourlyWage(new BigDecimal(function.getHourlyWage()));
                    return payslipFunction;
                })
                .toList();

        payslip.setFunctions(items);
    }

    public static void updateFromTimesheetData(Payslip payslip, TimesheetDataResponse timesheetData) {
        List<PayslipTimesheet> items = timesheetData.getTimesheetsList().stream()
                .map(timesheet -> {
                    PayslipTimesheet payslipTimesheet = new PayslipTimesheet();
                    payslipTimesheet.setTimesheetId(UUID.fromString(timesheet.getTimesheetId()));
                    payslipTimesheet.setDateOfIssue(LocalDate.parse(timesheet.getDateOfIssue()));
                    payslipTimesheet.setFunction(timesheet.getFunction());
                    payslipTimesheet.setHoursWorked(new BigDecimal(timesheet.getHoursWorked()));
                    payslipTimesheet.setTravelExpenses(new BigDecimal(timesheet.getTravelExpenses()));
                    return payslipTimesheet;
                })
                .toList();
        payslip.setTimesheets(items);
    }
}