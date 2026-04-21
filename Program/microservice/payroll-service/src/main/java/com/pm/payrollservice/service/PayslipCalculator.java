package com.pm.payrollservice.service;

import com.pm.payrollservice.dto.PayrollDeductionLineDTO;
import com.pm.payrollservice.dto.PayslipDeductionCodec;
import com.pm.payrollservice.model.Payslip;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

public final class PayslipCalculator {
    private static final BigDecimal ZERO = BigDecimal.ZERO;

    private PayslipCalculator() {}

    public static void apply(Payslip payslip) {
        BigDecimal hours = nz(payslip.getTotalHoursWorked());
        BigDecimal rate = nz(payslip.getHourlyWage());

        BigDecimal gross = hours.multiply(rate);
        BigDecimal travel = nz(payslip.getTravelExpenses());
        List<PayrollDeductionLineDTO> lines = PayslipDeductionCodec.read(payslip.getDeductionLinesJson());
        if (lines.isEmpty() && nz(payslip.getWageTaxWithheldTest()).compareTo(BigDecimal.ZERO) > 0) {
            lines = List.of(PayslipDeductionCodec.createLegacyLoonheffingLine(payslip.getWageTaxWithheldTest()));
        }

        gross  = money(gross);
        travel = money(travel);

        BigDecimal totalDeductions = BigDecimal.ZERO;
        BigDecimal wageTax = BigDecimal.ZERO;
        for (PayrollDeductionLineDTO line : lines) {
            BigDecimal amount = calculateLineAmount(line, gross);
            line.setCalculatedAmount(amount);
            totalDeductions = totalDeductions.add(amount);
            if ("LOONHEFFING".equalsIgnoreCase(line.getCode())) {
                wageTax = wageTax.add(amount);
            }
        }

        totalDeductions = money(totalDeductions);
        wageTax = money(wageTax);

        // store totals
        payslip.setTotalGrossAmount(gross);
        payslip.setTravelExpenses(travel);
        payslip.setTotalEmployeeDeductions(totalDeductions);
        payslip.setWageTaxWithheldTest(wageTax);
        payslip.setDeductionLinesJson(PayslipDeductionCodec.write(lines));
        payslip.setTotalNetAmount(money(gross.subtract(totalDeductions).add(travel)));
    }

    private static BigDecimal nz(BigDecimal x) {
        return x == null ? ZERO : x;
    }

    private static BigDecimal calculateLineAmount(PayrollDeductionLineDTO line, BigDecimal gross) {
        BigDecimal manual = line.getManualAmountOverride();
        if (manual != null) {
            return money(manual);
        }

        BigDecimal configured = nz(line.getConfiguredValue());
        if ("PERCENT_OF_GROSS".equalsIgnoreCase(line.getCalculationType())) {
            return money(gross.multiply(configured).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
        }
        return money(configured);
    }

    private static BigDecimal money(BigDecimal x) {
        return x.setScale(2, RoundingMode.HALF_UP);
    }
}
