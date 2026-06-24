package com.pm.payrollservice.repository;

import com.pm.payrollservice.model.Payslip;
import com.pm.payrollservice.model.PayslipStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PayslipRepository extends JpaRepository<Payslip, UUID>{
    boolean existsByWeekBasedYearAndWeekNumberAndUserId(int weekBasedYear, int weekNumber, UUID userId);

    List<Payslip> findByWeekBasedYearAndWeekNumberAndUserId(int weekBasedYear, int weekNumber, UUID userId);

    List<Payslip> findByUserIdOrderByDateOfIssueDesc(UUID userId);

    List<Payslip> findByUserIdAndWeekBasedYearOrderByDateOfIssueAsc(UUID userId, int weekBasedYear);

    List<Payslip> findByCompanyIdAndWeekBasedYearOrderByDateOfIssueAsc(UUID companyId, int weekBasedYear);

    // Fiscal-year keyed lookups (genietingsmoment/kasstelsel) for the jaaropgaaf,
    // verzamelloonstaat and annual totals; replace the weekBasedYear variants for
    // annual attribution per the locked date model.
    List<Payslip> findByUserIdAndFiscalYearOrderByDateOfIssueAsc(UUID userId, int fiscalYear);

    List<Payslip> findByCompanyIdAndFiscalYearOrderByDateOfIssueAsc(UUID companyId, int fiscalYear);

    // Legacy rows created before paymentDate/fiscalYear existed; used by the
    // one-time startup backfill.
    List<Payslip> findByFiscalYearIsNull();

    List<Payslip> findByCompanyIdAndDateOfIssueBetweenOrderByDateOfIssueAsc(UUID companyId, LocalDate from, LocalDate to);

    List<Payslip> findByUserIdAndStatusOrderByDateOfIssueDesc(UUID userId, PayslipStatus status);

    Optional<Payslip> findByUserIdAndPayPeriodKey(UUID userId, String payPeriodKey);

    Optional<Payslip> findTopByUserIdOrderByDateOfIssueDesc(UUID userId);

    List<Payslip> findByStatusAndAvailableToUserAtLessThanEqual(PayslipStatus status, LocalDate availableToUserAt);

    List<Payslip> findByStatusAndAvailableToUserAtLessThan(PayslipStatus status, LocalDate availableToUserAt);

    List<Payslip> findByStatusAndAvailableToUserAt(PayslipStatus status, LocalDate availableToUserAt);

    List<Payslip> findByStatusOrderByDateOfIssueDesc(PayslipStatus status);

    List<Payslip> findByStatusInOrderByDateOfIssueDesc(List<PayslipStatus> statuses);
    Page<Payslip> findAllByOrderByDateOfIssueDesc(Pageable pageable);

    @Query("""
            select p
            from Payslip p
            where p.userId = :userId
              and (p.status in :statuses or p.status is null)
            order by p.dateOfIssue desc
            """)
    Page<Payslip> findVisibleByUserIdOrderByDateOfIssueDesc(
            @Param("userId") UUID userId,
            @Param("statuses") List<PayslipStatus> statuses,
            Pageable pageable
    );
}
