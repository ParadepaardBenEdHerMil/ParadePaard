package com.pm.payrollservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pm.payrollservice.dto.CompanySettingsDTO;
import com.pm.payrollservice.dto.JaaropgaafDTO;
import com.pm.payrollservice.dto.VerzamelloonstaatDTO;
import com.pm.payrollservice.model.Payslip;
import com.pm.payrollservice.model.PayslipStatus;
import com.pm.payrollservice.repository.JaaropgaafRepository;
import com.pm.payrollservice.repository.PayslipRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JaaropgaafServiceTest {

    private final UUID companyId = UUID.randomUUID();
    private final UUID employeeId = UUID.randomUUID();
    private final int year = 2026;

    private JaaropgaafService newService(PayslipRepository payslipRepository,
                                        JaaropgaafRepository jaaropgaafRepository,
                                        CompanySettingsClient companySettingsClient) {
        return new JaaropgaafService(
                payslipRepository,
                jaaropgaafRepository,
                companySettingsClient,
                mock(PayslipPdfService.class),
                new ObjectMapper());
    }

    @Test
    void buildForEmployeePopulatesEmployerNameAndAddress() {
        PayslipRepository payslipRepository = mock(PayslipRepository.class);
        JaaropgaafRepository jaaropgaafRepository = mock(JaaropgaafRepository.class);
        CompanySettingsClient companySettingsClient = mock(CompanySettingsClient.class);

        when(jaaropgaafRepository.findByCompanyIdAndUserIdAndYear(companyId, employeeId, year))
                .thenReturn(Optional.empty());

        Payslip payslip = new Payslip();
        payslip.setUserId(employeeId);
        payslip.setCompanyId(companyId);
        payslip.setStatus(PayslipStatus.RELEASED);
        payslip.setWeekBasedYear(year);
        payslip.setFiscalYear(year);
        payslip.setDateOfIssue(LocalDate.of(2026, 5, 31));
        payslip.setFiscalWage(new BigDecimal("2000.00"));
        payslip.setLoonheffingWithheld(new BigDecimal("400.00"));
        payslip.setTotalGrossAmount(new BigDecimal("2000.00"));
        payslip.setTotalNetAmount(new BigDecimal("1600.00"));
        when(payslipRepository.findByUserIdAndFiscalYearOrderByDateOfIssueAsc(employeeId, year))
                .thenReturn(List.of(payslip));

        CompanySettingsDTO settings = new CompanySettingsDTO();
        settings.setCompanyId(companyId.toString());
        settings.setName("JAM! B.V.");
        settings.setStreet("Keizersgracht 88");
        settings.setPostalCode("1015 CJ");
        settings.setCity("Amsterdam");
        when(companySettingsClient.getCompanySettings(companyId.toString())).thenReturn(settings);

        JaaropgaafService service = newService(payslipRepository, jaaropgaafRepository, companySettingsClient);
        JaaropgaafDTO dto = service.buildForEmployee(companyId, employeeId, year, true);

        assertThat(dto.getEmployerName()).isEqualTo("JAM! B.V.");
        assertThat(dto.getEmployerStreet()).isEqualTo("Keizersgracht 88");
        assertThat(dto.getEmployerPostalCode()).isEqualTo("1015 CJ");
        assertThat(dto.getEmployerCity()).isEqualTo("Amsterdam");
    }

    @Test
    void missingCompanySettingsLeavesEmployerBlockEmptyWithoutFailing() {
        PayslipRepository payslipRepository = mock(PayslipRepository.class);
        JaaropgaafRepository jaaropgaafRepository = mock(JaaropgaafRepository.class);
        CompanySettingsClient companySettingsClient = mock(CompanySettingsClient.class);

        when(jaaropgaafRepository.findByCompanyIdAndUserIdAndYear(companyId, employeeId, year))
                .thenReturn(Optional.empty());
        when(payslipRepository.findByUserIdAndFiscalYearOrderByDateOfIssueAsc(employeeId, year))
                .thenReturn(List.of());
        when(companySettingsClient.getCompanySettings(companyId.toString())).thenReturn(null);

        JaaropgaafService service = newService(payslipRepository, jaaropgaafRepository, companySettingsClient);
        JaaropgaafDTO dto = service.buildForEmployee(companyId, employeeId, year, true);

        assertThat(dto.getEmployerName()).isNull();
        assertThat(dto.getEmployerStreet()).isNull();
        assertThat(dto.getEmployerPostalCode()).isNull();
        assertThat(dto.getEmployerCity()).isNull();
    }

    @Test
    void jaaropgaafEqualsTheSumOfTheYearsPayslips() {
        PayslipRepository payslipRepository = mock(PayslipRepository.class);
        JaaropgaafRepository jaaropgaafRepository = mock(JaaropgaafRepository.class);
        CompanySettingsClient companySettingsClient = mock(CompanySettingsClient.class);

        when(jaaropgaafRepository.findByCompanyIdAndUserIdAndYear(companyId, employeeId, year))
                .thenReturn(Optional.empty());
        when(payslipRepository.findByUserIdAndFiscalYearOrderByDateOfIssueAsc(employeeId, year))
                .thenReturn(List.of(
                        periodPayslip("1000.00", "200.00", "800.00"),
                        periodPayslip("1500.00", "330.00", "1170.00"),
                        periodPayslip("500.00", "90.00", "410.00")));
        when(companySettingsClient.getCompanySettings(companyId.toString())).thenReturn(null);

        JaaropgaafService service = newService(payslipRepository, jaaropgaafRepository, companySettingsClient);
        JaaropgaafDTO dto = service.buildForEmployee(companyId, employeeId, year, true);

        assertThat(dto.getFiscalWage()).isEqualByComparingTo(new BigDecimal("3000.00"));
        assertThat(dto.getLoonheffing()).isEqualByComparingTo(new BigDecimal("620.00"));
        assertThat(dto.getTotalNet()).isEqualByComparingTo(new BigDecimal("2380.00"));
        assertThat(dto.getTotalGross()).isEqualByComparingTo(new BigDecimal("3000.00"));
        assertThat(dto.getPayslipCount()).isEqualTo(3);
    }

    @Test
    void verzamelloonstaatTotalsEqualSumOfEmployeeRows() {
        UUID employeeB = UUID.randomUUID();
        PayslipRepository payslipRepository = mock(PayslipRepository.class);
        JaaropgaafRepository jaaropgaafRepository = mock(JaaropgaafRepository.class);
        CompanySettingsClient companySettingsClient = mock(CompanySettingsClient.class);

        when(payslipRepository.findByCompanyIdAndFiscalYearOrderByDateOfIssueAsc(companyId, year))
                .thenReturn(List.of(
                        // employee A, two periods
                        companyPayslip(employeeId, companyId, PayslipStatus.RELEASED, "1000.00", "200.00", "50.00", "30.00", "800.00"),
                        companyPayslip(employeeId, companyId, PayslipStatus.APPROVED, "1500.00", "330.00", "60.00", "45.00", "1170.00"),
                        // employee B, one period
                        companyPayslip(employeeB, companyId, PayslipStatus.RELEASED, "2000.00", "400.00", "70.00", "60.00", "1600.00")));
        when(companySettingsClient.getCompanySettings(companyId.toString())).thenReturn(null);

        JaaropgaafService service = newService(payslipRepository, jaaropgaafRepository, companySettingsClient);
        VerzamelloonstaatDTO dto = service.buildVerzamelloonstaat(companyId, year);

        // Two distinct employees rolled up.
        assertThat(dto.getEmployeeCount()).isEqualTo(2);
        assertThat(dto.getEmployees()).hasSize(2);

        // F-5: every company total must equal the sum of the per-employee rows.
        assertThat(dto.getTotalFiscalWage()).isEqualByComparingTo(sumRows(dto, JaaropgaafDTO::getFiscalWage));
        assertThat(dto.getTotalLoonheffing()).isEqualByComparingTo(sumRows(dto, JaaropgaafDTO::getLoonheffing));
        assertThat(dto.getTotalArbeidskortingApplied()).isEqualByComparingTo(sumRows(dto, JaaropgaafDTO::getArbeidskortingApplied));
        assertThat(dto.getTotalEmployeeZvwWithheld()).isEqualByComparingTo(sumRows(dto, JaaropgaafDTO::getEmployeeZvwWithheld));
        assertThat(dto.getTotalNet()).isEqualByComparingTo(sumRows(dto, JaaropgaafDTO::getTotalNet));

        // And equal the independently computed expected figures.
        assertThat(dto.getTotalFiscalWage()).isEqualByComparingTo(new BigDecimal("4500.00"));
        assertThat(dto.getTotalLoonheffing()).isEqualByComparingTo(new BigDecimal("930.00"));
        assertThat(dto.getTotalArbeidskortingApplied()).isEqualByComparingTo(new BigDecimal("180.00"));
        assertThat(dto.getTotalEmployeeZvwWithheld()).isEqualByComparingTo(new BigDecimal("135.00"));
        assertThat(dto.getTotalNet()).isEqualByComparingTo(new BigDecimal("3570.00"));
    }

    @Test
    void verzamelloonstaatExcludesForeignCompanyPayslips() {
        UUID foreignCompany = UUID.randomUUID();
        UUID foreignEmployee = UUID.randomUUID();
        PayslipRepository payslipRepository = mock(PayslipRepository.class);
        JaaropgaafRepository jaaropgaafRepository = mock(JaaropgaafRepository.class);
        CompanySettingsClient companySettingsClient = mock(CompanySettingsClient.class);

        // The repository result is deliberately "leaky": it includes a payslip
        // belonging to another tenant. The service must still scope it out.
        when(payslipRepository.findByCompanyIdAndFiscalYearOrderByDateOfIssueAsc(companyId, year))
                .thenReturn(List.of(
                        companyPayslip(employeeId, companyId, PayslipStatus.RELEASED, "1000.00", "200.00", "50.00", "30.00", "800.00"),
                        companyPayslip(foreignEmployee, foreignCompany, PayslipStatus.RELEASED, "9999.00", "9999.00", "9999.00", "9999.00", "9999.00")));
        when(companySettingsClient.getCompanySettings(companyId.toString())).thenReturn(null);

        JaaropgaafService service = newService(payslipRepository, jaaropgaafRepository, companySettingsClient);
        VerzamelloonstaatDTO dto = service.buildVerzamelloonstaat(companyId, year);

        // T-6/F-3: only the in-tenant employee survives; foreign figures never leak into totals.
        assertThat(dto.getEmployeeCount()).isEqualTo(1);
        assertThat(dto.getEmployees()).extracting(JaaropgaafDTO::getUserId)
                .containsExactly(employeeId.toString());
        assertThat(dto.getTotalFiscalWage()).isEqualByComparingTo(new BigDecimal("1000.00"));
        assertThat(dto.getTotalNet()).isEqualByComparingTo(new BigDecimal("800.00"));
    }

    @Test
    void verzamelloonstaatExcludesNonVisibleStatusPayslips() {
        UUID pendingEmployee = UUID.randomUUID();
        PayslipRepository payslipRepository = mock(PayslipRepository.class);
        JaaropgaafRepository jaaropgaafRepository = mock(JaaropgaafRepository.class);
        CompanySettingsClient companySettingsClient = mock(CompanySettingsClient.class);

        when(payslipRepository.findByCompanyIdAndFiscalYearOrderByDateOfIssueAsc(companyId, year))
                .thenReturn(List.of(
                        companyPayslip(employeeId, companyId, PayslipStatus.RELEASED, "1000.00", "200.00", "50.00", "30.00", "800.00"),
                        companyPayslip(pendingEmployee, companyId, PayslipStatus.PENDING_APPROVAL, "5000.00", "1000.00", "100.00", "100.00", "4000.00")));
        when(companySettingsClient.getCompanySettings(companyId.toString())).thenReturn(null);

        JaaropgaafService service = newService(payslipRepository, jaaropgaafRepository, companySettingsClient);
        VerzamelloonstaatDTO dto = service.buildVerzamelloonstaat(companyId, year);

        // Only RELEASED/APPROVED payslips roll up; a not-yet-released payslip must not inflate the totals.
        assertThat(dto.getEmployeeCount()).isEqualTo(1);
        assertThat(dto.getTotalFiscalWage()).isEqualByComparingTo(new BigDecimal("1000.00"));
        assertThat(dto.getTotalNet()).isEqualByComparingTo(new BigDecimal("800.00"));
    }

    @Test
    void verzamelloonstaatRequiresCompanyId() {
        JaaropgaafService service = newService(
                mock(PayslipRepository.class), mock(JaaropgaafRepository.class), mock(CompanySettingsClient.class));

        assertThatThrownBy(() -> service.buildVerzamelloonstaat(null, year))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("companyId");
    }

    private static BigDecimal sumRows(VerzamelloonstaatDTO dto,
                                      java.util.function.Function<JaaropgaafDTO, BigDecimal> field) {
        BigDecimal total = BigDecimal.ZERO;
        for (JaaropgaafDTO row : dto.getEmployees()) {
            BigDecimal v = field.apply(row);
            total = total.add(v == null ? BigDecimal.ZERO : v);
        }
        return total;
    }

    private Payslip companyPayslip(UUID userId, UUID company, PayslipStatus status,
                                   String fiscalWage, String loonheffing, String arbeidskorting,
                                   String employeeZvw, String net) {
        Payslip p = new Payslip();
        p.setUserId(userId);
        p.setCompanyId(company);
        p.setStatus(status);
        p.setFiscalYear(year);
        p.setFiscalWage(new BigDecimal(fiscalWage));
        p.setLoonheffingWithheld(new BigDecimal(loonheffing));
        p.setArbeidskortingApplied(new BigDecimal(arbeidskorting));
        p.setEmployeeZvwWithheld(new BigDecimal(employeeZvw));
        p.setTotalGrossAmount(new BigDecimal(fiscalWage));
        p.setTotalNetAmount(new BigDecimal(net));
        return p;
    }

    private Payslip periodPayslip(String fiscalWage, String loonheffing, String net) {
        Payslip p = new Payslip();
        p.setUserId(employeeId);
        p.setCompanyId(companyId);
        p.setStatus(PayslipStatus.RELEASED);
        p.setFiscalYear(year);
        p.setFiscalWage(new BigDecimal(fiscalWage));
        p.setLoonheffingWithheld(new BigDecimal(loonheffing));
        p.setTotalGrossAmount(new BigDecimal(fiscalWage));
        p.setTotalNetAmount(new BigDecimal(net));
        return p;
    }
}
