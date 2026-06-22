package com.pm.payrollservice.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Period;
import java.util.Locale;

/**
 * Computes Dutch wage tax (loonheffing = loonbelasting + premie
 * volksverzekeringen) and the employee Zvw contribution for a single pay period.
 *
 * <p>Loonheffing is derived with the bracket/credit formula (the standard
 * time-period table approximation): the period wage is annualised, the annual
 * brackets are applied, the heffingskortingen (algemene heffingskorting +
 * arbeidskorting) are subtracted when the employee has loonheffingskorting
 * applied with this employer, and the annual result is divided back to the
 * period. All rates come from {@link DutchPayrollTaxRates}.
 */
public final class LoonheffingCalculator {

    private static final int INTERNAL_SCALE = 10;
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private LoonheffingCalculator() {}

    /** Number of pay periods in a year for the given contract payment frequency. */
    public static int periodsPerYear(String paymentFrequency) {
        String frequency = paymentFrequency == null ? "" : paymentFrequency.trim().toUpperCase(Locale.ROOT);
        return switch (frequency) {
            case "DAILY" -> 260;
            case "BIWEEKLY" -> 26;
            case "FOUR_WEEKLY", "FOURWEEKLY", "FOUR_WEEKS" -> 13;
            case "MONTHLY" -> 12;
            case "QUARTERLY" -> 4;
            case "YEARLY", "ANNUAL" -> 1;
            // WEEKLY and unknown/test frequencies default to weekly, which is how
            // the system generates payslips (one per ISO week).
            default -> 52;
        };
    }

    /**
     * Whether the employee is younger than the AOW (state pension) age on the
     * given date. A missing date of birth is treated as below-AOW, which is the
     * ordinary case and yields the higher (premie-volksverzekeringen) rate.
     */
    public static boolean isBelowAowAge(LocalDate dateOfBirth, LocalDate onDate, DutchPayrollTaxRates rates) {
        if (dateOfBirth == null || onDate == null) {
            return true;
        }
        int age = Period.between(dateOfBirth, onDate).getYears();
        return age < rates.aowAgeYears();
    }

