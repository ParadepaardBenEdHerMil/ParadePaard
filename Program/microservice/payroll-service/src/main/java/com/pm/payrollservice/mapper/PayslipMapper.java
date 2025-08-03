package com.pm.payrollservice.mapper;

import com.pm.payrollservice.dto.PayslipRequestDTO;
import com.pm.payrollservice.dto.PayslipResponseDTO;
import com.pm.payrollservice.model.Payslip;
import user.UserDataResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Predicate;

public class PayslipMapper {

    public static PayslipResponseDTO toDTO(Payslip payslip) {
        PayslipResponseDTO dto = new PayslipResponseDTO();
        dto.setPayslipId(payslip.getPayslipId().toString());

        // Date
        dto.setDateOfIssue(payslip.getDateOfIssue().toString());
        dto.setWeekNumber(payslip.getWeekNumber());
        dto.setWeekBasedYear(payslip.getWeekBasedYear());

        // Payslip Details
        dto.setHoursWorked(payslip.getHoursWorked());
        dto.setHourlyWage(payslip.getHourlyWage());
        dto.setTotalGrossAmount(payslip.getTotalGrossAmount());
        dto.setWageTaxWithheldTest(payslip.getWageTaxWithheldTest()); // TODO tax withheld is just a test
        dto.setTotalNetAmount(payslip.getTotalNetAmount());

        // Personal Details
        dto.setUserId(payslip.getUserId().toString());
        dto.setName(payslip.getName());
        dto.getDateOfBirth(payslip.getDateOfBirth());
        dto.setStreetName(payslip.getStreetName());
        dto.setHouseNumber(payslip.getHouseNumber());
        dto.setHouseNumberSuffix(payslip.getHouseNumberSuffix());
        dto.setPostalCode(payslip.getPostalCode());
        dto.setCity(payslip.getCity());
        dto.setCountry(payslip.getCountry());
        return dto;
    }

    public static Payslip toModel(PayslipRequestDTO dto) {
        Payslip payslip = new Payslip();

        payslip.setUserId(UUID.fromString(dto.getUserId()));
        payslip.setDateOfIssue(LocalDate.parse(dto.getDateOfIssue()));
        payslip.setHoursWorked(dto.getHoursWorked());
        payslip.setHourlyWage(dto.getHourlyWage());

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



}