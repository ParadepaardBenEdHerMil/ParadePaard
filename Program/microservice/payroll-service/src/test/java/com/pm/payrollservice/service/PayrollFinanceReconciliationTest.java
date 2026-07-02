package com.pm.payrollservice.service;

import com.pm.payrollservice.dto.FinanceBreakdownRowDTO;
import com.pm.payrollservice.dto.FinanceOverviewDTO;
import com.pm.payrollservice.model.Payslip;
import com.pm.payrollservice.model.PayslipStatus;
import com.pm.payrollservice.repository.PayslipRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * F-3 / F-5 / F-9: finance figures must reconcile to the finalized payslips they
 * summarise, for any date range, and a corrected or cancelled payslip must not
 * corrupt the totals.
 *
 * <p>The finance read-model only counts {@code RELEASED} / {@code APPROVED} payslips.
 * A payslip parked in any other status (e.g. {@code DISPUTED} pending a correction, or
 * {@code PENDING_REVIEW}) is treated as not-yet-final and is excluded — that is how a
 * cancelled or superseded slip drops out of the reconciliation. A correction is a new
 * finalized slip that replaces the disputed original, and the total then reflects the
 * corrected figure exactly once.
 */
class PayrollFinanceReconciliationTest {

    private final UUID companyId = UUID.randomUUID();

    @Test
    void overviewReconcilesToSumOfVisiblePayslipsForAnArbitraryRange() {
        LocalDate from = LocalDate.of(2026, 3, 10);
        LocalDate to = LocalDate.of(2026, 4, 20); // partial, cross-month range
        List<Payslip> visible = List.of(
                payslip(PayslipStatus.RELEASED, "1000.00", "800.00", "200.00", "40.00", LocalDate.of(2026, 3, 31)),
                payslip(PayslipStatus.APPROVED, "1500.00", "1180.00", "320.00", "60.00", LocalDate.of(2026, 4, 15))
        );
        PayrollFinanceService service = serviceReturning(from, to, visible);

        FinanceOverviewDTO dto = service.overview(companyId, from, to);

        assertThat(dto.getTotalGross()).isEqualByComparingTo("2500.00");
        assertThat(dto.getTotalNet()).isEqualByComparingTo("1980.00");
        assertThat(dto.getTotalLoonheffing()).isEqualByComparingTo("520.00");
        assertThat(dto.getTotalHours()).isEqualByComparingTo("100.00");
        assertThat(dto.getPayslipCount()).isEqualTo(2);
    }

    @Test
    void nonFinalStatusesAreExcludedFromTotals() {
        LocalDate from = LocalDate.of(2026, 1, 1);
        LocalDate to = LocalDate.of(2026, 12, 31);
        List<Payslip> mixed = List.of(
                payslip(PayslipStatus.RELEASED, "1000.00", "800.00", "200.00", "40.00", LocalDate.of(2026, 5, 31)),
                payslip(PayslipStatus.DISPUTED, "999.99", "0.00", "0.00", "40.00", LocalDate.of(2026, 5, 31)),
                payslip(PayslipStatus.PENDING_REVIEW, "500.00", "400.00", "100.00", "20.00", LocalDate.of(2026, 5, 31)),
                payslip(PayslipStatus.NEEDS_ATTENTION, "123.45", "0.00", "0.00", "10.00", LocalDate.of(2026, 5, 31))
        );
        PayrollFinanceService service = serviceReturning(from, to, mixed);

        FinanceOverviewDTO dto = service.overview(companyId, from, to);

        // Only the single RELEASED slip counts.
        assertThat(dto.getTotalGross()).isEqualByComparingTo("1000.00");
        assertThat(dto.getPayslipCount()).isEqualTo(1);
    }

