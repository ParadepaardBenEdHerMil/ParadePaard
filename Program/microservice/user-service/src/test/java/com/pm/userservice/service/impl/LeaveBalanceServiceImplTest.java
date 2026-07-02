package com.pm.userservice.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pm.userservice.dto.LeaveBalanceResponseDTO;
import com.pm.userservice.dto.OnboardingReviewContractSetupDraftDTO;
import com.pm.userservice.exception.InsufficientLeaveBalanceException;
import com.pm.userservice.model.LeaveBalance;
import com.pm.userservice.model.LeaveType;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.LeaveBalanceRepository;
import com.pm.userservice.repository.UserRepository;
import com.pm.userservice.service.StatutoryLeaveEntitlement;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LeaveBalanceServiceImplTest {

    private final LeaveBalanceRepository repo = mock(LeaveBalanceRepository.class);
    private final UserRepository userRepo = mock(UserRepository.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final LeaveBalanceServiceImpl service = new LeaveBalanceServiceImpl(repo, userRepo, objectMapper);

    private final UUID user = UUID.randomUUID();
    private final UUID company = UUID.randomUUID();

    private LeaveBalance balance(int entitled, int used) {
        LeaveBalance b = new LeaveBalance();
        b.setId(UUID.randomUUID());
        b.setUserId(user);
        b.setCompanyId(company);
        b.setYear(2026);
        b.setEntitledHours(entitled);
        b.setUsedHours(used);
        return b;
    }

    private User userWithWeeklyHours(String hoursPerWeek) throws Exception {
        OnboardingReviewContractSetupDraftDTO draft = new OnboardingReviewContractSetupDraftDTO();
        draft.setHoursPerWeek(hoursPerWeek);
        User u = new User();
        u.setUserId(user);
        u.setCompanyId(company);
        u.setOnboardingReviewContractSetupJson(objectMapper.writeValueAsString(draft));
        return u;
    }

    @Test
    void getBalanceUsesFullTimeFallbackWhenWeeklyHoursUnknown() {
        when(repo.findByUserIdAndYear(user, 2026)).thenReturn(Optional.empty());
        when(userRepo.findByUserId(user)).thenReturn(Optional.empty());
        when(repo.save(any(LeaveBalance.class))).thenAnswer(inv -> inv.getArgument(0));

        LeaveBalanceResponseDTO dto = service.getBalance(user, 2026);

        assertThat(dto.getEntitledHours()).isEqualTo(StatutoryLeaveEntitlement.DEFAULT_FULL_TIME_HOURS);
        assertThat(dto.getRemainingHours()).isEqualTo(StatutoryLeaveEntitlement.DEFAULT_FULL_TIME_HOURS);
    }

    @Test
    void getBalanceDerivesEntitlementFromContractedWeeklyHours() throws Exception {
        when(repo.findByUserIdAndYear(user, 2026)).thenReturn(Optional.empty());
        when(userRepo.findByUserId(user)).thenReturn(Optional.of(userWithWeeklyHours("24")));
        when(repo.save(any(LeaveBalance.class))).thenAnswer(inv -> inv.getArgument(0));

        LeaveBalanceResponseDTO dto = service.getBalance(user, 2026);

        // NL statutory: 4 x 24h = 96h.
        assertThat(dto.getEntitledHours()).isEqualTo(96);
    }

    @Test
    void fullTimeThirtyEightHourWeekYields152() throws Exception {
        when(repo.findByUserIdAndYear(user, 2026)).thenReturn(Optional.empty());
        when(userRepo.findByUserId(user)).thenReturn(Optional.of(userWithWeeklyHours("38")));
        when(repo.save(any(LeaveBalance.class))).thenAnswer(inv -> inv.getArgument(0));

        LeaveBalanceResponseDTO dto = service.getBalance(user, 2026);

        assertThat(dto.getEntitledHours()).isEqualTo(152);
    }

    @Test
    void accrueAddsEntitlement() {
        when(repo.findByUserIdAndYear(user, 2026)).thenReturn(Optional.of(balance(100, 0)));
        when(repo.save(any(LeaveBalance.class))).thenAnswer(inv -> inv.getArgument(0));

        LeaveBalanceResponseDTO dto = service.accrue(user, company, 2026, 40);

        assertThat(dto.getEntitledHours()).isEqualTo(140);
        assertThat(dto.getRemainingHours()).isEqualTo(140);
    }

    @Test
    void reserveDeductsHolidayHours() {
        LeaveBalance b = balance(100, 0);
        when(repo.findByUserIdAndYear(user, 2026)).thenReturn(Optional.of(b));
        when(repo.save(any(LeaveBalance.class))).thenAnswer(inv -> inv.getArgument(0));

        service.reserveForApproval(user, company, 2026, 24, LeaveType.VACATION);

        assertThat(b.getUsedHours()).isEqualTo(24);
        assertThat(b.getRemainingHours()).isEqualTo(76);
    }

    @Test
    void reserveThrowsWhenBalanceInsufficient() {
        when(repo.findByUserIdAndYear(user, 2026)).thenReturn(Optional.of(balance(16, 0)));

        assertThatThrownBy(() -> service.reserveForApproval(user, company, 2026, 24, LeaveType.VACATION))
                .isInstanceOf(InsufficientLeaveBalanceException.class);
    }

    @Test
    void reserveIsNoOpForNonHolidayLeave() {
        service.reserveForApproval(user, company, 2026, 24, LeaveType.SICK);
        service.reserveForApproval(user, company, 2026, 24, LeaveType.UNPAID);

        verify(repo, never()).save(any());
    }

    @Test
    void restoreGivesHolidayHoursBack() {
        LeaveBalance b = balance(100, 24);
        when(repo.findByUserIdAndYear(user, 2026)).thenReturn(Optional.of(b));
        when(repo.save(any(LeaveBalance.class))).thenAnswer(inv -> inv.getArgument(0));

        service.restore(user, 2026, 24, LeaveType.VACATION);

        assertThat(b.getUsedHours()).isZero();
        assertThat(b.getRemainingHours()).isEqualTo(100);
    }

    @Test
    void restoreNeverGoesNegative() {
        LeaveBalance b = balance(100, 8);
        when(repo.findByUserIdAndYear(user, 2026)).thenReturn(Optional.of(b));
        when(repo.save(any(LeaveBalance.class))).thenAnswer(inv -> inv.getArgument(0));

        service.restore(user, 2026, 24, LeaveType.VACATION);

        assertThat(b.getUsedHours()).isZero();
    }

    @Test
    void restoreIsNoOpForNonHolidayLeave() {
        service.restore(user, 2026, 24, LeaveType.SICK);
        verify(repo, never()).save(any());
    }
}
