package com.pm.contractservice.model;

import java.util.Locale;

public enum PaymentFrequency {
    DAILY,
    WEEKLY,
    BIWEEKLY,
    FOUR_WEEKLY,
    MONTHLY,
    EVERY_5_MINUTES,
    EVERY_10_MINUTES;

    public static PaymentFrequency fromNullable(String value) {
        if (value == null || value.isBlank()) {
            return WEEKLY;
        }
        return PaymentFrequency.valueOf(value.trim().toUpperCase(Locale.ROOT));
    }

    public boolean isProductionAllowed() {
        return this != EVERY_5_MINUTES && this != EVERY_10_MINUTES;
    }
}
