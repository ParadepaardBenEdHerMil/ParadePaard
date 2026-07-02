package com.pm.planningservice.service;

import com.pm.planningservice.dto.AuditLogCreateRequestDTO;
import com.pm.planningservice.dto.PlanningAssignmentMutationResponseDTO;
import com.pm.planningservice.dto.PlanningAssignmentSaveRequestDTO;
import com.pm.planningservice.dto.PlanningLocationDTO;
import com.pm.planningservice.dto.PlanningLocationSaveRequestDTO;
import com.pm.planningservice.dto.PlanningProjectSaveRequestDTO;
import com.pm.planningservice.integration.AuditLogClient;
import com.pm.planningservice.model.ClientCompany;
import com.pm.planningservice.model.ClientFunctionBillingRate;
import com.pm.planningservice.model.PlanningClientLocationUsage;
import com.pm.planningservice.model.PlanningLocation;
import com.pm.planningservice.model.Project;
import com.pm.planningservice.model.ProjectFunctionBillingRate;
import com.pm.planningservice.model.ScheduleEntry;
import com.pm.planningservice.model.ScheduleEntryStatus;
import com.pm.planningservice.model.Shift;
import com.pm.planningservice.repository.ClientFunctionBillingRateRepository;
import com.pm.planningservice.repository.ClientCompanyRepository;
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

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PlanningManagementServiceTest {

    @Mock
    private ClientCompanyRepository clientCompanyRepository;

    @Mock
    private PlanningLocationRepository planningLocationRepository;

    @Mock
    private PlanningClientLocationUsageRepository planningClientLocationUsageRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ShiftRepository shiftRepository;

    @Mock
    private ScheduleEntryRepository scheduleEntryRepository;

    @Mock
    private ClientFunctionBillingRateRepository clientFunctionBillingRateRepository;

    @Mock
    private ProjectFunctionBillingRateRepository projectFunctionBillingRateRepository;

    @Mock
    private AuditLogClient auditLogClient;

    @InjectMocks
    private PlanningManagementService planningManagementService;

    @Test
    void createAssignmentResetsExistingEntryToPendingStatus() {
        UUID companyId = UUID.randomUUID();
        UUID shiftId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID scheduleEntryId = UUID.randomUUID();

        Shift shift = new Shift();
        shift.setShiftId(shiftId);
        shift.setProjectId(projectId);
        shift.setStartTime(LocalDateTime.of(2026, 5, 1, 9, 0));
        shift.setEndTime(LocalDateTime.of(2026, 5, 1, 17, 0));
        shift.setFunctionName("BAR");

        Project project = new Project();
        project.setProjectId(projectId);
        project.setCompanyId(companyId);
        project.setName("Test project");
        project.setStartDate(LocalDate.of(2026, 5, 1));
        project.setEndDate(LocalDate.of(2026, 5, 1));
        project.setFinalized(false);

        ScheduleEntry existingEntry = new ScheduleEntry();
        existingEntry.setScheduleEntryId(scheduleEntryId);
        existingEntry.setShiftId(shiftId);
        existingEntry.setUserId(userId);
        existingEntry.setStatus(ScheduleEntryStatus.CONFIRMED);
        existingEntry.setTimesheetExported(true);
        existingEntry.setTimesheetExportedAt(LocalDateTime.of(2026, 5, 2, 8, 30));

        PlanningAssignmentSaveRequestDTO request = new PlanningAssignmentSaveRequestDTO();
        request.setUserId(userId);
        request.setStatus(ScheduleEntryStatus.ASSIGNED);

        when(shiftRepository.findById(shiftId)).thenReturn(Optional.of(shift));
        when(projectRepository.findByProjectIdAndCompanyId(projectId, companyId)).thenReturn(Optional.of(project));
        when(scheduleEntryRepository.findFirstByShiftIdAndUserId(shiftId, userId)).thenReturn(Optional.of(existingEntry));
        when(scheduleEntryRepository.save(existingEntry)).thenReturn(existingEntry);

        PlanningAssignmentMutationResponseDTO response =
                planningManagementService.createAssignment(companyId, shiftId, request);

        assertEquals(scheduleEntryId, response.getScheduleEntryId());
        assertEquals(shiftId, response.getShiftId());
        assertEquals(ScheduleEntryStatus.ASSIGNED, existingEntry.getStatus());
        assertEquals(false, existingEntry.getTimesheetExported());
        assertNull(existingEntry.getTimesheetExportedAt());
        verify(scheduleEntryRepository).save(existingEntry);
    }

    @Test
    void createAssignmentCreatesNewEntryWhenNoExistingAssignmentExists() {
        UUID companyId = UUID.randomUUID();
        UUID shiftId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID scheduleEntryId = UUID.randomUUID();

        Shift shift = new Shift();
        shift.setShiftId(shiftId);
        shift.setProjectId(projectId);
        shift.setStartTime(LocalDateTime.of(2026, 5, 1, 9, 0));
        shift.setEndTime(LocalDateTime.of(2026, 5, 1, 17, 0));
        shift.setFunctionName("BAR");

        Project project = new Project();
        project.setProjectId(projectId);
        project.setCompanyId(companyId);
        project.setName("Test project");
        project.setStartDate(LocalDate.of(2026, 5, 1));
        project.setEndDate(LocalDate.of(2026, 5, 1));
        project.setFinalized(false);

        ScheduleEntry savedEntry = new ScheduleEntry();
        savedEntry.setScheduleEntryId(scheduleEntryId);
        savedEntry.setShiftId(shiftId);
        savedEntry.setUserId(userId);
        savedEntry.setStatus(ScheduleEntryStatus.ASSIGNED);
        savedEntry.setTimesheetExported(false);

        PlanningAssignmentSaveRequestDTO request = new PlanningAssignmentSaveRequestDTO();
        request.setUserId(userId);
        request.setStatus(ScheduleEntryStatus.ASSIGNED);

        when(shiftRepository.findById(shiftId)).thenReturn(Optional.of(shift));
        when(projectRepository.findByProjectIdAndCompanyId(projectId, companyId)).thenReturn(Optional.of(project));
        when(scheduleEntryRepository.findFirstByShiftIdAndUserId(shiftId, userId)).thenReturn(Optional.empty());
        when(scheduleEntryRepository.save(any(ScheduleEntry.class))).thenReturn(savedEntry);
        injectAuditLogClient();

        PlanningAssignmentMutationResponseDTO response =
                planningManagementService.createAssignment(companyId, shiftId, request);

        assertEquals(scheduleEntryId, response.getScheduleEntryId());
        assertEquals(shiftId, response.getShiftId());
        verify(scheduleEntryRepository).save(any(ScheduleEntry.class));
    }

    @Test
    void createAssignmentRecordsAuditEntryWhenAccessTokenIsAvailable() {
        UUID companyId = UUID.randomUUID();
        UUID shiftId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID scheduleEntryId = UUID.randomUUID();

        Shift shift = new Shift();
        shift.setShiftId(shiftId);
        shift.setProjectId(projectId);
        shift.setName("Evening Bar Shift");
        shift.setFunctionName("BAR");
        shift.setStartTime(LocalDateTime.of(2026, 5, 1, 18, 0));
        shift.setEndTime(LocalDateTime.of(2026, 5, 1, 23, 0));

        Project project = new Project();
        project.setProjectId(projectId);
        project.setCompanyId(companyId);
        project.setName("Summer Terrace");
        project.setStartDate(LocalDate.of(2026, 5, 1));
        project.setEndDate(LocalDate.of(2026, 5, 1));
        project.setFinalized(false);

        ScheduleEntry savedEntry = new ScheduleEntry();
        savedEntry.setScheduleEntryId(scheduleEntryId);
        savedEntry.setShiftId(shiftId);
        savedEntry.setUserId(userId);
        savedEntry.setStatus(ScheduleEntryStatus.ASSIGNED);

        PlanningAssignmentSaveRequestDTO request = new PlanningAssignmentSaveRequestDTO();
        request.setUserId(userId);

        when(shiftRepository.findById(shiftId)).thenReturn(Optional.of(shift));
        when(projectRepository.findByProjectIdAndCompanyId(projectId, companyId)).thenReturn(Optional.of(project));
        when(scheduleEntryRepository.findFirstByShiftIdAndUserId(shiftId, userId)).thenReturn(Optional.empty());
        when(scheduleEntryRepository.save(any(ScheduleEntry.class))).thenReturn(savedEntry);
        injectAuditLogClient();

        planningManagementService.createAssignment(companyId, shiftId, request, "access-token");

        verify(auditLogClient).record(eq("access-token"), argThat((AuditLogCreateRequestDTO auditRequest) ->
                auditRequest != null
                        && "PLANNING".equals(auditRequest.getCategory())
                        && "ASSIGNED".equals(auditRequest.getAction())
                        && scheduleEntryId.toString().equals(auditRequest.getEntityId())
        ));
    }

    @Test
    void createClientCompanyIgnoresAuditFailures() {
        UUID companyId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();

        var request = new com.pm.planningservice.dto.PlanningClientCompanySaveRequestDTO();
        request.setName("Client Y");

        ClientCompany savedClient = new ClientCompany();
        savedClient.setClientCompanyId(clientCompanyId);
        savedClient.setOwnerCompanyId(companyId);
        savedClient.setName("Client Y");
        savedClient.setCreatedAt(LocalDateTime.of(2026, 6, 7, 10, 0));

        when(clientCompanyRepository.existsByOwnerCompanyIdAndNameIgnoreCase(companyId, "Client Y"))
                .thenReturn(false);
        when(clientCompanyRepository.save(any(ClientCompany.class))).thenReturn(savedClient);
        doThrow(new RuntimeException("audit unavailable")).when(auditLogClient)
                .record(eq("access-token"), any(AuditLogCreateRequestDTO.class));
        injectAuditLogClient();

        var response = assertDoesNotThrow(() ->
                planningManagementService.createClientCompany(companyId, request, "access-token"));

        assertEquals(clientCompanyId, response.getClientCompanyId());
        assertEquals("Client Y", response.getName());
        verify(auditLogClient).record(eq("access-token"), any(AuditLogCreateRequestDTO.class));
    }

    @Test
    void updateClientCompanyRejectsDuplicateNameIgnoringCase() {
        UUID companyId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();

        ClientCompany existing = new ClientCompany();
        existing.setClientCompanyId(clientCompanyId);
        existing.setOwnerCompanyId(companyId);
        existing.setName("Client Y");

        var request = new com.pm.planningservice.dto.PlanningClientCompanySaveRequestDTO();
        request.setName("client y");

        when(clientCompanyRepository.findByClientCompanyIdAndOwnerCompanyId(clientCompanyId, companyId))
                .thenReturn(Optional.of(existing));
        when(clientCompanyRepository.existsByOwnerCompanyIdAndNameIgnoreCaseAndClientCompanyIdNot(
                companyId,
                "client y",
                clientCompanyId
        )).thenReturn(true);

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> planningManagementService.updateClientCompany(companyId, clientCompanyId, request)
        );

        assertEquals("A client company with this name already exists", ex.getMessage());
        verify(clientCompanyRepository, never()).save(any(ClientCompany.class));
    }

    @Test
    void deleteClientCompanyRejectsWhenLinkedProjectsExist() {
        UUID companyId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();

        ClientCompany existing = new ClientCompany();
        existing.setClientCompanyId(clientCompanyId);
        existing.setOwnerCompanyId(companyId);
        existing.setName("Client Y");

        when(clientCompanyRepository.findByClientCompanyIdAndOwnerCompanyId(clientCompanyId, companyId))
                .thenReturn(Optional.of(existing));
        when(projectRepository.existsByCompanyIdAndClientCompanyId(companyId, clientCompanyId))
                .thenReturn(true);

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> planningManagementService.deleteClientCompany(companyId, clientCompanyId, "access-token")
        );

        assertEquals(
                "This client is linked to existing projects. Remove or reassign those projects before deleting the client.",
                ex.getMessage()
        );
        verify(planningClientLocationUsageRepository, never()).deleteByClientCompanyId(clientCompanyId);
        verify(clientCompanyRepository, never()).delete(existing);
        verify(auditLogClient, never()).record(any(), any(AuditLogCreateRequestDTO.class));
    }

    @Test
    void deleteLocationRemovesSavedLocationAndUsageHistory() {
        UUID companyId = UUID.randomUUID();
        UUID locationId = UUID.randomUUID();

        PlanningLocation location = new PlanningLocation();
        location.setLocationId(locationId);
        location.setOwnerCompanyId(companyId);
        location.setName("Rotterdam Hall");

        when(planningLocationRepository.findByLocationIdAndOwnerCompanyId(locationId, companyId))
                .thenReturn(Optional.of(location));
        injectAuditLogClient();

        planningManagementService.deleteLocation(companyId, locationId, "access-token");

        verify(planningClientLocationUsageRepository).deleteByLocationId(locationId);
        verify(planningLocationRepository).delete(location);
        verify(auditLogClient).record(eq("access-token"), argThat((AuditLogCreateRequestDTO auditRequest) ->
                auditRequest != null
                        && "PLANNING".equals(auditRequest.getCategory())
                        && "DELETED".equals(auditRequest.getAction())
                        && "PLANNING_LOCATION".equals(auditRequest.getEntityType())
                        && locationId.toString().equals(auditRequest.getEntityId())
        ));
    }

    @Test
    void listLocationsPrefersMostRecentlyUsedLocationForSelectedClient() {
        UUID companyId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();
        UUID preferredLocationId = UUID.randomUUID();
        UUID otherLocationId = UUID.randomUUID();

        PlanningLocation preferredLocation = new PlanningLocation();
        preferredLocation.setLocationId(preferredLocationId);
        preferredLocation.setOwnerCompanyId(companyId);
        preferredLocation.setName("Breda Warehouse");

        PlanningLocation otherLocation = new PlanningLocation();
        otherLocation.setLocationId(otherLocationId);
        otherLocation.setOwnerCompanyId(companyId);
        otherLocation.setName("Amsterdam Dock");

        ClientCompany clientCompany = new ClientCompany();
        clientCompany.setClientCompanyId(clientCompanyId);
        clientCompany.setOwnerCompanyId(companyId);
        clientCompany.setName("Client Y");

        PlanningClientLocationUsage usage = new PlanningClientLocationUsage();
        usage.setClientCompanyId(clientCompanyId);
        usage.setLocationId(preferredLocationId);
        usage.setLastUsedAt(LocalDateTime.of(2026, 6, 1, 10, 0));
        usage.setManuallyPrioritized(false);

        when(clientCompanyRepository.findByClientCompanyIdAndOwnerCompanyId(clientCompanyId, companyId))
                .thenReturn(Optional.of(clientCompany));
        when(planningLocationRepository.findByOwnerCompanyIdOrderByNameAsc(companyId))
                .thenReturn(List.of(otherLocation, preferredLocation));
        when(planningClientLocationUsageRepository.findByClientCompanyIdAndLocationIdIn(clientCompanyId, List.of(otherLocationId, preferredLocationId)))
                .thenReturn(List.of(usage));

        List<PlanningLocationDTO> result = planningManagementService.listLocations(companyId, clientCompanyId);

        assertEquals(List.of(preferredLocationId, otherLocationId), result.stream().map(PlanningLocationDTO::getLocationId).toList());
        assertTrue(Boolean.TRUE.equals(result.get(0).getPreferredForClient()));
        assertFalse(Boolean.TRUE.equals(result.get(1).getPreferredForClient()));
    }

    @Test
    void listLocationsRanksManualPriorityBeforeRecentUsage() {
        UUID companyId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();
        UUID manualLocationId = UUID.randomUUID();
        UUID recentLocationId = UUID.randomUUID();

        PlanningLocation manualLocation = new PlanningLocation();
        manualLocation.setLocationId(manualLocationId);
        manualLocation.setOwnerCompanyId(companyId);
        manualLocation.setName("Manual Location");

        PlanningLocation recentLocation = new PlanningLocation();
        recentLocation.setLocationId(recentLocationId);
        recentLocation.setOwnerCompanyId(companyId);
        recentLocation.setName("Recent Location");

        ClientCompany clientCompany = new ClientCompany();
        clientCompany.setClientCompanyId(clientCompanyId);
        clientCompany.setOwnerCompanyId(companyId);

        PlanningClientLocationUsage manualUsage = new PlanningClientLocationUsage();
        manualUsage.setClientCompanyId(clientCompanyId);
        manualUsage.setLocationId(manualLocationId);
        manualUsage.setManuallyPrioritized(true);

        PlanningClientLocationUsage recentUsage = new PlanningClientLocationUsage();
        recentUsage.setClientCompanyId(clientCompanyId);
        recentUsage.setLocationId(recentLocationId);
        recentUsage.setLastUsedAt(LocalDateTime.of(2026, 6, 14, 12, 0));

        when(clientCompanyRepository.findByClientCompanyIdAndOwnerCompanyId(clientCompanyId, companyId))
                .thenReturn(Optional.of(clientCompany));
        when(planningLocationRepository.findByOwnerCompanyIdOrderByNameAsc(companyId))
                .thenReturn(List.of(recentLocation, manualLocation));
        when(planningClientLocationUsageRepository.findByLocationIdIn(List.of(recentLocationId, manualLocationId)))
                .thenReturn(List.of(recentUsage, manualUsage));
        when(planningClientLocationUsageRepository.findByClientCompanyIdAndLocationIdIn(
                clientCompanyId,
                List.of(recentLocationId, manualLocationId)
        )).thenReturn(List.of(recentUsage, manualUsage));

        List<PlanningLocationDTO> result = planningManagementService.listLocations(companyId, clientCompanyId);

        assertEquals(List.of(manualLocationId, recentLocationId),
                result.stream().map(PlanningLocationDTO::getLocationId).toList());
    }

    @Test
    void createLocationPersistsMultipleManualClientPriorities() {
        UUID companyId = UUID.randomUUID();
        UUID locationId = UUID.randomUUID();
        UUID firstClientId = UUID.randomUUID();
        UUID secondClientId = UUID.randomUUID();

        ClientCompany firstClient = new ClientCompany();
        firstClient.setClientCompanyId(firstClientId);
        firstClient.setOwnerCompanyId(companyId);
        ClientCompany secondClient = new ClientCompany();
        secondClient.setClientCompanyId(secondClientId);
        secondClient.setOwnerCompanyId(companyId);

        PlanningLocationSaveRequestDTO request = new PlanningLocationSaveRequestDTO();
        request.setName("Park Street 123");
        request.setPrioritizedClientCompanyIds(List.of(firstClientId, secondClientId));

        when(planningLocationRepository.existsByOwnerCompanyIdAndNameIgnoreCase(companyId, "Park Street 123"))
                .thenReturn(false);
        when(planningLocationRepository.save(any(PlanningLocation.class))).thenAnswer(invocation -> {
            PlanningLocation location = invocation.getArgument(0);
            location.setLocationId(locationId);
            return location;
        });
        when(clientCompanyRepository.findByClientCompanyIdAndOwnerCompanyId(firstClientId, companyId))
                .thenReturn(Optional.of(firstClient));
        when(clientCompanyRepository.findByClientCompanyIdAndOwnerCompanyId(secondClientId, companyId))
                .thenReturn(Optional.of(secondClient));
        when(planningClientLocationUsageRepository.findByLocationId(locationId)).thenReturn(List.of());
        when(planningClientLocationUsageRepository.save(any(PlanningClientLocationUsage.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        PlanningLocationDTO response = planningManagementService.createLocation(companyId, request);

        assertEquals(List.of(firstClientId, secondClientId), response.getPrioritizedClientCompanyIds());
        verify(planningClientLocationUsageRepository).save(argThat(usage ->
                firstClientId.equals(usage.getClientCompanyId()) && usage.isManuallyPrioritized()
        ));
        verify(planningClientLocationUsageRepository).save(argThat(usage ->
                secondClientId.equals(usage.getClientCompanyId()) && usage.isManuallyPrioritized()
        ));
    }

    @Test
    void updateLocationClearsManualPriorityWithoutDeletingUsageHistory() {
        UUID companyId = UUID.randomUUID();
        UUID locationId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();

        PlanningLocation location = new PlanningLocation();
        location.setLocationId(locationId);
        location.setOwnerCompanyId(companyId);
        location.setName("Park Street 123");

        PlanningClientLocationUsage usage = new PlanningClientLocationUsage();
        usage.setClientCompanyId(clientCompanyId);
        usage.setLocationId(locationId);
        usage.setLastUsedAt(LocalDateTime.of(2026, 6, 10, 12, 0));
        usage.setManuallyPrioritized(true);

        PlanningLocationSaveRequestDTO request = new PlanningLocationSaveRequestDTO();
        request.setName("Park Street 123");
        request.setPrioritizedClientCompanyIds(List.of());

        when(planningLocationRepository.findByLocationIdAndOwnerCompanyId(locationId, companyId))
                .thenReturn(Optional.of(location));
        when(planningLocationRepository.save(location)).thenReturn(location);
        when(planningClientLocationUsageRepository.findByLocationId(locationId)).thenReturn(List.of(usage));
        when(planningClientLocationUsageRepository.save(usage)).thenReturn(usage);

        PlanningLocationDTO response = planningManagementService.updateLocation(companyId, locationId, request);

        assertFalse(usage.isManuallyPrioritized());
        assertEquals(LocalDateTime.of(2026, 6, 10, 12, 0), usage.getLastUsedAt());
        assertEquals(List.of(), response.getPrioritizedClientCompanyIds());
        verify(planningClientLocationUsageRepository, never()).delete(usage);
    }

    @Test
    void createLocationPersistsSeparateAddressFields() {
        UUID companyId = UUID.randomUUID();
        UUID locationId = UUID.randomUUID();

        PlanningLocationSaveRequestDTO request = new PlanningLocationSaveRequestDTO();
        request.setName("Rotterdam Hall");
        request.setStreetName("Hoogstraat");
        request.setHouseNumber("14");
        request.setHouseNumberSuffix("A");
        request.setPostalCode("3011 PV");
        request.setCity("Rotterdam");
        request.setNotes("Dock access");

        when(planningLocationRepository.existsByOwnerCompanyIdAndNameIgnoreCase(companyId, "Rotterdam Hall"))
                .thenReturn(false);
        when(planningLocationRepository.save(any(PlanningLocation.class))).thenAnswer(invocation -> {
            PlanningLocation location = invocation.getArgument(0);
            location.setLocationId(locationId);
            return location;
        });

        PlanningLocationDTO response = planningManagementService.createLocation(companyId, request);

        assertEquals("Hoogstraat", response.getStreetName());
        assertEquals("14", response.getHouseNumber());
        assertEquals("A", response.getHouseNumberSuffix());
        assertEquals("3011 PV", response.getPostalCode());
        assertEquals("Rotterdam", response.getCity());
        verify(planningLocationRepository).save(argThat(location ->
                "Hoogstraat".equals(location.getStreetName())
                        && "14".equals(location.getHouseNumber())
                        && "A".equals(location.getHouseNumberSuffix())
                        && "3011 PV".equals(location.getPostalCode())
                        && "Rotterdam".equals(location.getCity())
        ));
    }

    @Test
    void createProjectRecordsSavedLocationUsageForClient() {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();
        UUID locationId = UUID.randomUUID();

        ClientCompany clientCompany = new ClientCompany();
        clientCompany.setClientCompanyId(clientCompanyId);
        clientCompany.setOwnerCompanyId(companyId);
        clientCompany.setName("Client Y");

        PlanningLocation savedLocation = new PlanningLocation();
        savedLocation.setLocationId(locationId);
        savedLocation.setOwnerCompanyId(companyId);
        savedLocation.setName("Rotterdam Hall");

        PlanningProjectSaveRequestDTO request = new PlanningProjectSaveRequestDTO();
        request.setName("Project X");
        request.setStartDate(LocalDate.of(2026, 6, 1));
        request.setEndDate(LocalDate.of(2026, 6, 2));
        request.setClientCompanyId(clientCompanyId);
        request.setSavedLocationId(locationId);

        Project savedProject = new Project();
        savedProject.setProjectId(UUID.randomUUID());
        savedProject.setCompanyId(companyId);
        savedProject.setClientCompanyId(clientCompanyId);
        savedProject.setName("Project X");
        savedProject.setStartDate(LocalDate.of(2026, 6, 1));
        savedProject.setEndDate(LocalDate.of(2026, 6, 2));

        when(clientCompanyRepository.findByClientCompanyIdAndOwnerCompanyId(clientCompanyId, companyId))
                .thenReturn(Optional.of(clientCompany));
        when(planningLocationRepository.findByLocationIdAndOwnerCompanyId(locationId, companyId))
                .thenReturn(Optional.of(savedLocation));
        when(projectRepository.save(any(Project.class))).thenReturn(savedProject);
        when(planningClientLocationUsageRepository.findByClientCompanyIdAndLocationId(clientCompanyId, locationId))
                .thenReturn(Optional.empty());

        planningManagementService.createProject(companyId, userId, request);

        verify(planningClientLocationUsageRepository).save(any(PlanningClientLocationUsage.class));
    }

    @Test
    void createProjectCopiesActiveClientBillingRates() {
        UUID companyId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID clientCompanyId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID bartenderRateId = UUID.randomUUID();
        UUID barHeadRateId = UUID.randomUUID();

        ClientCompany clientCompany = new ClientCompany();
        clientCompany.setClientCompanyId(clientCompanyId);
        clientCompany.setOwnerCompanyId(companyId);
        clientCompany.setName("Client Y");

        ClientFunctionBillingRate bartenderRate = new ClientFunctionBillingRate();
        bartenderRate.setClientFunctionBillingRateId(bartenderRateId);
        bartenderRate.setCompanyId(companyId);
        bartenderRate.setClientCompanyId(clientCompanyId);
        bartenderRate.setFunctionName("Bartender");
        bartenderRate.setRatePerHour(new BigDecimal("25.00"));
        bartenderRate.setActive(true);

        ClientFunctionBillingRate barHeadRate = new ClientFunctionBillingRate();
        barHeadRate.setClientFunctionBillingRateId(barHeadRateId);
        barHeadRate.setCompanyId(companyId);
        barHeadRate.setClientCompanyId(clientCompanyId);
        barHeadRate.setFunctionName("Bar head");
        barHeadRate.setRatePerHour(new BigDecimal("30.00"));
        barHeadRate.setActive(true);

        PlanningProjectSaveRequestDTO request = new PlanningProjectSaveRequestDTO();
        request.setName("Project X");
        request.setStartDate(LocalDate.of(2026, 6, 1));
        request.setEndDate(LocalDate.of(2026, 6, 2));
        request.setClientCompanyId(clientCompanyId);

        Project savedProject = new Project();
        savedProject.setProjectId(projectId);
        savedProject.setCompanyId(companyId);
        savedProject.setClientCompanyId(clientCompanyId);
        savedProject.setName("Project X");
        savedProject.setStartDate(LocalDate.of(2026, 6, 1));
        savedProject.setEndDate(LocalDate.of(2026, 6, 2));

        when(clientCompanyRepository.findByClientCompanyIdAndOwnerCompanyId(clientCompanyId, companyId))
                .thenReturn(Optional.of(clientCompany));
        when(projectRepository.save(any(Project.class))).thenReturn(savedProject);
        when(clientFunctionBillingRateRepository.findByCompanyIdAndClientCompanyIdAndActiveTrueOrderByFunctionNameAsc(
                companyId,
                clientCompanyId
        )).thenReturn(List.of(barHeadRate, bartenderRate));
        when(projectFunctionBillingRateRepository.save(any(ProjectFunctionBillingRate.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        planningManagementService.createProject(companyId, userId, request);

        verify(projectFunctionBillingRateRepository).save(argThat(rate ->
                projectId.equals(rate.getProjectId())
                        && barHeadRateId.equals(rate.getSourceClientFunctionBillingRateId())
                        && "Bar head".equals(rate.getFunctionName())
                        && new BigDecimal("30.00").compareTo(rate.getRatePerHour()) == 0
        ));
        verify(projectFunctionBillingRateRepository).save(argThat(rate ->
                projectId.equals(rate.getProjectId())
                        && bartenderRateId.equals(rate.getSourceClientFunctionBillingRateId())
                        && "Bartender".equals(rate.getFunctionName())
                        && new BigDecimal("25.00").compareTo(rate.getRatePerHour()) == 0
        ));
    }

    private void injectAuditLogClient() {
        try {
            Field field = PlanningManagementService.class.getDeclaredField("auditLogClient");
            field.setAccessible(true);
            field.set(planningManagementService, auditLogClient);
        } catch (ReflectiveOperationException ex) {
            throw new AssertionError(ex);
        }
    }
}
