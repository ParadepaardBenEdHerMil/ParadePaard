package com.pm.payrollservice.service;

import com.pm.payrollservice.grpc.UserServiceGrpcClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import user.LeaveHoursResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Resolves an employee's approved-leave pay for a pay period: fetches the leave hours from
 * user-service (split holiday/sick/unpaid) and turns them into pay via {@link LeavePayCalculator}.
 *
 * <p>Sick leave is paid at {@code payroll.sick-leave-pay-percentage} (default 100 so we never
 * under-pay by accident; set it to the figure the applicable CAO prescribes). Fails open: if
 * user-service is unavailable the period simply carries no leave pay rather than failing the run.
 */
@Service
public class LeavePayService {

    private static final Logger log = LoggerFactory.getLogger(LeavePayService.class);

    private final UserServiceGrpcClient userServiceGrpcClient;
    private final BigDecimal sickPayPercentage;

    public LeavePayService(UserServiceGrpcClient userServiceGrpcClient,
                           @Value("${payroll.sick-leave-pay-percentage:100}") BigDecimal sickPayPercentage) {
        this.userServiceGrpcClient = userServiceGrpcClient;
        this.sickPayPercentage = sickPayPercentage;
    }

    public LeavePayCalculator.LeavePay leavePayFor(UUID userId, LocalDate from, LocalDate to, BigDecimal hourlyWage) {
        try {
            LeaveHoursResponse hours = userServiceGrpcClient.getApprovedLeaveHours(userId.toString(), from, to);
            return LeavePayCalculator.compute(
                    decimal(hours.getPaidLeaveHours()),
                    decimal(hours.getSickLeaveHours()),
                    decimal(hours.getUnpaidLeaveHours()),
                    hourlyWage,
                    sickPayPercentage);
        } catch (RuntimeException ex) {
            log.warn("Could not load approved leave for user {} ({}..{}); no leave pay applied: {}",
                    userId, from, to, ex.getMessage());
            return LeavePayCalculator.compute(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    hourlyWage, sickPayPercentage);
        }
    }

    private static BigDecimal decimal(String value) {
        if (value == null || value.isBlank()) {
            return BigDecimal.ZERO;
        }
        return new BigDecimal(value.trim());
    }
}
