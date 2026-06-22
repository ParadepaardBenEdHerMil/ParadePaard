package com.pm.payrollservice.service;

import java.math.BigDecimal;
import java.util.List;

/**
 * Year-effective Dutch wage-tax (loonheffing) parameters.
 *
 * <p>All figures for 2026 are taken from the official Belastingdienst
 * "Handboek Loonheffingen 2026 - maart 2026", Bijlage 1
 * ("Tarieven, bedragen en percentages loonheffingen vanaf 1 januari 2026").
 * A copy of the handbook lives in the repository under {@code Project/Tax/}.
 *
 * <p>The numbers are intentionally kept in one place so a new tax year only
 * needs a new {@link #forYear(int)} branch. Loonheffing is computed with the
 * bracket/credit formula (the time-period table approximation): annualise the
 * period wage, apply the brackets, subtract the heffingskortingen when the
 * employee has loonheffingskorting applied, then de-annualise.
 */
public final class DutchPayrollTaxRates {

    /** A wage-tax bracket. {@code upTo == null} means "and everything above". */
    public record Bracket(BigDecimal from, BigDecimal upTo, BigDecimal ratePercent) {}

    /** One build-up tier of the arbeidskorting (labour tax credit). */
    public record ArbeidskortingTier(BigDecimal from, BigDecimal upTo, BigDecimal ratePercent) {}

    /** Algemene heffingskorting (general tax credit) parameters. */
    public record AlgemeneHeffingskorting(
            BigDecimal maxAmount,
            BigDecimal phaseOutStart,
            BigDecimal phaseOutRatePercent,
            BigDecimal phaseOutEnd
    ) {}

    /** Arbeidskorting (labour tax credit) parameters. */
    public record Arbeidskorting(
            List<ArbeidskortingTier> buildUpTiers,
            BigDecimal maxAmount,
            BigDecimal phaseOutStart,
            BigDecimal phaseOutRatePercent,
            BigDecimal phaseOutEnd
    ) {}

    private final int year;
    private final List<Bracket> bracketsBelowAow;
    private final List<Bracket> bracketsAboveAow;
    private final AlgemeneHeffingskorting algemeneHeffingskortingBelowAow;
    private final Arbeidskorting arbeidskortingBelowAow;
    private final BigDecimal zvwEmployeeRatePercent;
    private final BigDecimal employerZvwRatePercent;
    private final BigDecimal employerInsurancePremiumPercent;
    private final BigDecimal annualMaxContributionWage;
    private final int aowAgeYears;
    private final BigDecimal defaultPensionEmployeeRatePercent;

    private DutchPayrollTaxRates(
            int year,
            List<Bracket> bracketsBelowAow,
            List<Bracket> bracketsAboveAow,
            AlgemeneHeffingskorting algemeneHeffingskortingBelowAow,
            Arbeidskorting arbeidskortingBelowAow,
            BigDecimal zvwEmployeeRatePercent,
            BigDecimal employerZvwRatePercent,
            BigDecimal employerInsurancePremiumPercent,
            BigDecimal annualMaxContributionWage,
            int aowAgeYears,
            BigDecimal defaultPensionEmployeeRatePercent
    ) {
        this.year = year;
        this.bracketsBelowAow = bracketsBelowAow;
        this.bracketsAboveAow = bracketsAboveAow;
        this.algemeneHeffingskortingBelowAow = algemeneHeffingskortingBelowAow;
        this.arbeidskortingBelowAow = arbeidskortingBelowAow;
        this.zvwEmployeeRatePercent = zvwEmployeeRatePercent;
        this.employerZvwRatePercent = employerZvwRatePercent;
        this.employerInsurancePremiumPercent = employerInsurancePremiumPercent;
        this.annualMaxContributionWage = annualMaxContributionWage;
        this.aowAgeYears = aowAgeYears;
        this.defaultPensionEmployeeRatePercent = defaultPensionEmployeeRatePercent;
    }

    /**
     * Returns the tax parameters for the requested calendar year. Only 2026 is
     * defined today; any other year falls back to the latest known set (2026)
     * so payslips never fail to compute. Add a new branch here per tax year.
     */
    public static DutchPayrollTaxRates forYear(int year) {
        return YEAR_2026;
    }

