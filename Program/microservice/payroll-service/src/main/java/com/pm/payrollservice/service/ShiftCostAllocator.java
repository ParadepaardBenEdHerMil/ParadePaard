package com.pm.payrollservice.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Allocates a payslip's actual employer cost across the shifts of a pay period,
 * pro-rata by weight (gross wage; the caller passes hours as a fallback when all
 * grosses are zero). The returned amounts sum exactly to {@code total} (any
 * rounding remainder is added to the largest-weight shift), so ACTUAL records
 * reconcile to the payslip.
 */
public final class ShiftCostAllocator {
    private ShiftCostAllocator() {}

    public static List<BigDecimal> allocate(BigDecimal total, List<BigDecimal> weights) {
        int n = weights.size();
        List<BigDecimal> out = new ArrayList<>(n);
        BigDecimal t = total == null ? BigDecimal.ZERO : total.setScale(2, RoundingMode.HALF_UP);
        if (n == 0) {
            return out;
        }
        BigDecimal sum = BigDecimal.ZERO;
        for (BigDecimal w : weights) {
            sum = sum.add(w == null ? BigDecimal.ZERO : w);
        }
        if (sum.signum() <= 0) {
            BigDecimal each = t.divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP);
            for (int i = 0; i < n; i++) {
                out.add(each);
            }
        } else {
            for (int i = 0; i < n; i++) {
                BigDecimal w = weights.get(i) == null ? BigDecimal.ZERO : weights.get(i);
                out.add(t.multiply(w).divide(sum, 2, RoundingMode.HALF_UP));
            }
        }
        BigDecimal allocated = BigDecimal.ZERO;
        for (BigDecimal a : out) {
            allocated = allocated.add(a);
        }
        BigDecimal diff = t.subtract(allocated);
        if (diff.signum() != 0) {
            int idx = largestWeightIndex(weights);
            out.set(idx, out.get(idx).add(diff));
        }
        return out;
    }

    private static int largestWeightIndex(List<BigDecimal> weights) {
        int idx = 0;
        BigDecimal best = null;
        for (int i = 0; i < weights.size(); i++) {
            BigDecimal w = weights.get(i) == null ? BigDecimal.ZERO : weights.get(i);
            if (best == null || w.compareTo(best) > 0) {
                best = w;
                idx = i;
            }
        }
        return idx;
    }
}
