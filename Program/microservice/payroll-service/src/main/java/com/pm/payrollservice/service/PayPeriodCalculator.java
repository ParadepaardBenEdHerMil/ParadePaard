package com.pm.payrollservice.service;

import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.time.temporal.WeekFields;
import java.util.Locale;

@Component
public class PayPeriodCalculator {
    public PayPeriod periodFor(String rawFrequency, LocalDate anchorDate) {
        String frequency = rawFrequency == null || rawFrequency.isBlank()
                ? "WEEKLY"
                : rawFrequency.trim().toUpperCase(Locale.ROOT);

        return switch (frequency) {
            case "DAILY" -> new PayPeriod("DAILY", anchorDate, anchorDate, "DAILY:" + anchorDate);
            case "BIWEEKLY" -> biweekly(anchorDate);
            case "FOUR_WEEKLY" -> fourWeekly(anchorDate);
            case "MONTHLY" -> monthly(anchorDate);
            case "EVERY_5_MINUTES" -> new PayPeriod("EVERY_5_MINUTES", anchorDate, anchorDate, "EVERY_5_MINUTES:" + anchorDate);
            case "EVERY_10_MINUTES" -> new PayPeriod("EVERY_10_MINUTES", anchorDate, anchorDate, "EVERY_10_MINUTES:" + anchorDate);
            default -> weekly(anchorDate);
        };
    }

    private PayPeriod weekly(LocalDate anchorDate) {
        LocalDate start = anchorDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate end = start.plusDays(6);
        WeekFields iso = WeekFields.ISO;
        int week = anchorDate.get(iso.weekOfWeekBasedYear());
        int year = anchorDate.get(iso.weekBasedYear());
        return new PayPeriod("WEEKLY", start, end, "WEEKLY:" + year + "-W" + week);
    }

    private PayPeriod biweekly(LocalDate anchorDate) {
        PayPeriod week = weekly(anchorDate);
        int isoWeek = anchorDate.get(WeekFields.ISO.weekOfWeekBasedYear());
        LocalDate start = isoWeek % 2 == 0 ? week.start().minusDays(7) : week.start();
        LocalDate end = start.plusDays(13);
        return new PayPeriod("BIWEEKLY", start, end, "BIWEEKLY:" + start + ":" + end);
    }

    private PayPeriod monthly(LocalDate anchorDate) {
        LocalDate start = anchorDate.withDayOfMonth(1);
        LocalDate end = anchorDate.withDayOfMonth(anchorDate.lengthOfMonth());
        return new PayPeriod(
                "MONTHLY",
                start,
                end,
                "MONTHLY:" + start.getYear() + "-" + String.format(Locale.ROOT, "%02d", start.getMonthValue())
        );
    }

    private PayPeriod fourWeekly(LocalDate anchorDate) {
        int payrollYear = resolveFourWeeklyYear(anchorDate);
        LocalDate cycleStart = fourWeeklyYearStart(payrollYear);
        long daysIntoCycle = ChronoUnit.DAYS.between(cycleStart, anchorDate);
        int periodNumber = (int) (daysIntoCycle / 28) + 1;
        LocalDate start = cycleStart.plusDays((long) (periodNumber - 1) * 28);
        LocalDate end = start.plusDays(27);
        return new PayPeriod(
                "FOUR_WEEKLY",
                start,
                end,
                "FOUR_WEEKLY:" + payrollYear + "-P" + String.format(Locale.ROOT, "%02d", periodNumber)
        );
    }

    private int resolveFourWeeklyYear(LocalDate anchorDate) {
        int year = anchorDate.getYear();
        LocalDate thisYearStart = fourWeeklyYearStart(year);
        if (anchorDate.isBefore(thisYearStart)) {
            return year - 1;
        }
        LocalDate nextYearStart = fourWeeklyYearStart(year + 1);
        if (!anchorDate.isBefore(nextYearStart)) {
            return year + 1;
        }
        return year;
    }

    private LocalDate fourWeeklyYearStart(int year) {
        LocalDate januaryFirst = LocalDate.of(year, 1, 1);
        return januaryFirst.with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
    }
}
