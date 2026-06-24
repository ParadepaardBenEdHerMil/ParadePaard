package com.pm.payrollservice.model;

public enum JaaropgaafStatus {
    /** Computed live from current payslips; figures may still change. */
    PROVISIONAL,
    /** Finalized and frozen by the employer; the stored PDF is retained. */
    FINAL
}
