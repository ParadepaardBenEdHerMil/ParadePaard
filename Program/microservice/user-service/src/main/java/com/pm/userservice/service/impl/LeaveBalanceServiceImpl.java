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
import com.pm.userservice.service.LeaveBalanceService;
import com.pm.userservice.service.StatutoryLeaveEntitlement;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

@Service
public class LeaveBalanceServiceImpl implements LeaveBalanceService {

    private final LeaveBalanceRepository balanceRepo;
    private final UserRepository userRepo;
    private final ObjectMapper objectMapper;

    public LeaveBalanceServiceImpl(LeaveBalanceRepository balanceRepo, UserRepository userRepo,
                                   ObjectMapper objectMapper) {
        this.balanceRepo = balanceRepo;
        this.userRepo = userRepo;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public LeaveBalanceResponseDTO getBalance(UUID userId, int year) {
        return toDTO(getOrCreate(userId, null, year));
    }

    @Override
    @Transactional
    public LeaveBalanceResponseDTO accrue(UUID userId, UUID companyId, int year, int hours) {
        if (hours < 0) {
            throw new IllegalArgumentException("accrued hours cannot be negative");
        }
        LeaveBalance balance = getOrCreate(userId, companyId, year);
        balance.setEntitledHours(balance.getEntitledHours() + hours);
        return toDTO(balanceRepo.save(balance));
    }

    @Override
    @Transactional
    public void reserveForApproval(UUID userId, UUID companyId, int year, int hours, LeaveType type) {
        if (type != LeaveType.VACATION || hours <= 0) {
            return;
        }
        LeaveBalance balance = getOrCreate(userId, companyId, year);
        if (balance.getRemainingHours() < hours) {
            throw new InsufficientLeaveBalanceException(
                    "Insufficient leave balance for user " + userId + " in " + year
                            + ": " + balance.getRemainingHours() + "h remaining, " + hours + "h requested");
        }
        balance.setUsedHours(balance.getUsedHours() + hours);
        balanceRepo.save(balance);
    }

    @Override
    @Transactional
    public void restore(UUID userId, int year, int hours, LeaveType type) {
        if (type != LeaveType.VACATION || hours <= 0) {
            return;
        }
        balanceRepo.findByUserIdAndYear(userId, year).ifPresent(balance -> {
            balance.setUsedHours(Math.max(0, balance.getUsedHours() - hours));
            balanceRepo.save(balance);
        });
    }

    private LeaveBalance getOrCreate(UUID userId, UUID companyId, int year) {
        return balanceRepo.findByUserIdAndYear(userId, year).orElseGet(() -> {
            User user = userRepo.findByUserId(userId).orElse(null);
            UUID resolvedCompany = companyId != null
                    ? companyId
                    : (user != null ? user.getCompanyId() : null);
            int entitled = StatutoryLeaveEntitlement.annualHoursFor(contractedWeeklyHours(user));

            LeaveBalance balance = new LeaveBalance();
            balance.setId(UUID.randomUUID());
            balance.setUserId(userId);
            balance.setCompanyId(resolvedCompany);
            balance.setYear(year);
            balance.setEntitledHours(entitled);
            balance.setUsedHours(0);
            return balanceRepo.save(balance);
        });
    }

    /**
     * The employee's contracted weekly hours, taken from the contract-setup captured at
     * onboarding (persisted as JSON on the user). Returns null when not yet captured, in
     * which case {@link StatutoryLeaveEntitlement} applies its full-time fallback.
     */
    private BigDecimal contractedWeeklyHours(User user) {
        if (user == null || user.getOnboardingReviewContractSetupJson() == null
                || user.getOnboardingReviewContractSetupJson().isBlank()) {
            return null;
        }
        try {
            OnboardingReviewContractSetupDraftDTO draft = objectMapper.readValue(
                    user.getOnboardingReviewContractSetupJson(), OnboardingReviewContractSetupDraftDTO.class);
            String hours = draft.getHoursPerWeek();
            if (hours == null || hours.isBlank()) {
                return null;
            }
            return new BigDecimal(hours.trim());
        } catch (Exception ignored) {
            return null;
        }
    }

    private LeaveBalanceResponseDTO toDTO(LeaveBalance balance) {
        LeaveBalanceResponseDTO dto = new LeaveBalanceResponseDTO();
        dto.setUserId(balance.getUserId());
        dto.setYear(balance.getYear());
        dto.setEntitledHours(balance.getEntitledHours());
        dto.setUsedHours(balance.getUsedHours());
        dto.setRemainingHours(balance.getRemainingHours());
        return dto;
    }
}
