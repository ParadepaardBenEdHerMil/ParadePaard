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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PayrollFinanceServiceTest {

    private final UUID companyId = UUID.randomUUID();
    private final LocalDate from = LocalDate.of(2026, 1, 1);
    private final LocalDate to = LocalDate.of(2026, 12, 31);

    private Payslip samplePayslip() {
        Payslip p = new Payslip();
        p.setUserId(UUID.randomUUID());
        p.setStatus(PayslipStatus.RELEASED);
        p.setDateOfIssue(LocalDate.of(2026, 5, 31));
        p.setFunctionName("Bartender");
        p.setTotalGrossAmount(new BigDecimal("2000.00"));
        p.setTotalNetAmount(new BigDecimal("1600.00"));
        p.setWageTaxWithheldTest(new BigDecimal("400.00"));        // loonheffing
        p.setEmployeeZvwWithheld(new BigDecimal("97.00"));          // 4.85%
        p.setEmployerZvwLevy(new BigDecimal("122.00"));             // 6.10%
        p.setEmployerInsurancePremiums(new BigDecimal("225.60"));   // 11.28%
        p.setHolidayAllowancePercentage(new BigDecimal("8.00"));
        p.setTotalHoursWorked(new BigDecimal("100.00"));
        return p;
    }

    @Test
    void overviewAddsHolidayToEmployerCostAndEmployeeZvwToBelastingdienstTotal() {
        PayslipRepository repo = mock(PayslipRepository.class);
        when(repo.findByCompanyIdAndDateOfIssueBetweenOrderByDateOfIssueAsc(companyId, from, to))
                .thenReturn(List.of(samplePayslip()));

        FinanceOverviewDTO dto = new PayrollFinanceService(repo).overview(companyId, from, to);

        // Reserved vakantietoeslag = 2000.00 x 8% = 160.00
        assertThat(dto.getTotalHolidayAllowance()).isEqualByComparingTo("160.00");
        // To Belastingdienst = loonheffing 400 + employee Zvw 97 + employer Zvw 122 + premies 225.60
        assertThat(dto.getTotalToBelastingdienst()).isEqualByComparingTo("844.60");
        // Employer cost = gross 2000 + holiday 160 + employer Zvw 122 + premies 225.60
        assertThat(dto.getTotalEmployerCost()).isEqualByComparingTo("2507.60");
    }

    @Test
    void breakdownEmployerCostIncludesHolidayAllowance() {
        PayslipRepository repo = mock(PayslipRepository.class);
        when(repo.findByCompanyIdAndDateOfIssueBetweenOrderByDateOfIssueAsc(companyId, from, to))
                .thenReturn(List.of(samplePayslip()));

        List<FinanceBreakdownRowDTO> rows =
                new PayrollFinanceService(repo).breakdown(companyId, from, to, "FUNCTION");

        assertThat(rows).singleElement().satisfies(row ->
                // 2000 gross + 160 holiday + 122 employer Zvw + 225.60 premies
                assertThat(row.getEmployerCost()).isEqualByComparingTo("2507.60"));
    }
}
