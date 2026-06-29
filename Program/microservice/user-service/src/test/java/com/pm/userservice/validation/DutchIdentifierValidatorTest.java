package com.pm.userservice.validation;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Algorithm tests for the Dutch BSN (11-proef) and IBAN (MOD-97) checks (DV-2 / O-6 / O-8).
 */
class DutchIdentifierValidatorTest {

    // ---- BSN (11-proef) ----

    @ParameterizedTest
    @ValueSource(strings = {"111222333", "999999990", "11222335"}) // last is an 8-digit (zero-padded) BSN
    void validBsnPassesElfproef(String bsn) {
        assertThat(DutchIdentifierValidator.isValidBsn(bsn)).isTrue();
    }

    @Test
    void bsnWithSurroundingWhitespaceIsAccepted() {
        assertThat(DutchIdentifierValidator.isValidBsn("  111222333  ")).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "123456789",   // fails the 11-proef
            "000000000",   // all zeros rejected
            "12345",       // too short
            "1234567890",  // too long
            "11122233a"    // non-digit
    })
    void invalidBsnIsRejected(String bsn) {
        assertThat(DutchIdentifierValidator.isValidBsn(bsn)).isFalse();
    }

    @Test
    void nullBsnIsRejected() {
        assertThat(DutchIdentifierValidator.isValidBsn(null)).isFalse();
    }

    // ---- IBAN (MOD-97) ----

    @ParameterizedTest
    @ValueSource(strings = {
            "NL91ABNA0417164300",          // canonical NL example
            "DE89370400440532013000",      // foreign IBAN is still valid
            "GB82WEST12345698765432"
    })
    void validIbanPassesMod97(String iban) {
        assertThat(DutchIdentifierValidator.isValidIban(iban)).isTrue();
    }

    @Test
    void ibanIsWhitespaceAndCaseInsensitive() {
        assertThat(DutchIdentifierValidator.isValidIban("nl91 abna 0417 1643 00")).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "NL91ABNA0417164301",  // wrong check digits (last digit changed)
            "NL00ABNA0417164300",  // invalid check digits
            "NL91ABNA041716430",   // too short
            "1234567890",          // no country code
            "ZZ12"                 // far too short
    })
    void invalidIbanIsRejected(String iban) {
        assertThat(DutchIdentifierValidator.isValidIban(iban)).isFalse();
    }

    @Test
    void nullIbanIsRejected() {
        assertThat(DutchIdentifierValidator.isValidIban(null)).isFalse();
    }
}