    /** Wage tax withheld for one pay period, rounded to cents (never negative). */
    public static BigDecimal periodWageTax(
            BigDecimal periodTaxableWage,
            int periodsPerYear,
            boolean belowAowAge,
            boolean applyLoonheffingskorting,
            DutchPayrollTaxRates rates
    ) {
        if (periodTaxableWage == null || periodsPerYear <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal periodWage = periodTaxableWage.max(BigDecimal.ZERO);
        BigDecimal annualWage = periodWage.multiply(BigDecimal.valueOf(periodsPerYear));

        BigDecimal annualTax = annualBracketTax(annualWage, belowAowAge, rates);
        if (applyLoonheffingskorting) {
            BigDecimal credits = algemeneHeffingskorting(annualWage, belowAowAge, rates)
                    .add(arbeidskorting(annualWage, belowAowAge, rates));
            annualTax = annualTax.subtract(credits).max(BigDecimal.ZERO);
        }

        return annualTax
                .divide(BigDecimal.valueOf(periodsPerYear), INTERNAL_SCALE, RoundingMode.HALF_UP)
                .setScale(2, RoundingMode.HALF_UP);
    }

    /** Annual loonbelasting/premie volksverzekeringen over the bracket table. */
    public static BigDecimal annualBracketTax(BigDecimal annualWage, boolean belowAowAge, DutchPayrollTaxRates rates) {
        BigDecimal wage = annualWage == null ? BigDecimal.ZERO : annualWage.max(BigDecimal.ZERO);
        BigDecimal tax = BigDecimal.ZERO;
        for (DutchPayrollTaxRates.Bracket bracket : rates.brackets(belowAowAge)) {
            BigDecimal upper = bracket.upTo() == null ? wage : wage.min(bracket.upTo());
            BigDecimal portion = upper.subtract(bracket.from());
            if (portion.signum() > 0) {
                tax = tax.add(percentOf(portion, bracket.ratePercent()));
            }
        }
        return tax;
    }

    /** Annual algemene heffingskorting (general tax credit). */
    public static BigDecimal algemeneHeffingskorting(BigDecimal annualWage, boolean belowAowAge, DutchPayrollTaxRates rates) {
        DutchPayrollTaxRates.AlgemeneHeffingskorting credit = rates.algemeneHeffingskorting(belowAowAge);
        BigDecimal wage = annualWage == null ? BigDecimal.ZERO : annualWage.max(BigDecimal.ZERO);
        if (wage.compareTo(credit.phaseOutStart()) <= 0) {
            return credit.maxAmount();
        }
        BigDecimal reduction = percentOf(wage.subtract(credit.phaseOutStart()), credit.phaseOutRatePercent());
        reduction = reduction.min(credit.maxAmount());
        return credit.maxAmount().subtract(reduction).max(BigDecimal.ZERO);
    }

    /** Annual arbeidskorting (labour tax credit). */
    public static BigDecimal arbeidskorting(BigDecimal annualWage, boolean belowAowAge, DutchPayrollTaxRates rates) {
        DutchPayrollTaxRates.Arbeidskorting credit = rates.arbeidskorting(belowAowAge);
        BigDecimal wage = annualWage == null ? BigDecimal.ZERO : annualWage.max(BigDecimal.ZERO);

        BigDecimal build = BigDecimal.ZERO;
        for (DutchPayrollTaxRates.ArbeidskortingTier tier : credit.buildUpTiers()) {
            BigDecimal upper = wage.min(tier.upTo());
            BigDecimal portion = upper.subtract(tier.from());
            if (portion.signum() > 0) {
                build = build.add(percentOf(portion, tier.ratePercent()));
            }
        }
        build = build.min(credit.maxAmount());

        BigDecimal phaseOut = BigDecimal.ZERO;
        if (wage.compareTo(credit.phaseOutStart()) > 0) {
            phaseOut = percentOf(wage.subtract(credit.phaseOutStart()), credit.phaseOutRatePercent());
        }
        return build.subtract(phaseOut).max(BigDecimal.ZERO);
    }

    /**
     * Employee Zvw contribution (inhouding bijdrage Zvw) for one period. Applies
     * only when the employee owes the employee contribution rather than the
     * employer levy; the base is capped at the period maximumbijdrageloon.
     */
    public static BigDecimal periodZvwEmployee(BigDecimal periodZvwWage, int periodsPerYear, DutchPayrollTaxRates rates) {
        return cappedPercent(periodZvwWage, periodsPerYear, rates.zvwEmployeeRatePercent(), rates);
    }

    /** Werkgeversheffing Zvw (employer health-care levy) for one period, capped. */
    public static BigDecimal periodEmployerZvw(BigDecimal periodWage, int periodsPerYear, DutchPayrollTaxRates rates) {
        return cappedPercent(periodWage, periodsPerYear, rates.employerZvwRatePercent(), rates);
    }

    /** Aggregate employer premies werknemersverzekeringen for one period, capped. */
    public static BigDecimal periodEmployerInsurancePremiums(BigDecimal periodWage, int periodsPerYear, DutchPayrollTaxRates rates) {
        return cappedPercent(periodWage, periodsPerYear, rates.employerInsurancePremiumPercent(), rates);
    }

    /**
     * The arbeidskorting actually settled in payroll for one period
     * (verrekende arbeidskorting) - zero when loonheffingskorting is not applied,
     * and never more than the tax left after the algemene heffingskorting.
     */
    public static BigDecimal periodArbeidskortingApplied(
            BigDecimal periodTaxableWage,
            int periodsPerYear,
            boolean belowAowAge,
            boolean applyLoonheffingskorting,
            DutchPayrollTaxRates rates
    ) {
        if (!applyLoonheffingskorting || periodTaxableWage == null || periodsPerYear <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal annualWage = periodTaxableWage.max(BigDecimal.ZERO).multiply(BigDecimal.valueOf(periodsPerYear));
        BigDecimal tax = annualBracketTax(annualWage, belowAowAge, rates);
        BigDecimal afterAlgemene = tax.subtract(algemeneHeffingskorting(annualWage, belowAowAge, rates)).max(BigDecimal.ZERO);
        BigDecimal applied = arbeidskorting(annualWage, belowAowAge, rates).min(afterAlgemene);
        return applied.divide(BigDecimal.valueOf(periodsPerYear), INTERNAL_SCALE, RoundingMode.HALF_UP)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal cappedPercent(BigDecimal periodWage, int periodsPerYear, BigDecimal ratePercent, DutchPayrollTaxRates rates) {
        if (periodWage == null || periodsPerYear <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal periodMax = rates.annualMaxContributionWage()
                .divide(BigDecimal.valueOf(periodsPerYear), INTERNAL_SCALE, RoundingMode.HALF_UP);
        BigDecimal base = periodWage.max(BigDecimal.ZERO).min(periodMax);
        return percentOf(base, ratePercent).setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal percentOf(BigDecimal base, BigDecimal percent) {
        return base.multiply(percent).divide(HUNDRED, INTERNAL_SCALE, RoundingMode.HALF_UP);
    }
}
