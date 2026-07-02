package com.pm.payrollservice.service;

import com.pm.payrollservice.dto.PayrollDeductionLineDTO;
import com.pm.payrollservice.dto.PayslipDeductionCodec;
import com.pm.payrollservice.model.Payslip;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

public final class PayslipCalculator {
    private static final BigDecimal ZERO = BigDecimal.ZERO;
    private static final BigDecimal TAX_FREE_TRAVEL_RATE = new BigDecimal("0.23");

    /** Deduction-line calculation types. */
    private static final String PERCENT_OF_GROSS = "PERCENT_OF_GROSS";
    private static final String LOONHEFFING_TABLE = "LOONHEFFING_TABLE";

    /** Categories that lower the wage subject to loonheffing (deducted pre-tax). */
    private static final String CATEGORY_PENSION = "PENSION";
    private static final String CATEGORY_ZVW = "ZVW";

    private PayslipCalculator() {}

    /**
     * Derives the genietingsmoment ({@code paymentDate}) and {@code fiscalYear}
     * (kasstelsel): wages are attributed to the tax year in which they are paid /
     * made available. Prefers an explicit paymentDate, else the payout/availability
     * date, else the issue date. Never attributes earlier than the period close.
     */
    public static void applyGenietingsmoment(Payslip payslip) {
        LocalDate paymentDate = payslip.getPaymentDate();
        if (paymentDate == null) {
            LocalDate available = payslip.getAvailableToUserAt();
            LocalDate issued = payslip.getDateOfIssue();
            paymentDate = (available != null && issued != null && available.isBefore(issued))
                    ? issued
                    : (available != null ? available : issued);
            payslip.setPaymentDate(paymentDate);
        }
        if (paymentDate != null) {
            payslip.setFiscalYear(paymentDate.getYear());
        }
    }

    public static void apply(Payslip payslip) {
        applyGenietingsmoment(payslip);

        BigDecimal hours = nz(payslip.getTotalHoursWorked());
        BigDecimal rate = nz(payslip.getHourlyWage());

        BigDecimal travel = money(nz(payslip.getTravelExpenses()));
        BigDecimal taxFreeTravelCap = payslip.getTravelKilometers() == null
                ? travel
                : money(nz(payslip.getTravelKilometers()).multiply(TAX_FREE_TRAVEL_RATE));
        BigDecimal nonTaxableTravel = travel.min(taxFreeTravelCap.max(ZERO));
        BigDecimal taxableTravel = money(travel.subtract(nonTaxableTravel).max(ZERO));
        BigDecimal gross = money(hours.multiply(rate).add(taxableTravel));

        List<PayrollDeductionLineDTO> lines = PayslipDeductionCodec.read(payslip.getDeductionLinesJson());
        if (lines.isEmpty() && nz(payslip.getLoonheffingWithheld()).compareTo(ZERO) > 0) {
            lines = List.of(PayslipDeductionCodec.createLegacyLoonheffingLine(payslip.getLoonheffingWithheld()));
        }

        TaxContext context = TaxContext.forPayslip(payslip);

        // Pass 1: every line except the computed loonheffing. Pension (and any
        // other pre-tax) line lowers the wage that loonheffing is calculated on.
        BigDecimal preTaxReductions = ZERO;
        for (PayrollDeductionLineDTO line : lines) {
            if (isLoonheffingTable(line)) {
                continue;
            }
            BigDecimal amount = calculateLineAmount(line, gross, ZERO, context);
            line.setCalculatedAmount(amount);
            if (isPreTax(line)) {
                preTaxReductions = preTaxReductions.add(amount);
            }
        }

        BigDecimal taxableWage = money(gross.subtract(preTaxReductions).max(ZERO));

        // Pass 2: computed loonheffing, on the pre-tax-reduced wage.
        for (PayrollDeductionLineDTO line : lines) {
            if (isLoonheffingTable(line)) {
                line.setCalculatedAmount(calculateLineAmount(line, gross, taxableWage, context));
            }
        }

        BigDecimal totalDeductions = ZERO;
        BigDecimal wageTax = ZERO;
        BigDecimal employeeZvw = ZERO;
        for (PayrollDeductionLineDTO line : lines) {
            BigDecimal amount = nz(line.getCalculatedAmount());
            totalDeductions = totalDeductions.add(amount);
            if ("LOONHEFFING".equalsIgnoreCase(line.getCode())) {
                wageTax = wageTax.add(amount);
            }
            if (isZvw(line)) {
                employeeZvw = employeeZvw.add(amount);
            }
        }

        totalDeductions = money(totalDeductions);
        wageTax = money(wageTax);

        payslip.setTotalGrossAmount(gross);
        payslip.setTravelExpenses(travel);
        payslip.setTotalEmployeeDeductions(totalDeductions);
        payslip.setLoonheffingWithheld(wageTax);
        payslip.setDeductionLinesJson(PayslipDeductionCodec.write(lines));
        payslip.setTotalNetAmount(money(gross.subtract(totalDeductions).add(nonTaxableTravel)));

        // Jaaropgaaf / loonstaat components (summed per year for the annual statement).
        payslip.setFiscalWage(taxableWage);
        payslip.setEmployeeZvwWithheld(money(employeeZvw));
        payslip.setArbeidskortingApplied(LoonheffingCalculator.periodArbeidskortingApplied(
                taxableWage, context.periodsPerYear(), context.belowAowAge(),
                context.applyLoonheffingskorting(), context.rates()));
        payslip.setEmployerZvwLevy(LoonheffingCalculator.periodEmployerZvw(
                gross, context.periodsPerYear(), context.rates()));
        payslip.setEmployerInsurancePremiums(LoonheffingCalculator.periodEmployerInsurancePremiums(
                gross, context.periodsPerYear(), context.rates()));
    }

