package com.pm.payrollservice.mapper;

import com.pm.payrollservice.dto.PayslipResponseDTO;
import com.pm.payrollservice.model.Payslip;

public class PayslipMapper {

    public static PayslipResponseDTO toDTO(Payslip payslip) {
        PayslipResponseDTO dto = new PayslipResponseDTO();

        dto.setPayslipId(payslip.getPayslipId() != null ? payslip.getPayslipId().toString() : null);
        dto.setUserId(payslip.getUserId() != null ? payslip.getUserId().toString() : null);
        dto.setName(payslip.getName());
        dto.setAddress(payslip.getAddress());
        dto.setHoursWorked(payslip.getHoursWorked() != null ? payslip.getHoursWorked().toString() : null);
        dto.setHourlyWage(payslip.getHourlyWage() != null ? payslip.getHourlyWage().toString() : null);
        dto.setTotalGrossAmount(payslip.getTotalGrossAmount() != null ? payslip.getTotalGrossAmount().toPlainString() : null);
        dto.setWageTaxWithheldTest(payslip.getWageTaxWithheldTest() != null ? payslip.getWageTaxWithheldTest().toPlainString() : null);
        dto.setTotalNetAmount(payslip.getTotalNetAmount() != null ? payslip.getTotalNetAmount().toPlainString() : null);

        return dto;
    }
}