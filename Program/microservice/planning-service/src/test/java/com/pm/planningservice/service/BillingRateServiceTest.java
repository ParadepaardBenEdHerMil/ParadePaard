package com.pm.planningservice.service;

import com.pm.planningservice.dto.BillingRateSaveRequestDTO;
import com.pm.planningservice.model.ClientCompany;
import com.pm.planningservice.model.ClientFunctionBillingRate;
import com.pm.planningservice.model.EmployeeClientFunctionBillingRate;
import com.pm.planningservice.model.EmployeeProjectFunctionBillingRate;
import com.pm.planningservice.model.ProjectFunctionBillingRate;
import com.pm.planningservice.dto.ResolvedRateDTO;
import com.pm.planningservice.model.Project;
import com.pm.planningservice.repository.ClientCompanyRepository;
import com.pm.planningservice.repository.ClientFunctionBillingRateRepository;
import com.pm.planningservice.repository.EmployeeClientFunctionBillingRateRepository;
import com.pm.planningservice.repository.EmployeeProjectFunctionBillingRateRepository;
import com.pm.planningservice.repository.ProjectFunctionBillingRateRepository;
import com.pm.planningservice.repository.ProjectRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
class BillingRateServiceTest {
    @Mock
    private ClientCompanyRepository clientCompanyRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ClientFunctionBillingRateRepository clientFunctionBillingRateRepository;

    @Mock
    private ProjectFunctionBillingRateRepository projectFunctionBillingRateRepository;

    @Mock
    private EmployeeClientFunctionBillingRateRepository employeeClientFunctionBillingRateRepository;

    @Mock
    private EmployeeProjectFunctionBillingRateRepository employeeProjectFunctionBillingRateRepository;

    @InjectMocks
    private BillingRateService billingRateService;

