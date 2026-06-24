package com.pm.payrollservice.mapper;

import com.pm.payrollservice.dto.PayslipRequestDTO;
import com.pm.payrollservice.dto.PayslipResponseDTO;
import com.pm.payrollservice.dto.PayslipDeductionCodec;
import com.pm.payrollservice.model.Payslip;
import com.pm.payrollservice.model.PayslipStatus;
import contract.ContractDataResponse;
import timesheet.TimesheetDataResponse;
import user.UserDataResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class PayslipMapper {

    public static PayslipResponseDTO toDTO(Payslip payslip) {
        if (payslip == null) {
            return null;
        }

        PayslipResponseDTO payslipResponseDTO = new PayslipResponseDTO();
        List<com.pm.payrollservice.dto.PayrollDeductionLineDTO> deductionLines =
                PayslipDeductionCodec.read(payslip.getDeductionLinesJson());
        if (deductionLines.isEmpty() && payslip.getLoonheffingWithheld() != null
                && payslip.getLoonheffingWithheld().compareTo(BigDecimal.ZERO) > 0) {
            deductionLines = List.of(PayslipDeductionCodec.createLegacyLoonheffingLine(payslip.getLoonheffingWithheld()));
        }
        BigDecimal totalEmployeeDeductions = payslip.getTotalEmployeeDeductions() != null
                ? payslip.getTotalEmployeeDeductions()
                : payslip.getLoonheffingWithheld();

        payslipResponseDTO.setPayslipId(asString(payslip.getPayslipId()));

        // Date
        payslipResponseDTO.setDateOfIssue(asString(payslip.getDateOfIssue()));
        payslipResponseDTO.setWeekNumber(payslip.getWeekNumber());
        payslipResponseDTO.setWeekBasedYear(payslip.getWeekBasedYear());
        payslipResponseDTO.setPaymentDate(asString(payslip.getPaymentDate()));
        payslipResponseDTO.setFiscalYear(payslip.getFiscalYear());

        // Payslip Details
        payslipResponseDTO.setFunctionName(payslip.getFunctionName());
        payslipResponseDTO.setHourlyWage(payslip.getHourlyWage());
        payslipResponseDTO.setTotalHoursWorked(payslip.getTotalHoursWorked());
        payslipResponseDTO.setTotalGrossAmount(payslip.getTotalGrossAmount());
        payslipResponseDTO.setWageTaxWithheldTest(payslip.getLoonheffingWithheld()); // TODO tax withheld is just a test
        payslipResponseDTO.setWageTaxWithheldAmount(payslip.getLoonheffingWithheld());
        payslipResponseDTO.setTravelExpenses(payslip.getTravelExpenses());
        payslipResponseDTO.setTotalEmployeeDeductions(totalEmployeeDeductions);
        payslipResponseDTO.setTotalNetAmount(payslip.getTotalNetAmount());
        payslipResponseDTO.setDeductionLines(deductionLines);
        payslipResponseDTO.setStatus(payslip.getStatus() != null ? payslip.getStatus().name() : PayslipStatus.RELEASED.name());
        payslipResponseDTO.setAvailableToUserAt(payslip.getAvailableToUserAt() != null ? payslip.getAvailableToUserAt().toString() : null);
        payslipResponseDTO.setGeneratedAt(payslip.getGeneratedAt() != null ? payslip.getGeneratedAt().toString() : null);
        payslipResponseDTO.setErrorDescription(payslip.getErrorDescription());
        payslipResponseDTO.setContractId(asString(payslip.getContractId()));
        payslipResponseDTO.setContractType(payslip.getContractType());
        payslipResponseDTO.setPaymentFrequency(payslip.getPaymentFrequency());
        payslipResponseDTO.setContractStartDate(asString(payslip.getContractStartDate()));
        payslipResponseDTO.setContractEndDate(asString(payslip.getContractEndDate()));
        payslipResponseDTO.setWeeklyHours(payslip.getWeeklyHours());
        payslipResponseDTO.setHolidayAllowancePercentage(payslip.getHolidayAllowancePercentage());
        payslipResponseDTO.setPayPeriodKey(payslip.getPayPeriodKey());
        payslipResponseDTO.setPayPeriodStart(asString(payslip.getPayPeriodStart()));
        payslipResponseDTO.setPayPeriodEnd(asString(payslip.getPayPeriodEnd()));

        // Personal Details
        payslipResponseDTO.setUserId(asString(payslip.getUserId()));
        payslipResponseDTO.setName(payslip.getName());
        payslipResponseDTO.setDateOfBirth(asString(payslip.getDateOfBirth()));
        payslipResponseDTO.setStartDate(asString(payslip.getStartDate()));
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
        if (payslipRequestDTO.getDeductionLines() != null) {
            payslip.setDeductionLinesJson(PayslipDeductionCodec.write(payslipRequestDTO.getDeductionLines()));
        } else if (payslipRequestDTO.getWageTaxWithheldAmount() != null || payslipRequestDTO.getWageTaxWithheldTest() != null) {
            BigDecimal legacyTax = payslipRequestDTO.getWageTaxWithheldAmount() != null
                    ? payslipRequestDTO.getWageTaxWithheldAmount()
                    : payslipRequestDTO.getWageTaxWithheldTest();
            payslip.setDeductionLinesJson(PayslipDeductionCodec.write(List.of(
                    PayslipDeductionCodec.createLegacyLoonheffingLine(legacyTax)
            )));
        }
        if (payslipRequestDTO.getWageTaxWithheldTest() != null) {
            payslip.setLoonheffingWithheld(payslipRequestDTO.getWageTaxWithheldTest());
        } else if (payslipRequestDTO.getWageTaxWithheldAmount() != null) {
            payslip.setLoonheffingWithheld(payslipRequestDTO.getWageTaxWithheldAmount());
        }

        return payslip;
    }

    public static void updateFromUserData(Payslip payslip, UserDataResponse userData) {
        payslip.setName(userData.getName());
        if (userData.getDateOfBirth() != null && !userData.getDateOfBirth().isBlank()) {
            payslip.setDateOfBirth(LocalDate.parse(userData.getDateOfBirth()));
        }
        payslip.setApplyLoonheffingskorting(userData.getApplyLoonheffingskorting());
        if (userData.getBsn() != null && !userData.getBsn().isBlank()) {
            payslip.setBsn(userData.getBsn().trim());
        }
        if (userData.getCompanyId() != null && !userData.getCompanyId().isBlank()) {
            try {
                payslip.setCompanyId(UUID.fromString(userData.getCompanyId().trim()));
            } catch (IllegalArgumentException ignored) {
                // leave companyId null if the upstream value is malformed
            }
        }
        payslip.setStreetName(userData.getStreetName());
        payslip.setHouseNumber(userData.getHouseNumber());
        payslip.setHouseNumberSuffix(userData.getHouseNumberSuffix());
        payslip.setPostalCode(userData.getPostalCode());
        payslip.setCity(userData.getCity());
        payslip.setCountry(userData.getCountry());
    }

    public static void updateFromContractData(Payslip payslip, ContractDataResponse contractData) {
        if (!contractData.getContractId().isBlank()) {
            payslip.setContractId(UUID.fromString(contractData.getContractId()));
        }
        payslip.setStartDate(LocalDate.parse(contractData.getStartDate()));
        payslip.setContractStartDate(LocalDate.parse(contractData.getStartDate()));
        if (!contractData.getEndDate().isBlank()) {
            payslip.setContractEndDate(LocalDate.parse(contractData.getEndDate()));
        }
        payslip.setContractType(contractData.getContractType());
        payslip.setPaymentFrequency(contractData.getPaymentFrequency());
        // The contract is authoritative for the loonheffingskorting choice.
        payslip.setApplyLoonheffingskorting(contractData.getApplyLoonheffingskorting());
        if (!contractData.getWeeklyHours().isBlank()) {
            payslip.setWeeklyHours(new BigDecimal(contractData.getWeeklyHours()));
        }
        if (!contractData.getHolidayAllowancePercentage().isBlank()) {
            payslip.setHolidayAllowancePercentage(new BigDecimal(contractData.getHolidayAllowancePercentage()));
        }
        payslip.setLoonheffingWithheld(BigDecimal.ZERO);
        payslip.setFunctionName(
                contractData.getFunctionName() == null || contractData.getFunctionName().isBlank()
                        ? contractTypeDisplayName(contractData.getContractType())
                        : contractData.getFunctionName()
        );
        payslip.setHourlyWage(new BigDecimal(contractData.getGrossHourlyWage()));
    }

    public static void updateFromTimesheetData(Payslip payslip, TimesheetDataResponse timesheetData) {
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

    public static void updateFromContractDataAndTimesheetData(
            Payslip payslip,
            ContractDataResponse contractData,
            TimesheetDataResponse timesheetData
    ) {
        updateFromContractData(payslip, contractData);
        updateFromTimesheetData(payslip, timesheetData);
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

    private static String asString(Object value) {
        return value == null ? null : value.toString();
    }
}
