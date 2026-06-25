package com.pm.payrollservice.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ShiftCostAllocatorTest {

    private static BigDecimal sum(List<BigDecimal> xs) {
        BigDecimal t = BigDecimal.ZERO;
        for (BigDecimal x : xs) t = t.add(x);
        return t;
    }

    @Test
    void allocatesProRataByWeight() {
        List<BigDecimal> out = ShiftCostAllocator.allocate(
                new BigDecimal("100.00"), List.of(new BigDecimal("60"), new BigDecimal("40")));
        assertEquals(0, new BigDecimal("60.00").compareTo(out.get(0)));
        assertEquals(0, new BigDecimal("40.00").compareTo(out.get(1)));
        assertEquals(0, new BigDecimal("100.00").compareTo(sum(out)));
    }

    @Test
    void roundingRemainderKeepsTheSumExact() {
        List<BigDecimal> out = ShiftCostAllocator.allocate(
                new BigDecimal("100.00"),
                List.of(new BigDecimal("1"), new BigDecimal("1"), new BigDecimal("1")));
        // 33.33 each leaves 0.01; the remainder lands on the (first) largest weight.
        assertEquals(0, new BigDecimal("100.00").compareTo(sum(out)));
        assertEquals(0, new BigDecimal("33.34").compareTo(out.get(0)));
    }

    @Test
    void zeroWeightsFallBackToEqualSplit() {
        List<BigDecimal> out = ShiftCostAllocator.allocate(
                new BigDecimal("50.00"), List.of(BigDecimal.ZERO, BigDecimal.ZERO));
        assertEquals(0, new BigDecimal("25.00").compareTo(out.get(0)));
        assertEquals(0, new BigDecimal("50.00").compareTo(sum(out)));
    }
}
