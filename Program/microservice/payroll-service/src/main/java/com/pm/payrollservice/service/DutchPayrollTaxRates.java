package com.pm.payrollservice.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.util.List;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;

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

    private static final Logger log = LoggerFactory.getLogger(DutchPayrollTaxRates.class);

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
     * Returns the tax parameters for the requested calendar year.
     *
     * <p>Only years with figures verified against the official Handboek are
     * registered (see {@link #BY_YEAR}). If a year is not registered we fall
     * back to the closest known set - the latest year not after the requested
     * one, or the earliest known year if the request predates all data - so
     * payslips never fail to compute. Unlike the previous implementation this
     * substitution is logged, never silent, because applying one year's rates
     * to another year produces incorrect loonheffing/jaaropgaaf figures.
     *
     * <p>Add a new tax year by registering its verified set in {@link #BY_YEAR}.
     */
    public static DutchPayrollTaxRates forYear(int year) {
        DutchPayrollTaxRates exact = BY_YEAR.get(year);
        if (exact != null) {
            return exact;
        }
        var floor = BY_YEAR.floorEntry(year);
        DutchPayrollTaxRates fallback = (floor != null) ? floor.getValue() : BY_YEAR.firstEntry().getValue();
        log.warn("No verified Dutch payroll tax rates for year {}; falling back to {} figures. "
                        + "Register a verified forYear branch for {} before relying on its payslips/jaaropgaaf.",
                year, fallback.year(), year);
        return fallback;
    }

    /** Calendar years for which figures have been verified and registered. */
    public static Set<Integer> knownYears() {
        return BY_YEAR.keySet();
    }

    /** Whether verified figures exist for the given year (i.e. no fallback is used). */
    public static boolean hasExactYear(int year) {
        return BY_YEAR.containsKey(year);
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
    // 2024 figures - Handboek Loonheffingen 2024, Bijlage 1
    // plus Belastingdienst rates tables 9/10/11/12 for the employer/Zvw caps.
    // Horeca pension default remains the PHenC / horeca baseline 8.40%.
    // ------------------------------------------------------------------
    private static final DutchPayrollTaxRates YEAR_2024 = new DutchPayrollTaxRates(
            2024,
            List.of(
                    new Bracket(bd("0"), bd("38098"), bd("36.97")),
                    new Bracket(bd("38098"), bd("75518"), bd("36.97")),
                    new Bracket(bd("75518"), null, bd("49.50"))
            ),
            List.of(
                    new Bracket(bd("0"), bd("38098"), bd("19.07")),
                    new Bracket(bd("38098"), bd("75518"), bd("36.97")),
                    new Bracket(bd("75518"), null, bd("49.50"))
            ),
            new AlgemeneHeffingskorting(bd("3362"), bd("24812"), bd("6.630"), bd("75518")),
            new Arbeidskorting(
                    List.of(
                            new ArbeidskortingTier(bd("0"), bd("11490"), bd("8.425")),
                            new ArbeidskortingTier(bd("11490"), bd("24820"), bd("31.433")),
                            new ArbeidskortingTier(bd("24820"), bd("39957"), bd("2.471"))
                    ),
                    bd("5532"),
                    bd("39957"),
                    bd("6.510"),
                    bd("124934")
            ),
            bd("5.32"),
            bd("6.57"),
            // AWf-laag 2.64 + Aof-laag 6.18 + Whk sector 33 Horeca 1.18 + Wko 0.50
            bd("10.50"),
            bd("71628.00"),
            67,
            bd("8.40")
    );

    // ------------------------------------------------------------------
    // 2025 figures - Handboek Loonheffingen 2025, Bijlage 1
    // plus Belastingdienst rates tables 9/10/11/12 for the employer/Zvw caps.
    // Horeca pension default remains the PHenC / horeca baseline 8.40%.
    // ------------------------------------------------------------------
    private static final DutchPayrollTaxRates YEAR_2025 = new DutchPayrollTaxRates(
            2025,
            List.of(
                    new Bracket(bd("0"), bd("38441"), bd("35.82")),
                    new Bracket(bd("38441"), bd("76817"), bd("37.48")),
                    new Bracket(bd("76817"), null, bd("49.50"))
            ),
            List.of(
                    new Bracket(bd("0"), bd("38441"), bd("17.92")),
                    new Bracket(bd("38441"), bd("76817"), bd("37.48")),
                    new Bracket(bd("76817"), null, bd("49.50"))
            ),
            new AlgemeneHeffingskorting(bd("3068"), bd("28406"), bd("6.337"), bd("76817")),
            new Arbeidskorting(
                    List.of(
                            new ArbeidskortingTier(bd("0"), bd("12169"), bd("8.053")),
                            new ArbeidskortingTier(bd("12169"), bd("26288"), bd("30.030")),
                            new ArbeidskortingTier(bd("26288"), bd("43071"), bd("2.258"))
                    ),
                    bd("5599"),
                    bd("43071"),
                    bd("6.510"),
                    bd("129078")
            ),
            bd("5.26"),
            bd("6.51"),
            // AWf-laag 2.74 + Aof-laag 6.28 + Whk sector 33 Horeca 1.41 + Wko 0.50
            bd("10.93"),
            bd("75864.00"),
            67,
            bd("8.40")
    );

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

    /**
     * Registry of verified tax years, keyed by calendar year. Only add a year
     * here once its figures are cross-checked against that year's official
     * Handboek Loonheffingen (Bijlage 1). 2024 is verified against
     * "Handboek Loonheffingen 2024 - oktober 2024", 2025 against
     * "Handboek Loonheffingen 2025 - oktober 2025", and 2026 against
     * "Handboek Loonheffingen 2026 - maart 2026".
     */
    private static final NavigableMap<Integer, DutchPayrollTaxRates> BY_YEAR = new TreeMap<>();
    static {
        BY_YEAR.put(YEAR_2024.year(), YEAR_2024);
        BY_YEAR.put(YEAR_2025.year(), YEAR_2025);
        BY_YEAR.put(YEAR_2026.year(), YEAR_2026);
    }

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }
}
