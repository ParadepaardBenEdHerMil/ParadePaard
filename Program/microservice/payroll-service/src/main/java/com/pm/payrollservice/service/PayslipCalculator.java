package com.pm.payrollservice.service;

import com.pm.payrollservice.model.Payslip;
import com.pm.payrollservice.model.PayslipTimesheet;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class PayslipCalculator {
    private static final BigDecimal ZERO = BigDecimal.ZERO;

    private PayslipCalculator() {}

    public static void apply(Payslip payslip) {
        BigDecimal gross = ZERO;
        BigDecimal travel = ZERO;

        if (payslip.getTimesheets() != null) {
            for (PayslipTimesheet timesheet : payslip.getTimesheets()) {
                BigDecimal hours = nz(timesheet.getHoursWorked());
                BigDecimal rate  = nz(timesheet.getHourlyWage());
                BigDecimal line  = hours.multiply(rate);
                gross  = gross.add(line);
                travel = travel.add(nz(timesheet.getTravelExpenses()));
            }
        }

        gross  = money(gross);
        travel = money(travel);
        BigDecimal tax = money(nz(payslip.getWageTaxWithheldTest()));

        // store totals
        payslip.setTotalGrossAmount(gross);
        payslip.setTravelExpenses(travel);
        payslip.setTotalNetAmount(money(gross.subtract(tax).add(travel)));
    }

    private static BigDecimal nz(BigDecimal x) {
        return x == null ? ZERO : x;
    }

    private static BigDecimal money(BigDecimal x) {
        return x.setScale(2, RoundingMode.HALF_UP);
    }
}
