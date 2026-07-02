package com.pm.planningservice.service;

import java.time.LocalDateTime;

/**
 * Time-window overlap test used to stop an employee being double-booked onto two
 * shifts that run at the same time (PL-4). Two shifts overlap when each starts
 * before the other ends. Touching shifts (one ends exactly when the next starts,
 * e.g. back-to-back) do <b>not</b> overlap.
 */
public final class ShiftOverlap {

    private ShiftOverlap() {
    }

    public static boolean overlaps(LocalDateTime startA, LocalDateTime endA,
                                   LocalDateTime startB, LocalDateTime endB) {
        if (startA == null || endA == null || startB == null || endB == null) {
            return false;
        }
        return startA.isBefore(endB) && startB.isBefore(endA);
    }
}
