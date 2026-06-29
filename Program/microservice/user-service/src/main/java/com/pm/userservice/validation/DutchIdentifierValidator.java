package com.pm.userservice.validation;

import java.util.Locale;

/**
 * Checksum validation for Dutch payroll identifiers (DV-2 / O-6 / O-8).
 *
 * <p>An invalid BSN is rejected by the Belastingdienst (broken tax filing) and an invalid
 * IBAN means salary paid to a non-existent account, so both must be checksum-verified
 * server-side, not merely non-blank.
 */
public final class DutchIdentifierValidator {

    private DutchIdentifierValidator() {
    }

    /**
     * Validates a BSN against the "11-proef": for the 9 digits d1..d9, the weighted sum
     * 9·d1 + 8·d2 + ... + 2·d8 + (-1)·d9 must be a non-zero multiple of 11.
     * Accepts 8-digit legacy sofinummers (left-padded with a zero).
     */
    public static boolean isValidBsn(String raw) {
        if (raw == null) {
            return false;
        }
        String digits = raw.trim();
        if (!digits.matches("\\d{8,9}")) {
            return false;
        }
        if (digits.length() == 8) {
            digits = "0" + digits;
        }
        if (digits.equals("000000000")) {
            return false;
        }
        int sum = 0;
        for (int i = 0; i < 9; i++) {
            int value = digits.charAt(i) - '0';
            int weight = (i == 8) ? -1 : (9 - i);
            sum += value * weight;
        }
        return sum != 0 && sum % 11 == 0;
    }

    /**
     * Validates an IBAN with the ISO 13616 / ISO 7064 MOD-97-10 check (result must be 1).
     * Whitespace is ignored and case is normalised; any valid country's IBAN is accepted.
     */
    public static boolean isValidIban(String raw) {
        if (raw == null) {
            return false;
        }
        String iban = raw.replaceAll("\\s", "").toUpperCase(Locale.ROOT);
        if (!iban.matches("[A-Z]{2}\\d{2}[A-Z0-9]+") || iban.length() < 15 || iban.length() > 34) {
            return false;
        }
        String rearranged = iban.substring(4) + iban.substring(0, 4);
        StringBuilder numeric = new StringBuilder();
        for (int i = 0; i < rearranged.length(); i++) {
            char c = rearranged.charAt(i);
            if (c >= '0' && c <= '9') {
                numeric.append(c);
            } else {
                numeric.append(c - 'A' + 10); // A=10 .. Z=35
            }
        }
        return mod97(numeric.toString()) == 1;
    }

    private static int mod97(String number) {
        int remainder = 0;
        for (int i = 0; i < number.length(); i++) {
            remainder = (remainder * 10 + (number.charAt(i) - '0')) % 97;
        }
        return remainder;
    }
}
