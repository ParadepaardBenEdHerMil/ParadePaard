package com.pm.payrollservice.service;

import com.pm.payrollservice.model.Payslip;
import com.pm.payrollservice.model.PayslipStatus;
import com.pm.payrollservice.repository.PayslipRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class PayslipReleaseService {
    private static final Logger log = LoggerFactory.getLogger(PayslipReleaseService.class);
    private final PayslipRepository payslipRepository;

    public PayslipReleaseService(PayslipRepository payslipRepository) {
        this.payslipRepository = payslipRepository;
    }

    @Transactional
    public int releaseDuePayslips(ZonedDateTime now, LocalTime payoutTime) {
        LocalDate today = now.toLocalDate();
        boolean canReleaseToday = !now.toLocalTime().isBefore(payoutTime);

        List<Payslip> due = new ArrayList<>();
        due.addAll(payslipRepository.findByStatusAndAvailableToUserAtLessThan(
                PayslipStatus.PENDING_REVIEW,
                today
        ));
        due.addAll(payslipRepository.findByStatusAndAvailableToUserAtLessThan(
                PayslipStatus.PENDING_APPROVAL,
                today
        ));
        if (canReleaseToday) {
            due.addAll(payslipRepository.findByStatusAndAvailableToUserAt(
                    PayslipStatus.PENDING_REVIEW,
                    today
            ));
            due.addAll(payslipRepository.findByStatusAndAvailableToUserAt(
                    PayslipStatus.PENDING_APPROVAL,
                    today
            ));
        }
        if (due.isEmpty()) return 0;

        for (Payslip p : due) {
            p.setStatus(PayslipStatus.RELEASED);
            if (p.getGeneratedAt() == null) {
                p.setGeneratedAt(OffsetDateTime.now());
            }
        }

        payslipRepository.saveAll(due);
        log.info("Released {} payslips (date<{} plus date=={} allowed={})", due.size(), today, today, canReleaseToday);
        return due.size();
    }
}
