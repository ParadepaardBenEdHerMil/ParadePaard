package com.pm.payrollservice.service;

import com.pm.payrollservice.grpc.UserServiceGrpcClient;
import org.junit.jupiter.api.Test;
import user.LeaveHoursResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Orchestration for the leave → payroll feed: gRPC leave hours + the configured sick percentage
 * turned into leave pay, and a fail-open path when user-service is unavailable.
 */
class LeavePayServiceTest {

    private final UserServiceGrpcClient client = mock(UserServiceGrpcClient.class);
    private final UUID userId = UUID.randomUUID();
    private final LocalDate from = LocalDate.of(2026, 6, 1);
    private final LocalDate to = LocalDate.of(2026, 6, 30);

    private LeavePayService service(String sickPct) {
        return new LeavePayService(client, new BigDecimal(sickPct));
    }

    private LeaveHoursResponse hours(String paid, String sick, String unpaid) {
        return LeaveHoursResponse.newBuilder()
                .setPaidLeaveHours(paid)
                .setSickLeaveHours(sick)
                .setUnpaidLeaveHours(unpaid)
                .build();
    }

    @Test
    void computesLeavePayFromGrpcHoursAndSickPercentage() {
        when(client.getApprovedLeaveHours(anyString(), any(), any()))
                .thenReturn(hours("16.00", "8.00", "4.00"));

        LeavePayCalculator.LeavePay pay = service("70").leavePayFor(userId, from, to, new BigDecimal("20.00"));

        // holiday 16h*20 = 320; sick 8h*20*70% = 112; total 432
        assertThat(pay.paidLeavePay()).isEqualByComparingTo("320.00");
        assertThat(pay.sickLeavePay()).isEqualByComparingTo("112.00");
        assertThat(pay.totalLeavePay()).isEqualByComparingTo("432.00");
    }

    @Test
    void blankHourStringsAreTreatedAsZero() {
        when(client.getApprovedLeaveHours(anyString(), any(), any()))
                .thenReturn(hours("", "", ""));

        LeavePayCalculator.LeavePay pay = service("100").leavePayFor(userId, from, to, new BigDecimal("20.00"));

        assertThat(pay.totalLeavePay()).isEqualByComparingTo("0.00");
    }

    @Test
    void failsOpenWhenUserServiceUnavailable() {
        when(client.getApprovedLeaveHours(anyString(), any(), any()))
                .thenThrow(new RuntimeException("user-service down"));

        LeavePayCalculator.LeavePay pay = service("70").leavePayFor(userId, from, to, new BigDecimal("20.00"));

        assertThat(pay.totalLeavePay()).isEqualByComparingTo("0.00");
    }
}
