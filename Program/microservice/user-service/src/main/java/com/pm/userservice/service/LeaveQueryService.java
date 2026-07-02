package com.pm.userservice.service;

import com.pm.userservice.model.LeaveRequest;
import com.pm.userservice.model.LeaveStatus;
import com.pm.userservice.model.LeaveType;
import com.pm.userservice.repository.LeaveRequestRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Read-model over approved leave, consumed cross-service:
 * <ul>
 *   <li>payroll asks for leave hours in a pay period, split by pay treatment
 *       (holiday/other paid at full rate, sick at its own rate, unpaid) — the leave → payroll feed;</li>
 *   <li>planning asks whether an employee is on approved leave overlapping a shift — leave ↔ roster.</li>
 * </ul>
 *
 * <p>Only {@link LeaveStatus#APPROVED} requests count. Hours are pro-rated by the share of the
 * leave's days that fall inside the requested range, so a request straddling a period boundary
 * only contributes the hours for the days inside it. Leave types are kept separate because they
 * are paid differently: {@link LeaveType#SICK} is often paid at a reduced CAO percentage and
 * {@link LeaveType#UNPAID} not at all — folding them into normal hours would mis-pay.
 */
@Service
public class LeaveQueryService {

    private final LeaveRequestRepository leaveRepo;

    public LeaveQueryService(LeaveRequestRepository leaveRepo) {
        this.leaveRepo = leaveRepo;
    }

    @Transactional(readOnly = true)
    public LeaveHours approvedLeaveHours(UUID userId, LocalDate from, LocalDate to) {
        BigDecimal paid = BigDecimal.ZERO;   // holiday + parental + other: full rate
        BigDecimal sick = BigDecimal.ZERO;   // sick: its own rate
        BigDecimal unpaid = BigDecimal.ZERO; // unpaid: no pay
        for (LeaveRequest lr : leaveRepo.findByUser_UserIdAndStatus(userId, LeaveStatus.APPROVED)) {
            BigDecimal hours = proratedHours(lr, from, to);
            if (hours.signum() <= 0) {
                continue;
            }
            if (lr.getType() == LeaveType.UNPAID) {
                unpaid = unpaid.add(hours);
            } else if (lr.getType() == LeaveType.SICK) {
                sick = sick.add(hours);
            } else {
                paid = paid.add(hours);
            }
        }
        return new LeaveHours(
                paid.setScale(2, RoundingMode.HALF_UP),
                sick.setScale(2, RoundingMode.HALF_UP),
                unpaid.setScale(2, RoundingMode.HALF_UP));
    }

    @Transactional(readOnly = true)
    public boolean hasApprovedLeaveOverlapping(UUID userId, LocalDate from, LocalDate to) {
        return leaveRepo.findByUser_UserIdAndStatus(userId, LeaveStatus.APPROVED).stream()
                .anyMatch(lr -> overlaps(lr.getStartDate(), lr.getEndDate(), from, to));
    }

    private BigDecimal proratedHours(LeaveRequest lr, LocalDate from, LocalDate to) {
        LocalDate start = lr.getStartDate();
        LocalDate end = lr.getEndDate();
        if (start == null || end == null || lr.getHours() == null || end.isBefore(start)) {
            return BigDecimal.ZERO;
        }
        LocalDate overlapStart = start.isBefore(from) ? from : start;
        LocalDate overlapEnd = end.isAfter(to) ? to : end;
        if (overlapEnd.isBefore(overlapStart)) {
            return BigDecimal.ZERO;
        }
        long totalDays = ChronoUnit.DAYS.between(start, end) + 1;
        long overlapDays = ChronoUnit.DAYS.between(overlapStart, overlapEnd) + 1;
        if (overlapDays >= totalDays) {
            return BigDecimal.valueOf(lr.getHours());
        }
        return BigDecimal.valueOf(lr.getHours())
                .multiply(BigDecimal.valueOf(overlapDays))
                .divide(BigDecimal.valueOf(totalDays), 2, RoundingMode.HALF_UP);
    }

    private static boolean overlaps(LocalDate start, LocalDate end, LocalDate from, LocalDate to) {
        return start != null && end != null && !start.isAfter(to) && !end.isBefore(from);
    }

    /** Approved-leave hours within a range, split by pay treatment. */
    public record LeaveHours(BigDecimal paidHours, BigDecimal sickHours, BigDecimal unpaidHours) {
    }
}