    public int year() {
        return year;
    }

    public List<Bracket> brackets(boolean belowAowAge) {
        return belowAowAge ? bracketsBelowAow : bracketsAboveAow;
    }

    public AlgemeneHeffingskorting algemeneHeffingskorting(boolean belowAowAge) {
        // Only the below-AOW credit set is modelled in full; the AOW-aged set is
        // a future addition. Below-AOW is the case for ordinary employees.
        return algemeneHeffingskortingBelowAow;
    }

    public Arbeidskorting arbeidskorting(boolean belowAowAge) {
        return arbeidskortingBelowAow;
    }

    public BigDecimal zvwEmployeeRatePercent() {
        return zvwEmployeeRatePercent;
    }

    /** Werkgeversheffing Zvw (employer health-care levy) rate. */
    public BigDecimal employerZvwRatePercent() {
        return employerZvwRatePercent;
    }

    /**
     * Aggregate employer "premies werknemersverzekeringen" rate
     * (AWf-low + Aof-low + Whk sector 33 Horeca + Wko), capped at the
     * maximumpremieloon. Informational on the jaaropgaaf.
     */
    public BigDecimal employerInsurancePremiumPercent() {
        return employerInsurancePremiumPercent;
    }

    public BigDecimal annualMaxContributionWage() {
        return annualMaxContributionWage;
    }

    public int aowAgeYears() {
        return aowAgeYears;
    }

    public BigDecimal defaultPensionEmployeeRatePercent() {
        return defaultPensionEmployeeRatePercent;
    }

    // ------------------------------------------------------------------
    // 2026 figures - Handboek Loonheffingen 2026, Bijlage 1
    // ------------------------------------------------------------------
    private static final DutchPayrollTaxRates YEAR_2026 = new DutchPayrollTaxRates(
            2026,
            // Tabel 1 - Schijventarief, jonger dan de AOW-leeftijd
            List.of(
                    new Bracket(bd("0"), bd("38883"), bd("35.75")),
                    new Bracket(bd("38883"), bd("78426"), bd("37.56")),
                    new Bracket(bd("78426"), null, bd("49.50"))
            ),
            // Tabel 1 - Schijventarief, AOW-leeftijd en ouder (geboren 1946 of later)
            List.of(
                    new Bracket(bd("0"), bd("38883"), bd("17.85")),
                    new Bracket(bd("38883"), bd("78426"), bd("37.56")),
                    new Bracket(bd("78426"), null, bd("49.50"))
            ),
            // Tabel 2a - Algemene heffingskorting, jonger dan de AOW-leeftijd
            new AlgemeneHeffingskorting(bd("3115"), bd("29736"), bd("6.398"), bd("78426")),
            // Tabel 2a - Arbeidskorting, jonger dan de AOW-leeftijd
            new Arbeidskorting(
                    List.of(
                            new ArbeidskortingTier(bd("0"), bd("11965"), bd("8.324")),
                            new ArbeidskortingTier(bd("11965"), bd("25845"), bd("31.009")),
                            new ArbeidskortingTier(bd("25845"), bd("45592"), bd("1.950"))
                    ),
                    bd("5685"),
                    bd("45592"),
                    bd("6.510"),
                    bd("132920")
            ),
            // Tabel 12 - inhouding van bijdrage Zvw (employee), 2026
            bd("4.85"),
            // Tabel 12 - werkgeversheffing Zvw (employer), 2026
            bd("6.10"),
            // Tabel 9 aggregate employer premies werknemersverzekeringen:
            // AWf-laag 2.74 + Aof-laag 6.27 + Whk sector 33 Horeca 1.77 + Wko 0.50
            bd("11.28"),
            // Tabel 11 - maximumbijdrageloon/maximumpremieloon per jaar, 2026
            bd("79409.00"),
            // AOW-leeftijd in 2026
            67,
            // Horeca CAO / PHenC employee pension premium (basisregeling), 2026
            bd("8.40")
    );

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }
}
