package com.pm.userservice.service;

import com.pm.userservice.dto.LeaveBalanceResponseDTO;
import com.pm.userservice.model.LeaveType;

import java.util.UUID;

/**
 * Tracks each employee's holiday-hours balance per year: how many hours they are
 * entitled to, how many approved holiday hours they have used, and how many remain.
 * Only {@link LeaveType#VACATION} draws down the balance.
 */
public interface LeaveBalanceService {

    /** Current balance for the employee/year (created with the default entitlement if none yet). */
    LeaveBalanceResponseDTO getBalance(UUID userId, int year);

    /** Add entitlement hours (annual grant, monthly accrual, or prior-year carry-over). */
    LeaveBalanceResponseDTO accrue(UUID userId, UUID companyId, int year, int hours);

    /**
     * Reserve (deduct) hours when a holiday request is approved. No-op for non-holiday types.
     * Throws if the remaining balance is insufficient.
     */
    void reserveForApproval(UUID userId, UUID companyId, int year, int hours, LeaveType type);

    /** Give hours back when an approved holiday request is cancelled. No-op for non-holiday types. */
    void restore(UUID userId, int year, int hours, LeaveType type);
}