    private static BigDecimal calculateLineAmount(
            PayrollDeductionLineDTO line,
            BigDecimal gross,
            BigDecimal taxableWage,
            TaxContext context
    ) {
        BigDecimal manual = line.getManualAmountOverride();
        if (manual != null) {
            return money(manual);
        }

        if (LOONHEFFING_TABLE.equalsIgnoreCase(line.getCalculationType())) {
            return LoonheffingCalculator.periodWageTax(
                    taxableWage,
                    context.periodsPerYear(),
                    context.belowAowAge(),
                    context.applyLoonheffingskorting(),
                    context.rates()
            );
        }

        BigDecimal configured = nz(line.getConfiguredValue());
        if (PERCENT_OF_GROSS.equalsIgnoreCase(line.getCalculationType())) {
            BigDecimal base = isZvw(line) ? gross.min(context.periodZvwMax()) : gross;
            return money(base.multiply(configured).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP));
        }
        return money(configured);
    }

    private static boolean isLoonheffingTable(PayrollDeductionLineDTO line) {
        return LOONHEFFING_TABLE.equalsIgnoreCase(line.getCalculationType());
    }

    private static boolean isPreTax(PayrollDeductionLineDTO line) {
        return CATEGORY_PENSION.equalsIgnoreCase(line.getCategory());
    }

    private static boolean isZvw(PayrollDeductionLineDTO line) {
        if (CATEGORY_ZVW.equalsIgnoreCase(line.getCategory())) {
            return true;
        }
        String code = line.getCode();
        return code != null && code.toUpperCase().startsWith("ZVW");
    }

    private static BigDecimal nz(BigDecimal x) {
        return x == null ? ZERO : x;
    }

    private static BigDecimal money(BigDecimal x) {
        return x.setScale(2, RoundingMode.HALF_UP);
    }

    /** Per-payslip inputs needed to compute the statutory deductions. */
    private record TaxContext(
            int periodsPerYear,
            boolean belowAowAge,
            boolean applyLoonheffingskorting,
            DutchPayrollTaxRates rates,
            BigDecimal periodZvwMax
    ) {
        static TaxContext forPayslip(Payslip payslip) {
            LocalDate onDate = payslip.getDateOfIssue() != null
                    ? payslip.getDateOfIssue()
                    : payslip.getPayPeriodEnd();
            // Loonheffing keys off the genietingsmoment (fiscalYear), not the ISO
            // week-based year; applyGenietingsmoment() runs first in apply().
            int year = payslip.getFiscalYear() != null
                    ? payslip.getFiscalYear()
                    : (payslip.getPaymentDate() != null
                        ? payslip.getPaymentDate().getYear()
                        : (onDate != null ? onDate.getYear() : LocalDate.now().getYear()));
            DutchPayrollTaxRates rates = DutchPayrollTaxRates.forYear(year);

            int periodsPerYear = LoonheffingCalculator.periodsPerYear(payslip.getPaymentFrequency());
            boolean belowAow = LoonheffingCalculator.isBelowAowAge(payslip.getDateOfBirth(), onDate, rates);
            boolean korting = payslip.getApplyLoonheffingskorting() == null
                    || Boolean.TRUE.equals(payslip.getApplyLoonheffingskorting());
            BigDecimal periodZvwMax = rates.annualMaxContributionWage()
                    .divide(BigDecimal.valueOf(periodsPerYear), 2, RoundingMode.HALF_UP);

            return new TaxContext(periodsPerYear, belowAow, korting, rates, periodZvwMax);
        }
    }
}
