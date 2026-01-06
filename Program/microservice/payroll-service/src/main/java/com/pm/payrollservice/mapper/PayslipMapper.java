package com.pm.payrollservice.mapper;

import com.pm.payrollservice.dto.PayslipRequestDTO;
import com.pm.payrollservice.dto.PayslipResponseDTO;
import com.pm.payrollservice.model.Payslip;
import com.pm.payrollservice.model.PayslipStatus;
import contract.ContractDataResponse;
import timesheet.TimesheetDataResponse;
import user.UserDataResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
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
        payslipResponseDTO.setFunctionName(payslip.getFunctionName());
        payslipResponseDTO.setHourlyWage(payslip.getHourlyWage());
        payslipResponseDTO.setTotalHoursWorked(payslip.getTotalHoursWorked());
        payslipResponseDTO.setTotalGrossAmount(payslip.getTotalGrossAmount());
        payslipResponseDTO.setWageTaxWithheldTest(payslip.getWageTaxWithheldTest()); // TODO tax withheld is just a test
        payslipResponseDTO.setTravelExpenses(payslip.getTravelExpenses());
        payslipResponseDTO.setTotalNetAmount(payslip.getTotalNetAmount());
        payslipResponseDTO.setStatus(payslip.getStatus() != null ? payslip.getStatus().name() : PayslipStatus.RELEASED.name());
        payslipResponseDTO.setAvailableToUserAt(payslip.getAvailableToUserAt() != null ? payslip.getAvailableToUserAt().toString() : null);
        payslipResponseDTO.setGeneratedAt(payslip.getGeneratedAt() != null ? payslip.getGeneratedAt().toString() : null);
        payslipResponseDTO.setErrorDescription(payslip.getErrorDescription());

        // Personal Details
        payslipResponseDTO.setUserId(payslip.getUserId().toString());
        payslipResponseDTO.setName(payslip.getName());
        payslipResponseDTO.setDateOfBirth(payslip.getDateOfBirth() != null ? payslip.getDateOfBirth().toString() : null);
        payslipResponseDTO.setStartDate(payslip.getStartDate() != null ? payslip.getStartDate().toString() : null);
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
        payslip.setErrorDescription(payslipRequestDTO.getErrorDescription());

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

    public static void updateFromContractDataAndTimesheetData(
            Payslip payslip,
            ContractDataResponse contractData,
            TimesheetDataResponse timesheetData
    ) {
        payslip.setStartDate(LocalDate.parse(contractData.getStartDate()));
        payslip.setWageTaxWithheldTest(BigDecimal.ZERO);

        payslip.setFunctionName(contractTypeDisplayName(contractData.getContractType()));
        payslip.setHourlyWage(new BigDecimal(contractData.getGrossHourlyWage()));

        BigDecimal totalHoursWorked = BigDecimal.ZERO;
        BigDecimal travelExpenses = BigDecimal.ZERO;
        if (timesheetData != null) {
            for (var ts : timesheetData.getTimesheetsList()) {
                totalHoursWorked = totalHoursWorked.add(new BigDecimal(ts.getHoursWorked()));
                travelExpenses = travelExpenses.add(new BigDecimal(ts.getTravelExpenses()));
            }
        }
        payslip.setTotalHoursWorked(totalHoursWorked);
        payslip.setTravelExpenses(travelExpenses);
    }

    private static String contractTypeDisplayName(String contractType) {
        if (contractType == null || contractType.isBlank()) return "";
        String lower = contractType.trim().toLowerCase();
        String[] parts = lower.split("_+");
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (p.isBlank()) continue;
            if (sb.length() > 0) sb.append(' ');
            sb.append(Character.toUpperCase(p.charAt(0))).append(p.substring(1));
        }
        return sb.toString();
    }
}
