package com.pm.planningservice.service;

import com.pm.planningservice.dto.PlanningClientCompanyDTO;
import com.pm.planningservice.dto.PlanningClientCompanySaveRequestDTO;
import com.pm.planningservice.dto.PlanningLocationDTO;
import com.pm.planningservice.dto.PlanningLocationSaveRequestDTO;
import com.pm.planningservice.integration.AuditLogClient;
import com.pm.planningservice.model.ClientCompany;
import com.pm.planningservice.model.PlanningLocation;
import com.pm.planningservice.repository.ClientCompanyRepository;
import com.pm.planningservice.repository.ClientFunctionBillingRateRepository;
import com.pm.planningservice.repository.EmployeeClientFunctionBillingRateRepository;
import com.pm.planningservice.repository.EmployeeProjectFunctionBillingRateRepository;
import com.pm.planningservice.repository.PlanningClientLocationUsageRepository;
import com.pm.planningservice.repository.PlanningLocationRepository;
import com.pm.planningservice.repository.ProjectFunctionBillingRateRepository;
import com.pm.planningservice.repository.ProjectRepository;
import com.pm.planningservice.repository.ScheduleEntryRepository;
import com.pm.planningservice.repository.ShiftRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * C-1 / C-2 / C-3: client-company and saved-location CRUD is validated, company-scoped, and
 * a client that is still linked to projects cannot be deleted.
 */
@ExtendWith(MockitoExtension.class)
class PlanningClientLocationCrudTest {

    @Mock private ClientCompanyRepository clientCompanyRepository;
    @Mock private PlanningLocationRepository planningLocationRepository;
    @Mock private PlanningClientLocationUsageRepository planningClientLocationUsageRepository;
    @Mock private ProjectRepository projectRepository;
    @Mock private ShiftRepository shiftRepository;
    @Mock private ScheduleEntryRepository scheduleEntryRepository;
    @Mock private ClientFunctionBillingRateRepository clientFunctionBillingRateRepository;
    @Mock private ProjectFunctionBillingRateRepository projectFunctionBillingRateRepository;
    @Mock private EmployeeClientFunctionBillingRateRepository employeeClientFunctionBillingRateRepository;
    @Mock private EmployeeProjectFunctionBillingRateRepository employeeProjectFunctionBillingRateRepository;
    @Mock private AuditLogClient auditLogClient;

    @InjectMocks
    private PlanningManagementService service;

    private final UUID company = UUID.randomUUID();

    private PlanningClientCompanySaveRequestDTO clientRequest(String name) {
        PlanningClientCompanySaveRequestDTO dto = new PlanningClientCompanySaveRequestDTO();
        dto.setName(name);
        dto.setContacts(List.of());
        return dto;
    }

    // ---- clients ----

    @Test
    void createClientSavesAndReturnsDto() {
        when(clientCompanyRepository.existsByOwnerCompanyIdAndNameIgnoreCase(company, "Acme")).thenReturn(false);
        when(clientCompanyRepository.save(any(ClientCompany.class))).thenAnswer(inv -> {
            ClientCompany c = inv.getArgument(0);
            if (c.getClientCompanyId() == null) c.setClientCompanyId(UUID.randomUUID());
            return c;
        });

        PlanningClientCompanyDTO dto = service.createClientCompany(company, clientRequest("Acme"));

        assertThat(dto.getName()).isEqualTo("Acme");
        verify(clientCompanyRepository).save(any(ClientCompany.class));
    }

