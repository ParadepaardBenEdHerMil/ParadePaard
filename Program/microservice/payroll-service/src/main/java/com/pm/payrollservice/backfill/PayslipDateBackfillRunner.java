package com.pm.payrollservice.backfill;

import com.pm.payrollservice.model.Payslip;
import com.pm.payrollservice.repository.PayslipRepository;
import com.pm.payrollservice.service.PayslipCalculator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * One-time, idempotent startup backfill for payslips created before the
 * {@code paymentDate} / {@code fiscalYear} date model existed.
 *
 * <p>For every row whose {@code fiscalYear} is still null it derives the
 * genietingsmoment ({@code paymentDate}) and {@code fiscalYear} the same way
 * {@link PayslipCalculator#applyGenietingsmoment(Payslip)} does for live
 * payslips, so historical jaaropgaven attribute wages to the correct tax year.
 * It also backfills {@code fiscalWage} from the gross amount where it is missing
 * (P2-7), matching the jaaropgaaf fallback so older statements stop silently
 * showing gross instead of fiscaal loon.
 *
 * <p>Runs after the schema is in place, only ever touches rows that lack the new
 * fields, and never fails startup: any error is logged and swallowed.
 */
@Component
@Order(0)
public class PayslipDateBackfillRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(PayslipDateBackfillRunner.class);

    private final PayslipRepository payslipRepository;

    public PayslipDateBackfillRunner(PayslipRepository payslipRepository) {
        this.payslipRepository = payslipRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            List<Payslip> legacy = payslipRepository.findByFiscalYearIsNull();
            if (legacy.isEmpty()) {
                return;
            }
            int fiscalYearSet = 0;
            int fiscalWageSet = 0;
            for (Payslip p : legacy) {
                PayslipCalculator.applyGenietingsmoment(p);
                if (p.getFiscalYear() != null) {
                    fiscalYearSet++;
                }
                if (p.getFiscalWage() == null && p.getTotalGrossAmount() != null) {
                    p.setFiscalWage(p.getTotalGrossAmount());
                    fiscalWageSet++;
                }
            }
            payslipRepository.saveAll(legacy);
            log.info("Payslip date backfill: scanned {} legacy rows, set fiscalYear on {}, fiscalWage on {}",
                    legacy.size(), fiscalYearSet, fiscalWageSet);
        } catch (Exception ex) {
            log.warn("Payslip date backfill skipped due to an error; legacy rows may lack fiscalYear", ex);
        }
    }
}
