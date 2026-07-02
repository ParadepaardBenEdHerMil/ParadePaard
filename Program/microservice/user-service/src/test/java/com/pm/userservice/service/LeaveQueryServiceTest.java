package com.pm.userservice.service;

import com.pm.userservice.model.LeaveRequest;
import com.pm.userservice.model.LeaveStatus;
import com.pm.userservice.model.LeaveType;
import com.pm.userservice.repository.LeaveRequestRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Cross-service leave read-model: paid/unpaid hours for a period (payroll feed) and
 * overlap detection (roster clash). Only APPROVED leave counts; hours are pro-rated to
 * the days inside the queried range.
 */
class LeaveQueryServiceTest {

    private final LeaveRequestRepository repo = mock(LeaveRequestRepository.class);
    private final LeaveQueryService service = new LeaveQueryService(repo);

    private final UUID user = UUID.randomUUID();

    private LeaveRequest leave(LeaveType type, String start, String end, int hours) {
        LeaveRequest lr = new LeaveRequest();
        lr.setRequestId(UUID.randomUUID());
        lr.setType(type);
        lr.setStartDate(LocalDate.parse(start));
        lr.setEndDate(LocalDate.parse(end));
        lr.setHours(hours);
        lr.setStatus(LeaveStatus.APPROVED);
        return lr;
    }

    private void givenApproved(LeaveRequest... requests) {
        when(repo.findByUser_UserIdAndStatus(user, LeaveStatus.APPROVED)).thenReturn(List.of(requests));
    }

    @Test
    void holidayInRangeCountsAsPaid() {
        givenApproved(leave(LeaveType.VACATION, "2026-06-01", "2026-06-02", 16));

        LeaveQueryService.LeaveHours hours = service.approvedLeaveHours(
                user, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30));

        assertThat(hours.paidHours()).isEqualByComparingTo("16.00");
        assertThat(hours.unpaidHours()).isEqualByComparingTo("0.00");
    }

    @Test
    void unpaidLeaveIsReportedSeparately() {
        givenApproved(leave(LeaveType.UNPAID, "2026-06-10", "2026-06-10", 8));

        LeaveQueryService.LeaveHours hours = service.approvedLeaveHours(
                user, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30));

        assertThat(hours.paidHours()).isEqualByComparingTo("0.00");
        assertThat(hours.unpaidHours()).isEqualByComparingTo("8.00");
    }

    @Test
    void sickLeaveIsReportedSeparatelyFromHoliday() {
        givenApproved(leave(LeaveType.SICK, "2026-06-05", "2026-06-05", 8));

        LeaveQueryService.LeaveHours hours = service.approvedLeaveHours(
                user, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30));

        assertThat(hours.sickHours()).isEqualByComparingTo("8.00");
        assertThat(hours.paidHours()).isEqualByComparingTo("0.00");
    }

    @Test
    void hoursAreProRatedToTheDaysInsideTheRange() {
        // 10-day leave (May 28 - Jun 6), 80h; 6 of its days (Jun 1-6) fall in range -> 80 * 6/10 = 48h.
        givenApproved(leave(LeaveType.VACATION, "2026-05-28", "2026-06-06", 80));

        LeaveQueryService.LeaveHours hours = service.approvedLeaveHours(
                user, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30));

        assertThat(hours.paidHours()).isEqualByComparingTo("48.00");
    }

    @Test
    void leaveEntirelyOutsideRangeContributesNothing() {
        givenApproved(leave(LeaveType.VACATION, "2026-05-01", "2026-05-03", 24));

        LeaveQueryService.LeaveHours hours = service.approvedLeaveHours(
                user, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30));

        assertThat(hours.paidHours()).isEqualByComparingTo("0.00");
    }

    @Test
    void overlapDetectionIsTrueWhenLeaveTouchesRange() {
        givenApproved(leave(LeaveType.VACATION, "2026-06-15", "2026-06-16", 16));

        assertThat(service.hasApprovedLeaveOverlapping(
                user, LocalDate.of(2026, 6, 16), LocalDate.of(2026, 6, 16))).isTrue();
    }

    @Test
    void overlapDetectionIsFalseWhenNoLeaveInRange() {
        givenApproved(leave(LeaveType.VACATION, "2026-06-15", "2026-06-16", 16));

        assertThat(service.hasApprovedLeaveOverlapping(
                user, LocalDate.of(2026, 6, 20), LocalDate.of(2026, 6, 21))).isFalse();
    }
}