    @Test
    void createClientRejectsDuplicateName() {
        when(clientCompanyRepository.existsByOwnerCompanyIdAndNameIgnoreCase(company, "Acme")).thenReturn(true);

        assertThatThrownBy(() -> service.createClientCompany(company, clientRequest("Acme")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already exists");
        verify(clientCompanyRepository, never()).save(any());
    }

    @Test
    void createClientRejectsBlankName() {
        assertThatThrownBy(() -> service.createClientCompany(company, clientRequest("   ")))
                .isInstanceOf(IllegalArgumentException.class);
        verify(clientCompanyRepository, never()).save(any());
    }

    @Test
    void updateClientForAnotherCompanyIsNotFound() {
        UUID clientId = UUID.randomUUID();
        when(clientCompanyRepository.findByClientCompanyIdAndOwnerCompanyId(clientId, company))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateClientCompany(company, clientId, clientRequest("Acme")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void deleteClientBlockedWhileLinkedToProjects() {
        UUID clientId = UUID.randomUUID();
        ClientCompany existing = new ClientCompany();
        existing.setClientCompanyId(clientId);
        existing.setOwnerCompanyId(company);
        existing.setName("Acme");
        when(clientCompanyRepository.findByClientCompanyIdAndOwnerCompanyId(clientId, company))
                .thenReturn(Optional.of(existing));
        when(projectRepository.existsByCompanyIdAndClientCompanyId(company, clientId)).thenReturn(true);

        assertThatThrownBy(() -> service.deleteClientCompany(company, clientId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("linked to existing projects");
        verify(clientCompanyRepository, never()).delete(any());
    }

    @Test
    void deleteClientSucceedsWhenNotReferenced() {
        UUID clientId = UUID.randomUUID();
        ClientCompany existing = new ClientCompany();
        existing.setClientCompanyId(clientId);
        existing.setOwnerCompanyId(company);
        existing.setName("Acme");
        when(clientCompanyRepository.findByClientCompanyIdAndOwnerCompanyId(clientId, company))
                .thenReturn(Optional.of(existing));
        when(projectRepository.existsByCompanyIdAndClientCompanyId(company, clientId)).thenReturn(false);

        service.deleteClientCompany(company, clientId);

        verify(planningClientLocationUsageRepository).deleteByClientCompanyId(clientId);
        verify(clientCompanyRepository).delete(existing);
    }

    // ---- locations ----

    @Test
    void createLocationSavesAndReturnsDto() {
        PlanningLocationSaveRequestDTO request = new PlanningLocationSaveRequestDTO();
        request.setName("Main hall");
        when(planningLocationRepository.existsByOwnerCompanyIdAndNameIgnoreCase(company, "Main hall")).thenReturn(false);
        when(planningLocationRepository.save(any(PlanningLocation.class))).thenAnswer(inv -> {
            PlanningLocation l = inv.getArgument(0);
            if (l.getLocationId() == null) l.setLocationId(UUID.randomUUID());
            return l;
        });
        when(planningClientLocationUsageRepository.findByLocationId(any())).thenReturn(List.of());

        PlanningLocationDTO dto = service.createLocation(company, request);

        assertThat(dto.getName()).isEqualTo("Main hall");
        verify(planningLocationRepository).save(any(PlanningLocation.class));
    }

    @Test
    void deleteLocationForAnotherCompanyIsNotFound() {
        UUID locationId = UUID.randomUUID();
        when(planningLocationRepository.findByLocationIdAndOwnerCompanyId(locationId, company))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deleteLocation(company, locationId))
                .isInstanceOf(IllegalArgumentException.class);
        verify(planningLocationRepository, never()).delete(any());
    }

    @Test
    void deleteLocationRemovesLocationAndUsages() {
        UUID locationId = UUID.randomUUID();
        PlanningLocation location = new PlanningLocation();
        location.setLocationId(locationId);
        location.setOwnerCompanyId(company);
        location.setName("Main hall");
        when(planningLocationRepository.findByLocationIdAndOwnerCompanyId(locationId, company))
                .thenReturn(Optional.of(location));

        assertDoesNotThrow(() -> service.deleteLocation(company, locationId));

        verify(planningClientLocationUsageRepository).deleteByLocationId(locationId);
        verify(planningLocationRepository).delete(location);
    }
}
