package com.pm.payrollservice.service;

import com.pm.payrollservice.dto.PayrollDeductionLineDTO;
import com.pm.payrollservice.dto.PayslipDeductionCodec;
import com.pm.payrollservice.model.Payslip;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PayslipCalculatorTest {

    private static final DutchPayrollTaxRates RATES = DutchPayrollTaxRates.forYear(2026);

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

    @Test
    void loonheffingTableIsComputedOnWageReducedByPension() {
        Payslip payslip = weeklyHorecaPayslip(true);
        // 20h * EUR 14,71 = EUR 294,20 gross
        payslip.setTotalHoursWorked(new BigDecimal("20"));
        payslip.setHourlyWage(new BigDecimal("14.71"));

        payslip.setDeductionLinesJson(PayslipDeductionCodec.write(List.of(
                line("PENSION_EMPLOYEE", "Pensioenpremie werknemer", "PENSION", "PERCENT_OF_GROSS", "8.40", 20),
                line("LOONHEFFING", "Loonheffing", "TAX", "LOONHEFFING_TABLE", null, 10)
        )));

        PayslipCalculator.apply(payslip);

        // Pension (pre-tax): 294,20 * 8,40% = 24,71. Taxable wage = 269,49.
        BigDecimal expectedTaxable = new BigDecimal("269.49");
        BigDecimal expectedLoonheffing =
                LoonheffingCalculator.periodWageTax(expectedTaxable, 52, true, true, RATES);

        PayrollDeductionLineDTO loonheffingLine = findLine(payslip, "LOONHEFFING");
        PayrollDeductionLineDTO pensionLine = findLine(payslip, "PENSION_EMPLOYEE");

        assertEquals("294.20", payslip.getTotalGrossAmount().toPlainString());
        assertEquals("24.71", pensionLine.getCalculatedAmount().toPlainString());
        assertEquals(expectedLoonheffing.toPlainString(), loonheffingLine.getCalculatedAmount().toPlainString());
        assertTrue(loonheffingLine.getCalculatedAmount().signum() > 0, "loonheffing should be withheld");

        BigDecimal expectedDeductions = pensionLine.getCalculatedAmount().add(loonheffingLine.getCalculatedAmount());
        assertEquals(expectedDeductions.toPlainString(), payslip.getTotalEmployeeDeductions().toPlainString());
        assertEquals(expectedLoonheffing.toPlainString(), payslip.getWageTaxWithheldTest().toPlainString());
        assertEquals(
                new BigDecimal("294.20").subtract(expectedDeductions).toPlainString(),
                payslip.getTotalNetAmount().toPlainString()
        );
    }

    @Test
    void withoutLoonheffingskortingMoreTaxIsWithheld() {
        Payslip withKorting = weeklyHorecaPayslip(true);
        Payslip withoutKorting = weeklyHorecaPayslip(false);
        for (Payslip p : List.of(withKorting, withoutKorting)) {
            p.setTotalHoursWorked(new BigDecimal("38"));
            p.setHourlyWage(new BigDecimal("18.00"));
            p.setDeductionLinesJson(PayslipDeductionCodec.write(List.of(
                    line("LOONHEFFING", "Loonheffing", "TAX", "LOONHEFFING_TABLE", null, 10)
            )));
            PayslipCalculator.apply(p);
        }

        assertTrue(
                findLine(withoutKorting, "LOONHEFFING").getCalculatedAmount()
                        .compareTo(findLine(withKorting, "LOONHEFFING").getCalculatedAmount()) > 0,
                "withholding without loonheffingskorting must exceed withholding with it"
        );
        assertTrue(
                withKorting.getTotalNetAmount().compareTo(withoutKorting.getTotalNetAmount()) > 0,
                "applying loonheffingskorting yields a higher net pay"
        );
    }

    private static Payslip weeklyHorecaPayslip(boolean applyLoonheffingskorting) {
        Payslip payslip = new Payslip();
        payslip.setDateOfIssue(LocalDate.parse("2026-06-01"));
        payslip.setWeekBasedYear(2026);
        payslip.setDateOfBirth(LocalDate.parse("1995-05-05"));
        payslip.setPaymentFrequency("WEEKLY");
        payslip.setTravelExpenses(BigDecimal.ZERO);
        payslip.setApplyLoonheffingskorting(applyLoonheffingskorting);
        return payslip;
    }

    private static PayrollDeductionLineDTO line(
            String code, String label, String category, String calcType, String configuredValue, int sortOrder
    ) {
        PayrollDeductionLineDTO line = new PayrollDeductionLineDTO();
        line.setCode(code);
        line.setLabel(label);
        line.setCategory(category);
        line.setCalculationType(calcType);
        if (configuredValue != null) {
            line.setConfiguredValue(new BigDecimal(configuredValue));
        }
        line.setSortOrder(sortOrder);
        return line;
    }

    private static PayrollDeductionLineDTO findLine(Payslip payslip, String code) {
        PayrollDeductionLineDTO found = PayslipDeductionCodec.read(payslip.getDeductionLinesJson()).stream()
                .filter(l -> code.equalsIgnoreCase(l.getCode()))
                .findFirst()
                .orElse(null);
        assertNotNull(found, "expected deduction line " + code);
        return found;
    }
}