    @Test
    void correctedPayslipIsCountedOnce_disputedOriginalDropsOut() {
        LocalDate from = LocalDate.of(2026, 6, 1);
        LocalDate to = LocalDate.of(2026, 6, 30);
        UUID employee = UUID.randomUUID();
        // Original was wrong (2500) -> parked as DISPUTED; corrected RELEASED slip (2000) supersedes it.
        Payslip disputedOriginal = payslip(PayslipStatus.DISPUTED, "2500.00", "1900.00", "600.00", "100.00", LocalDate.of(2026, 6, 30));
        disputedOriginal.setUserId(employee);
        Payslip corrected = payslip(PayslipStatus.RELEASED, "2000.00", "1600.00", "400.00", "80.00", LocalDate.of(2026, 6, 30));
        corrected.setUserId(employee);
        PayrollFinanceService service = serviceReturning(from, to, List.of(disputedOriginal, corrected));

        FinanceOverviewDTO dto = service.overview(companyId, from, to);

        assertThat(dto.getTotalGross()).isEqualByComparingTo("2000.00");
        assertThat(dto.getTotalNet()).isEqualByComparingTo("1600.00");
        assertThat(dto.getPayslipCount()).isEqualTo(1);
        assertThat(dto.getEmployeeCount()).isEqualTo(1);
    }

    @Test
    void breakdownRowsSumBackToOverviewTotals() {
        LocalDate from = LocalDate.of(2026, 1, 1);
        LocalDate to = LocalDate.of(2026, 12, 31);
        List<Payslip> visible = List.of(
                payslip(PayslipStatus.RELEASED, "1000.00", "800.00", "200.00", "40.00", LocalDate.of(2026, 3, 31)),
                payslip(PayslipStatus.RELEASED, "1500.00", "1180.00", "320.00", "60.00", LocalDate.of(2026, 4, 30)),
                payslip(PayslipStatus.APPROVED, "800.00", "640.00", "160.00", "32.00", LocalDate.of(2026, 5, 31))
        );
        PayrollFinanceService service = serviceReturning(from, to, visible);

        FinanceOverviewDTO overview = service.overview(companyId, from, to);
        List<FinanceBreakdownRowDTO> rows = service.breakdown(companyId, from, to, "EMPLOYEE");

        BigDecimal grossFromRows = rows.stream()
                .map(FinanceBreakdownRowDTO::getGross)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal loonheffingFromRows = rows.stream()
                .map(FinanceBreakdownRowDTO::getLoonheffing)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        assertThat(grossFromRows).isEqualByComparingTo(overview.getTotalGross());
        assertThat(loonheffingFromRows).isEqualByComparingTo(overview.getTotalLoonheffing());
    }

    @Test
    void nullCompanyIdIsRejected() {
        PayrollFinanceService service = new PayrollFinanceService(mock(PayslipRepository.class));

        assertThatThrownBy(() -> service.overview(null, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("companyId");
    }

    // ---- helpers ----

    private PayrollFinanceService serviceReturning(LocalDate from, LocalDate to, List<Payslip> payslips) {
        PayslipRepository repo = mock(PayslipRepository.class);
        when(repo.findByCompanyIdAndDateOfIssueBetweenOrderByDateOfIssueAsc(companyId, from, to))
                .thenReturn(payslips);
        return new PayrollFinanceService(repo);
    }

    private Payslip payslip(PayslipStatus status, String gross, String net, String loonheffing,
                            String hours, LocalDate dateOfIssue) {
        Payslip p = new Payslip();
        p.setUserId(UUID.randomUUID());
        p.setStatus(status);
        p.setDateOfIssue(dateOfIssue);
        p.setFunctionName("Bartender");
        p.setTotalGrossAmount(new BigDecimal(gross));
        p.setTotalNetAmount(new BigDecimal(net));
        p.setLoonheffingWithheld(new BigDecimal(loonheffing));
        p.setTotalHoursWorked(new BigDecimal(hours));
        p.setHolidayAllowancePercentage(new BigDecimal("8.00"));
        return p;
    }
}