    @Test
    void saveClientDefaultRateEndsPreviousActiveVersion() {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();

        ClientCompany clientCompany = new ClientCompany();
        clientCompany.setClientCompanyId(clientCompanyId);
        clientCompany.setOwnerCompanyId(companyId);

        ClientFunctionBillingRate existing = new ClientFunctionBillingRate();
        existing.setClientFunctionBillingRateId(UUID.randomUUID());
        existing.setCompanyId(companyId);
        existing.setClientCompanyId(clientCompanyId);
        existing.setFunctionName("Bartender");
        existing.setRatePerHour(new BigDecimal("25.00"));
        existing.setActive(true);

        BillingRateSaveRequestDTO request = new BillingRateSaveRequestDTO();
        request.setFunctionName(" Bartender ");
        request.setRatePerHour(new BigDecimal("27.50"));
        request.setEffectiveFrom(LocalDateTime.of(2026, 6, 17, 12, 0));
        request.setNotes("Summer rate");

        when(clientCompanyRepository.findByClientCompanyIdAndOwnerCompanyId(clientCompanyId, companyId))
                .thenReturn(Optional.of(clientCompany));
        when(clientFunctionBillingRateRepository.findFirstByCompanyIdAndClientCompanyIdAndFunctionNameIgnoreCaseAndActiveTrue(
                companyId,
                clientCompanyId,
                "Bartender"
        )).thenReturn(Optional.of(existing));
        when(clientFunctionBillingRateRepository.save(any(ClientFunctionBillingRate.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        billingRateService.saveClientDefaultRate(companyId, userId, clientCompanyId, request, null);

        assertFalse(existing.getActive());
        assertEquals(LocalDateTime.of(2026, 6, 17, 12, 0), existing.getEffectiveTo());

        ArgumentCaptor<ClientFunctionBillingRate> captor = ArgumentCaptor.forClass(ClientFunctionBillingRate.class);
        verify(clientFunctionBillingRateRepository, times(2)).save(captor.capture());
        ClientFunctionBillingRate saved = captor.getAllValues().get(captor.getAllValues().size() - 1);
        assertEquals("Bartender", saved.getFunctionName());
        assertEquals(0, new BigDecimal("27.50").compareTo(saved.getRatePerHour()));
        assertEquals(userId, saved.getCreatedByUserId());
        assertEquals("Summer rate", saved.getNotes());
    }

    @Test
    void listUserBillingRatesReturnsClientAndProjectOverrides() {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();

        ClientCompany clientCompany = new ClientCompany();
        clientCompany.setClientCompanyId(clientCompanyId);
        clientCompany.setOwnerCompanyId(companyId);
        clientCompany.setName("Festival Breda");

        Project project = new Project();
        project.setProjectId(projectId);
        project.setCompanyId(companyId);
        project.setClientCompanyId(clientCompanyId);
        project.setName("ADE Weekend");
        project.setStartDate(LocalDate.of(2026, 10, 18));
        project.setEndDate(LocalDate.of(2026, 10, 20));

        EmployeeClientFunctionBillingRate clientOverride = new EmployeeClientFunctionBillingRate();
        clientOverride.setEmployeeClientFunctionBillingRateId(UUID.randomUUID());
        clientOverride.setCompanyId(companyId);
        clientOverride.setClientCompanyId(clientCompanyId);
        clientOverride.setUserId(userId);
        clientOverride.setFunctionName("Bartender");
        clientOverride.setRatePerHour(new BigDecimal("29.00"));
        clientOverride.setActive(true);

        EmployeeProjectFunctionBillingRate projectOverride = new EmployeeProjectFunctionBillingRate();
        projectOverride.setEmployeeProjectFunctionBillingRateId(UUID.randomUUID());
        projectOverride.setCompanyId(companyId);
        projectOverride.setClientCompanyId(clientCompanyId);
        projectOverride.setProjectId(projectId);
        projectOverride.setUserId(userId);
        projectOverride.setFunctionName("Bar head");
        projectOverride.setRatePerHour(new BigDecimal("35.00"));
        projectOverride.setActive(true);

        when(employeeClientFunctionBillingRateRepository.findByCompanyIdAndUserIdOrderByFunctionNameAsc(companyId, userId))
                .thenReturn(List.of(clientOverride));
        when(employeeProjectFunctionBillingRateRepository.findByCompanyIdAndUserIdOrderByProjectIdAscFunctionNameAsc(companyId, userId))
                .thenReturn(List.of(projectOverride));
        when(clientCompanyRepository.findByClientCompanyIdAndOwnerCompanyId(clientCompanyId, companyId))
                .thenReturn(Optional.of(clientCompany));
        when(projectRepository.findByProjectIdAndCompanyId(projectId, companyId))
                .thenReturn(Optional.of(project));

        var response = billingRateService.listUserBillingRates(companyId, userId);

        assertEquals(1, response.getClientOverrides().size());
        assertEquals("Festival Breda", response.getClientOverrides().get(0).getClientName());
        assertEquals("Bartender", response.getClientOverrides().get(0).getFunctionName());
        assertEquals(1, response.getProjectOverrides().size());
        assertEquals("ADE Weekend", response.getProjectOverrides().get(0).getProjectName());
        assertEquals("Bar head", response.getProjectOverrides().get(0).getFunctionName());
        assertNotNull(response.getProjectOverrides().get(0).getRatePerHour());
    }

    @Test
    void deleteBillingRateDeletesTheScopedRateWhenItBelongsToTheCompany() {
        UUID companyId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();
        UUID rateId = UUID.randomUUID();

        EmployeeClientFunctionBillingRate rate = new EmployeeClientFunctionBillingRate();
        rate.setEmployeeClientFunctionBillingRateId(rateId);
        rate.setCompanyId(companyId);
        rate.setClientCompanyId(clientCompanyId);
        rate.setUserId(UUID.randomUUID());
        rate.setFunctionName("Bartender");
        rate.setRatePerHour(new BigDecimal("29.00"));

        when(employeeClientFunctionBillingRateRepository.findById(rateId)).thenReturn(Optional.of(rate));

        billingRateService.deleteBillingRate(companyId, clientCompanyId, "CLIENT_EMPLOYEE_FUNCTION", rateId, null);

        verify(employeeClientFunctionBillingRateRepository).delete(rate);
    }

    @Test
    void deleteBillingRateRejectsRatesFromAnotherCompany() {
        UUID companyId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();
        UUID rateId = UUID.randomUUID();

        EmployeeProjectFunctionBillingRate rate = new EmployeeProjectFunctionBillingRate();
        rate.setEmployeeProjectFunctionBillingRateId(rateId);
        rate.setCompanyId(UUID.randomUUID());
        rate.setClientCompanyId(clientCompanyId);
        rate.setProjectId(UUID.randomUUID());
        rate.setUserId(UUID.randomUUID());
        rate.setFunctionName("Runner");
        rate.setRatePerHour(new BigDecimal("31.00"));

        when(employeeProjectFunctionBillingRateRepository.findById(rateId)).thenReturn(Optional.of(rate));

        try {
            billingRateService.deleteBillingRate(companyId, clientCompanyId, "PROJECT_EMPLOYEE_FUNCTION", rateId, null);
        } catch (IllegalArgumentException ignored) {
            // Expected.
        }

        verify(employeeProjectFunctionBillingRateRepository, never()).delete(rate);
    }

    @Test
    void resolveRatePicksMostSpecificEmployeeProjectTier() {
        UUID companyId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();

        Project project = new Project();
        project.setProjectId(projectId);
        project.setCompanyId(companyId);
        project.setClientCompanyId(clientCompanyId);
        project.setName("ADE Weekend");

        EmployeeProjectFunctionBillingRate epRate = new EmployeeProjectFunctionBillingRate();
        epRate.setProjectId(projectId);
        epRate.setUserId(userId);
        epRate.setFunctionName("Bartender");
        epRate.setRatePerHour(new BigDecimal("42.00"));
        epRate.setEffectiveFrom(LocalDateTime.of(2026, 1, 1, 0, 0));
        epRate.setActive(true);

        when(projectRepository.findByProjectIdIn(java.util.Set.of(projectId))).thenReturn(List.of(project));
        when(employeeProjectFunctionBillingRateRepository
                .findByCompanyIdAndUserIdOrderByProjectIdAscFunctionNameAsc(companyId, userId))
                .thenReturn(List.of(epRate));

        ResolvedRateDTO resolved = billingRateService.resolveRate(companyId, projectId, userId, " Bartender ", LocalDate.of(2026, 6, 20));

        assertEquals("EMPLOYEE_PROJECT", resolved.getSource());
        assertEquals(0, new BigDecimal("42.00").compareTo(resolved.getRatePerHour()));
        assertFalse(resolved.isMissing());
    }

    @Test
    void resolveRateFallsBackThroughTiersToClientDefault() {
        UUID companyId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();

        Project project = new Project();
        project.setProjectId(projectId);
        project.setCompanyId(companyId);
        project.setClientCompanyId(clientCompanyId);
        project.setName("ADE Weekend");

        ClientFunctionBillingRate clientRate = new ClientFunctionBillingRate();
        clientRate.setClientCompanyId(clientCompanyId);
        clientRate.setFunctionName("Bartender");
        clientRate.setRatePerHour(new BigDecimal("25.00"));
        clientRate.setEffectiveFrom(LocalDateTime.of(2026, 1, 1, 0, 0));
        clientRate.setActive(true);

        when(projectRepository.findByProjectIdIn(java.util.Set.of(projectId))).thenReturn(List.of(project));
        when(employeeProjectFunctionBillingRateRepository
                .findByCompanyIdAndUserIdOrderByProjectIdAscFunctionNameAsc(companyId, userId))
                .thenReturn(List.of());
        when(employeeClientFunctionBillingRateRepository
                .findByCompanyIdAndUserIdOrderByFunctionNameAsc(companyId, userId))
                .thenReturn(List.of());
        when(projectFunctionBillingRateRepository
                .findByCompanyIdAndProjectIdOrderByFunctionNameAsc(companyId, projectId))
                .thenReturn(List.of());
        when(clientFunctionBillingRateRepository
                .findByCompanyIdAndClientCompanyIdOrderByFunctionNameAscEffectiveFromDesc(companyId, clientCompanyId))
                .thenReturn(List.of(clientRate));

        ResolvedRateDTO resolved = billingRateService.resolveRate(companyId, projectId, userId, "Bartender", LocalDate.of(2026, 6, 20));

        assertEquals("CLIENT", resolved.getSource());
        assertEquals(0, new BigDecimal("25.00").compareTo(resolved.getRatePerHour()));
        assertFalse(resolved.isMissing());
    }

    @Test
    void resolveRateUsesHistoricalProjectRateForHistoricalShiftDate() {
        UUID companyId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();

        Project project = new Project();
        project.setProjectId(projectId);
        project.setCompanyId(companyId);
        project.setClientCompanyId(clientCompanyId);
        project.setName("ADE Weekend");

        ProjectFunctionBillingRate historicalRate = new ProjectFunctionBillingRate();
        historicalRate.setFunctionName("Bartender");
        historicalRate.setRatePerHour(new BigDecimal("25.00"));
        historicalRate.setEffectiveFrom(LocalDateTime.of(2026, 1, 1, 0, 0));
        historicalRate.setEffectiveTo(LocalDateTime.of(2026, 6, 1, 0, 0));
        historicalRate.setActive(false);

        ProjectFunctionBillingRate currentRate = new ProjectFunctionBillingRate();
        currentRate.setFunctionName("Bartender");
        currentRate.setRatePerHour(new BigDecimal("32.00"));
        currentRate.setEffectiveFrom(LocalDateTime.of(2026, 6, 1, 0, 0));
        currentRate.setEffectiveTo(null);
        currentRate.setActive(true);

        when(projectRepository.findByProjectIdIn(java.util.Set.of(projectId))).thenReturn(List.of(project));
        when(employeeProjectFunctionBillingRateRepository
                .findByCompanyIdAndUserIdOrderByProjectIdAscFunctionNameAsc(companyId, userId))
                .thenReturn(List.of());
        when(employeeClientFunctionBillingRateRepository
                .findByCompanyIdAndUserIdOrderByFunctionNameAsc(companyId, userId))
                .thenReturn(List.of());
        when(projectFunctionBillingRateRepository
                .findByCompanyIdAndProjectIdOrderByFunctionNameAsc(companyId, projectId))
                .thenReturn(List.of(currentRate, historicalRate));

        ResolvedRateDTO resolved = billingRateService.resolveRate(companyId, projectId, userId, "Bartender", LocalDate.of(2026, 5, 20));

        assertEquals("PROJECT", resolved.getSource());
        assertEquals(0, new BigDecimal("25.00").compareTo(resolved.getRatePerHour()));
        assertFalse(resolved.isMissing());
    }

    @Test
    void resolveRateReturnsMissingWhenProjectUnknown() {
        UUID companyId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();

        when(projectRepository.findByProjectIdIn(java.util.Set.of(projectId))).thenReturn(List.of());

        ResolvedRateDTO resolved = billingRateService.resolveRate(companyId, projectId, UUID.randomUUID(), "Bartender", LocalDate.of(2026, 6, 20));

        assertEquals("MISSING", resolved.getSource());
        assertTrue(resolved.isMissing());
    }
}
