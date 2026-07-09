package com.pm.contractservice.service;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Period;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Optional;
import java.util.TreeMap;

/**
 * Resolves the hourly wage a contract should get from the applicable CAO wage table,
 * or — when no CAO applies — from the statutory minimum wage (WML).
 *
 * <p><b>How the wage is decided</b> (the employer does not type it in):
 * a CAO (e.g. Horeca) publishes a wage table that maps a <em>function group</em> and the
 * employee's <em>age band</em> to an hourly wage, revised on fixed dates. Given the CAO,
 * function group, the contract start date and the date of birth, this resolver returns the
 * table wage effective on that date. If the CAO/function-group/age is not covered, it falls
 * back to {@link DutchMinimumWageSchedule} (the law). The returned wage is never below the WML.
 *
 * <p><b>Modular by design.</b> Adding a new CAO = register another entry in {@link #TABLES}.
 * A yearly wage revision = add another effective-dated {@link WageTable} to that CAO's
 * schedule; contracts already signed keep the rate effective when they started.
 *
 * <p><b>Data source.</b> The Horeca figures below are the official KHN "cao-loontabel per
 * 1 januari 2026" (function groups 1/2–11 for vakkrachten, age bands 18 / 19 / 20+). See
 * {@code khn.nl/kennis/loontabellen-per-1-januari-2026}. Update the numbers here when KHN
 * publishes a new table (Horeca revises on 1 January and 1 July).
 */
@Service
public class CaoWageResolver {

    /** Canonical CAO codes. */
    public static final String HORECA = "HORECA";

    /** code -> (effectiveFrom -> table). */
    private static final Map<String, NavigableMap<LocalDate, WageTable>> TABLES = buildTables();

    /**
     * @param caoCode           the CAO the function falls under (case-insensitive); null/blank means "no CAO".
     * @param functionGroup     the CAO function group (Horeca 1..11; 2 shares the "1+2" column).
     * @param contractStartDate the date the wage takes effect.
     * @param dateOfBirth       used to derive the age band and the WML fallback.
     * @return the hourly wage, never below the statutory minimum for that age/date.
     */
    public BigDecimal resolveHourlyWage(String caoCode, Integer functionGroup,
                                        LocalDate contractStartDate, LocalDate dateOfBirth) {
        if (contractStartDate == null) {
            throw new IllegalArgumentException("contract start date is required to resolve a wage");
        }
        if (dateOfBirth == null) {
            throw new IllegalArgumentException("dateOfBirth is required to resolve a wage");
        }

        BigDecimal statutoryMinimum = DutchMinimumWageSchedule.defaults()
                .minimumHourlyWage(contractStartDate, dateOfBirth)
                .orElse(null);

        BigDecimal caoWage = lookupCaoWage(caoCode, functionGroup, contractStartDate, dateOfBirth);
        if (caoWage == null) {
            if (statutoryMinimum == null) {
                throw new IllegalStateException("No CAO wage and no statutory minimum available for the given date");
            }
            return statutoryMinimum;
        }
        // A CAO may never pay below the statutory minimum.
        if (statutoryMinimum != null && caoWage.compareTo(statutoryMinimum) < 0) {
            return statutoryMinimum;
        }
        return caoWage;
    }

    /** True when a CAO wage table (not the WML fallback) covers this request. */
    public boolean hasCaoWage(String caoCode, Integer functionGroup,
                              LocalDate contractStartDate, LocalDate dateOfBirth) {
        return lookupCaoWage(caoCode, functionGroup, contractStartDate, dateOfBirth) != null;
    }

    private BigDecimal lookupCaoWage(String caoCode, Integer functionGroup,
                                     LocalDate contractStartDate, LocalDate dateOfBirth) {
        if (caoCode == null || caoCode.isBlank() || functionGroup == null) {
            return null;
        }
        NavigableMap<LocalDate, WageTable> schedule = TABLES.get(caoCode.trim().toUpperCase());
        if (schedule == null) {
            return null;
        }
        Map.Entry<LocalDate, WageTable> entry = schedule.floorEntry(contractStartDate);
        if (entry == null) {
            return null;
        }
        int age = Period.between(dateOfBirth, contractStartDate).getYears();
        return entry.getValue().wageFor(functionGroup, age);
    }

    private static Map<String, NavigableMap<LocalDate, WageTable>> buildTables() {
        Map<String, NavigableMap<LocalDate, WageTable>> tables = new LinkedHashMap<>();
        tables.put(HORECA, horecaSchedule());
        return tables;
    }

    private static NavigableMap<LocalDate, WageTable> horecaSchedule() {
        NavigableMap<LocalDate, WageTable> schedule = new TreeMap<>();

        // KHN cao-loontabel per 1 januari 2026 (vakkrachten). Columns are function groups;
        // group 2 shares the "1+2" column. Rows are age bands 20+ / 19 / 18.
        WageTable jan2026 = new WageTable();
        jan2026.put(20, group(
                "14.71", "14.91", "14.96", "15.21", "16.07", "17.61", "19.29", "21.02", "22.91", "24.98"));
        jan2026.put(19, group(
                "13.24", "13.42", "13.46", "13.69", "14.46", "15.85", "17.36", "18.92", "20.62", "22.48"));
        jan2026.put(18, group(
                "11.77", "11.93", "11.96", "12.17", "12.85", "14.09", "15.43", "16.82", "18.33", "19.98"));
        schedule.put(LocalDate.of(2026, 1, 1), jan2026);

        return schedule;
    }

    /** Builds one age-band row: values are groups 1(+2),3,4,5,6,7,8,9,10,11 in order. */
    private static Map<Integer, BigDecimal> group(String... byGroup) {
        int[] groupNumbers = {1, 3, 4, 5, 6, 7, 8, 9, 10, 11};
        if (byGroup.length != groupNumbers.length) {
            throw new IllegalArgumentException("expected " + groupNumbers.length + " group values");
        }
        Map<Integer, BigDecimal> row = new LinkedHashMap<>();
        for (int i = 0; i < groupNumbers.length; i++) {
            row.put(groupNumbers[i], new BigDecimal(byGroup[i]));
        }
        return row;
    }

    /** One effective-dated wage table: ageBand (20/19/18) -> (functionGroup -> wage). */
    private static final class WageTable {
        private final Map<Integer, Map<Integer, BigDecimal>> byAgeBand = new LinkedHashMap<>();

        void put(int ageBand, Map<Integer, BigDecimal> groupWages) {
            byAgeBand.put(ageBand, groupWages);
        }

        /** @return the table wage, or null if this age/group is not covered by the CAO table. */
        BigDecimal wageFor(int functionGroup, int age) {
            int band = ageBandFor(age);
            if (band < 0) {
                return null; // under 18 vakkracht scales are not in this table -> caller uses WML
            }
            int column = functionGroup == 2 ? 1 : functionGroup; // group 2 shares the 1+2 column
            Map<Integer, BigDecimal> row = byAgeBand.get(band);
            return row == null ? null : row.get(column);
        }

        private int ageBandFor(int age) {
            if (age >= 20) return 20; // "20 jaar en ouder"
            if (age == 19) return 19;
            if (age == 18) return 18;
            return -1;
        }
    }

    /** Exposed for tooling/UI that lists which CAOs are configured. */
    public static Optional<String> canonicalCode(String caoCode) {
        if (caoCode == null || caoCode.isBlank()) {
            return Optional.empty();
        }
        String code = caoCode.trim().toUpperCase();
        return TABLES.containsKey(code) ? Optional.of(code) : Optional.empty();
    }
}
