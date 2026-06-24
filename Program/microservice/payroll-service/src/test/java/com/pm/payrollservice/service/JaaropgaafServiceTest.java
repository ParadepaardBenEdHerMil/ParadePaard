package com.pm.payrollservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pm.payrollservice.dto.CompanySettingsDTO;
import com.pm.payrollservice.dto.JaaropgaafDTO;
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
        payslip.setDateOfIssue(LocalDate.of(2026, 5, 31));
        payslip.setFiscalWage(new BigDecimal("2000.00"));
        payslip.setWageTaxWithheldTest(new BigDecimal("400.00"));
        payslip.setTotalGrossAmount(new BigDecimal("2000.00"));
        payslip.setTotalNetAmount(new BigDecimal("1600.00"));
        when(payslipRepository.findByUserIdAndWeekBasedYearOrderByDateOfIssueAsc(employeeId, year))
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
        when(payslipRepository.findByUserIdAndWeekBasedYearOrderByDateOfIssueAsc(employeeId, year))
                .thenReturn(List.of());
        when(companySettingsClient.getCompanySettings(companyId.toString())).thenReturn(null);

        JaaropgaafService service = newService(payslipRepository, jaaropgaafRepository, companySettingsClient);
        JaaropgaafDTO dto = service.buildForEmployee(companyId, employeeId, year, true);

        assertThat(dto.getEmployerName()).isNull();
        assertThat(dto.getEmployerStreet()).isNull();
        assertThat(dto.getEmployerPostalCode()).isNull();
        assertThat(dto.getEmployerCity()).isNull();
    }
}
