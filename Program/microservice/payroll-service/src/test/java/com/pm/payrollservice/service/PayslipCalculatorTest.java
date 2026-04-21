package com.pm.payrollservice.service;

import com.pm.payrollservice.dto.PayrollDeductionLineDTO;
import com.pm.payrollservice.dto.PayslipDeductionCodec;
import com.pm.payrollservice.model.Payslip;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PayslipCalculatorTest {

    @Test
    void calculatesFixedAndPercentageDeductionsIntoNetPay() {
        Payslip payslip = new Payslip();
        payslip.setTotalHoursWorked(new BigDecimal("10"));
        payslip.setHourlyWage(new BigDecimal("20"));
        payslip.setTravelExpenses(new BigDecimal("15"));

        PayrollDeductionLineDTO loonheffing = new PayrollDeductionLineDTO();
        loonheffing.setId("1");
        loonheffing.setCode("LOONHEFFING");
        loonheffing.setLabel("Loonheffing");
        loonheffing.setCategory("TAX");
        loonheffing.setCalculationType("FIXED_AMOUNT");
        loonheffing.setConfiguredValue(new BigDecimal("40"));
        loonheffing.setSortOrder(10);

        PayrollDeductionLineDTO pension = new PayrollDeductionLineDTO();
        pension.setId("2");
        pension.setCode("PENSION_EMPLOYEE");
        pension.setLabel("Employee pension");
        pension.setCategory("PENSION");
        pension.setCalculationType("PERCENT_OF_GROSS");
        pension.setConfiguredValue(new BigDecimal("5"));
        pension.setSortOrder(20);

        payslip.setDeductionLinesJson(PayslipDeductionCodec.write(List.of(loonheffing, pension)));

        PayslipCalculator.apply(payslip);

        assertEquals("200.00", payslip.getTotalGrossAmount().toPlainString());
        assertEquals("50.00", payslip.getTotalEmployeeDeductions().toPlainString());
        assertEquals("40.00", payslip.getWageTaxWithheldTest().toPlainString());
        assertEquals("165.00", payslip.getTotalNetAmount().toPlainString());
    }

    @Test
    void legacyWageTaxBecomesDeductionLineWhenJsonIsEmpty() {
        Payslip payslip = new Payslip();
        payslip.setTotalHoursWorked(new BigDecimal("8"));
        payslip.setHourlyWage(new BigDecimal("18.75"));
        payslip.setTravelExpenses(new BigDecimal("0"));
        payslip.setWageTaxWithheldTest(new BigDecimal("30"));

        PayslipCalculator.apply(payslip);

        assertEquals("150.00", payslip.getTotalGrossAmount().toPlainString());
        assertEquals("30.00", payslip.getTotalEmployeeDeductions().toPlainString());
        assertEquals("30.00", payslip.getWageTaxWithheldTest().toPlainString());
        assertEquals("120.00", payslip.getTotalNetAmount().toPlainString());
    }
}
